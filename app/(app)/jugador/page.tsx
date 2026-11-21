import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  CalendarDays,
  ChevronRight,
  Dumbbell,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Swords,
} from "lucide-react";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { LocalDateTime } from "@/components/family/local-time";
import { getFamilyPlayers, getPlayerCalendar } from "@/lib/family-data";
import { listMatches } from "@/lib/matches/server";
import { MATCH_TYPE_LABELS, rivalName } from "@/lib/matches/validation";
import { formatMatchDate } from "@/lib/matches/format";

export const metadata = { title: "Inicio" };

const DAY = 24 * 60 * 60 * 1000;

function Section({
  title,
  icon: Icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: React.ElementType;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tp-panel space-y-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-black text-foreground">
          <Icon className="size-4 text-brand-ink" />
          {title}
        </h2>
        <Link
          href={href}
          className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-brand-ink hover:underline"
        >
          {linkLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-6 text-foreground/55">{children}</p>;
}

function ItemLink({
  href,
  title,
  meta,
}: {
  href: string;
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 hover:bg-foreground/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {meta && <p className="text-xs text-foreground/55">{meta}</p>}
        </div>
        <ChevronRight className="size-4 shrink-0 text-foreground/35" />
      </Link>
    </li>
  );
}

/**
 * Inicio de la cuenta de jugador: próximas sesiones del club (si está
 * vinculado), últimos partidos y lo último de su espacio privado.
 */
export default async function JugadorInicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const [players, lastMatches, myExercises, myClasses] = await Promise.all([
    getFamilyPlayers(user.id).catch(() => []),
    listMatches(user.id).then((rows) => rows.slice(0, 3)),
    db
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(and(eq(exercises.createdBy, user.id), eq(exercises.isGlobal, false)))
      .orderBy(desc(exercises.updatedAt))
      .limit(3),
    db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(eq(classes.createdBy, user.id))
      .orderBy(desc(classes.updatedAt))
      .limit(3),
  ]);

  const linked = players.filter((p) => p.clubId);
  const calendars = await Promise.all(
    linked.map((p) =>
      getPlayerCalendar(p, now, new Date(now.getTime() + 30 * DAY)).catch(
        () => ({ sessions: [], holidays: [] })
      )
    )
  );
  const upcoming = calendars
    .flatMap((c, i) =>
      c.sessions.map((s) => ({ ...s, clubName: linked[i].clubName }))
    )
    .filter((s) => s.status !== "cancelled" && s.scheduledAt >= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 4);

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={LayoutDashboard}
          kicker="Jugador"
          title="Inicio"
          description="Tus próximas clases, tus últimos partidos y lo último que has preparado."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Section
            title="Próximas sesiones"
            icon={CalendarDays}
            href="/mi-familia/calendario"
            linkLabel="Calendario"
          >
            {linked.length === 0 ? (
              <Empty>
                Aún no estás vinculado a ningún club. Cuando tu club te invite,
                aquí verás tus próximas sesiones.
              </Empty>
            ) : upcoming.length === 0 ? (
              <Empty>No tienes sesiones en los próximos 30 días.</Empty>
            ) : (
              <ul className="space-y-1">
                {upcoming.map((s) => (
                  <ItemLink
                    key={s.id}
                    href="/mi-familia/calendario"
                    title={s.objective ?? s.title}
                    meta={
                      <>
                        <LocalDateTime
                          iso={s.scheduledAt.toISOString()}
                          options={{
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }}
                        />
                        {s.location ? ` · ${s.location}` : ""}
                        {s.clubName ? ` · ${s.clubName}` : ""}
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Últimos partidos"
            icon={Swords}
            href="/mis-partidos"
            linkLabel="Mis partidos"
          >
            {lastMatches.length === 0 ? (
              <div className="space-y-3">
                <Empty>Aún no has añadido ningún partido.</Empty>
                <Link
                  href="/mis-partidos/nuevo"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground hover:bg-brand/90"
                >
                  <Plus className="size-4" />
                  Añadir partido
                </Link>
              </div>
            ) : (
              <ul className="space-y-1">
                {lastMatches.map((m) => (
                  <ItemLink
                    key={m.id}
                    href={`/mis-partidos/${m.id}`}
                    title={`${MATCH_TYPE_LABELS[m.matchType]}${
                      rivalName(m) ? ` vs ${rivalName(m)}` : ""
                    }`}
                    meta={`${formatMatchDate(m.matchDate)}${
                      m.finalResult ? ` · ${m.finalResult}` : ""
                    }`}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Mis ejercicios"
            icon={Dumbbell}
            href="/exercises?tab=mine"
            linkLabel="Ver todos"
          >
            {myExercises.length === 0 ? (
              <Empty>
                Crea tus propios ejercicios o copia los de la biblioteca a tu
                espacio.
              </Empty>
            ) : (
              <ul className="space-y-1">
                {myExercises.map((e) => (
                  <ItemLink key={e.id} href={`/exercises/${e.id}`} title={e.name} />
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Mis clases"
            icon={GraduationCap}
            href="/classes?tab=mine"
            linkLabel="Ver todas"
          >
            {myClasses.length === 0 ? (
              <Empty>
                Crea tus propias clases o copia las de la biblioteca a tu
                espacio.
              </Empty>
            ) : (
              <ul className="space-y-1">
                {myClasses.map((c) => (
                  <ItemLink key={c.id} href={`/classes/${c.id}`} title={c.name} />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
