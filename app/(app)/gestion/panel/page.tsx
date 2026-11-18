import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, count, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CloudSun,
  LayoutDashboard,
  MessageSquare,
} from "lucide-react";
import { db } from "@/db";
import {
  calendarEvents,
  clubs,
  managementTasks,
  sessions,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import { calendarEventsVisibility } from "@/lib/calendar-events";
import { zonedTimeToUtc } from "@/lib/groups/schedule";
import { listVisibleMessages, type MessageListItem } from "@/lib/messages";
import { loadForecast } from "@/lib/weather";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getTerm } from "@/lib/i18n-terms";

export async function generateMetadata() {
  const term = await getTerm();
  return { title: term("Panel") };
}
export const dynamic = "force-dynamic";

const TZ = "Europe/Madrid";

/** Año, mes (1-12) y día de una fecha vista en España. */
function madridYmd(date: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { y, m, d };
}

/** Inicio (00:00 en España) del día y+m+d, con d fuera de rango permitido. */
function startOfDay(y: number, m: number, d: number) {
  const base = new Date(Date.UTC(y, m - 1, d));
  return zonedTimeToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate(),
    0,
    0,
    TZ
  );
}

const timeFmt = (loc: string) => new Intl.DateTimeFormat(loc, {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const dayFmt = (loc: string) => new Intl.DateTimeFormat(loc, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TZ,
});
const dueFmt = (loc: string) => new Intl.DateTimeFormat(loc, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function Card({
  title,
  icon: Icon,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  icon: React.ElementType;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tp-panel space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
          <Icon className="size-4 text-brand" />
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-xs font-bold text-foreground/55 hover:text-foreground"
          >
            {hrefLabel ?? "Ver todo"} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-foreground/55">{children}</p>;
}

export default async function PanelPage() {
  const term = await getTerm();
  const intlLocale = (await getLocale()) === "en" ? "en-GB" : "es-ES";
  const tx = await getTranslations("ui.s_panel_page");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo la cuenta del club.
  const clubId = await getClubAccountClubId(user.id);
  if (!clubId) notFound();

  const now = new Date();
  const { y, m, d } = madridYmd(now);
  const dayStart = startOfDay(y, m, d);
  const dayEnd = startOfDay(y, m, d + 1);
  // Semana de lunes a domingo.
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const weekStart = startOfDay(y, m, d - weekday);
  const weekEnd = startOfDay(y, m, d - weekday + 7);
  const monthStart = startOfDay(y, m, 1);
  const monthEnd = startOfDay(y, m + 1, 1);

  const eventsVisibility = calendarEventsVisibility(user.id, clubId, true);
  const clubSessions = and(
    eq(sessions.clubId, clubId),
    ne(sessions.status, "cancelled")
  );

  const [
    [club],
    todaySessions,
    [weekSessionsRow],
    nextTasks,
    weekEvents,
    monthEvents,
    messages,
  ] = await Promise.all([
    db
      .select({ name: clubs.name, address: clubs.address })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1),
    db
      .select({
        id: sessions.id,
        title: sessions.title,
        scheduledAt: sessions.scheduledAt,
        status: sessions.status,
      })
      .from(sessions)
      .where(
        and(
          clubSessions,
          gte(sessions.scheduledAt, dayStart),
          lt(sessions.scheduledAt, dayEnd)
        )
      )
      .orderBy(asc(sessions.scheduledAt)),
    db
      .select({ n: count() })
      .from(sessions)
      .where(
        and(
          clubSessions,
          gte(sessions.scheduledAt, weekStart),
          lt(sessions.scheduledAt, weekEnd)
        )
      ),
    db
      .select()
      .from(managementTasks)
      .where(
        and(eq(managementTasks.clubId, clubId), isNull(managementTasks.doneAt))
      )
      // Las más próximas primero; las que no tienen fecha, al final.
      .orderBy(
        sql`${managementTasks.dueDate} asc nulls last`,
        asc(managementTasks.createdAt)
      )
      .limit(2),
    db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        startAt: calendarEvents.startAt,
      })
      .from(calendarEvents)
      .where(
        and(
          eventsVisibility,
          gte(calendarEvents.startAt, weekStart),
          lt(calendarEvents.startAt, weekEnd)
        )
      )
      .orderBy(asc(calendarEvents.startAt))
      .limit(6),
    db
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        startAt: calendarEvents.startAt,
      })
      .from(calendarEvents)
      .where(
        and(
          eventsVisibility,
          gte(calendarEvents.startAt, monthStart),
          lt(calendarEvents.startAt, monthEnd)
        )
      )
      .orderBy(asc(calendarEvents.startAt))
      .limit(8),
    listVisibleMessages(user.id, 3).catch((): MessageListItem[] => []),
  ]);
  const forecast = await loadForecast(club?.address);
  const weekSessions = Number(weekSessionsRow?.n ?? 0);

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <LayoutDashboard className="size-3.5" />
            {tx("modoGestion")}
          </div>
          <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
            {tx("panel")}
          </h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
            {club?.name ?? "Tu club"} · {dayFmt(intlLocale).format(now)}
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title={tx("proximasTareas")}
            icon={CheckCircle2}
            href="/calendar"
            hrefLabel="Calendario de gestión"
          >
            {nextTasks.length === 0 ? (
              <Empty>{tx("noTienesTareasPendientes")}</Empty>
            ) : (
              <ul className="space-y-2">
                {nextTasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      href="/calendar"
                      className="block rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted"
                    >
                      <p className="text-sm font-bold text-foreground">
                        {t.title}
                      </p>
                      <p className="text-xs text-foreground/55">
                        {t.dueDate
                          ? dueFmt(intlLocale).format(new Date(`${t.dueDate}T00:00:00Z`))
                          : "Sin fecha"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={tx("sesionesDeHoy")} icon={Clock} href="/calendar">
            {todaySessions.length === 0 ? (
              <Empty>{tx("hoyNoHaySesiones")}</Empty>
            ) : (
              <div className="flex flex-wrap gap-2">
                {todaySessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/sessions/${s.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-brand/20 px-3.5 py-2 text-sm font-bold text-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
                  >
                    <span className="tabular-nums">
                      {timeFmt(intlLocale).format(s.scheduledAt)}
                    </span>
                    {s.title}
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title={tx("tiempo")} icon={CloudSun}>
            {forecast ? (
              <div>
                <p className="mb-2 text-xs text-foreground/55">
                  {forecast.place}
                </p>
                <ul className="grid grid-cols-3 gap-2">
                  {forecast.days.map((day, i) => (
                    <li
                      key={day.date}
                      className="rounded-lg border border-border px-3 py-2 text-center"
                    >
                      <p className="text-xs font-bold text-foreground/55">
                        {i === 0
                          ? "Hoy"
                          : dayFmt(intlLocale).format(new Date(`${day.date}T12:00:00Z`))}
                      </p>
                      <p className="text-2xl" aria-hidden>
                        {day.icon}
                      </p>
                      <p className="text-sm font-bold tabular-nums">
                        {day.max}° / {day.min}°
                      </p>
                      <p className="text-[11px] text-foreground/55">
                        {term(day.label)}
                        {day.rainChance !== null && day.rainChance > 0
                          ? ` · ${day.rainChance}% lluvia`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Empty>
                {tx("forecastError1")}{" "}
                <Link href="/club" className="underline">
                  {tx("miClub")}
                </Link>{" "}
                {tx("incluyaLaLocalidad")}
              </Empty>
            )}
          </Card>

          <Card
            title={tx("ultimosMensajes")}
            icon={MessageSquare}
            href="/mensajes"
          >
            {messages.length === 0 ? (
              <Empty>{tx("aunNoHayMensajes")}</Empty>
            ) : (
              <ul className="space-y-2">
                {messages.map((msg) => (
                  <li key={msg.id}>
                    <Link
                      href="/mensajes"
                      className="block rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted"
                    >
                      <p className="truncate text-sm font-bold text-foreground">
                        {msg.unread && (
                          <span className="mr-1.5 inline-block size-2 rounded-full bg-brand" />
                        )}
                        {msg.title}
                      </p>
                      <p className="truncate text-xs text-foreground/55">
                        {msg.sentByMe ? "Enviado" : msg.authorName} ·{" "}
                        {msg.targetLabel} · {dayFmt(intlLocale).format(msg.createdAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={tx("estaSemana")} icon={CalendarDays} href="/calendar">
            <p className="font-heading text-4xl font-black tabular-nums text-foreground">
              {weekSessions}
            </p>
            <p className="-mt-2 text-xs text-foreground/55">
              {tx("sesionV1DeLunes", { n: weekSessions })}</p>
            <h3 className="pt-2 text-xs font-black uppercase tracking-wide text-foreground/55">
              {tx("eventosDeLaSemana")}
            </h3>
            {weekEvents.length === 0 ? (
              <Empty>{tx("sinEventosEstaSemana")}</Empty>
            ) : (
              <ul className="space-y-1">
                {weekEvents.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="mr-2 tabular-nums text-foreground/55">
                      {dayFmt(intlLocale).format(e.startAt)}
                    </span>
                    {e.title}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={tx("eventosDelMes")} icon={CalendarDays} href="/calendar">
            {monthEvents.length === 0 ? (
              <Empty>{tx("sinEventosEsteMes")}</Empty>
            ) : (
              <ul className="space-y-1">
                {monthEvents.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="mr-2 tabular-nums text-foreground/55">
                      {dayFmt(intlLocale).format(e.startAt)}
                    </span>
                    {e.title}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
