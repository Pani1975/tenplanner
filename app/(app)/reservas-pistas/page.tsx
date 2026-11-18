import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { courtBookings, places, sessions } from "@/db/schema";
import {
  localDateOf,
  localMinutesOf,
  localToUtc,
  minutesLabel,
} from "@/lib/bookings/availability";
import { sessionAtPlaces } from "@/lib/bookings/server";
import { cn } from "@/lib/utils";
import { CancelBookingButton } from "./cancel-booking-button";
import { ClubBookingButton } from "./club-booking-button";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { getTerm } from "@/lib/i18n-terms";

export async function generateMetadata() {
  const term = await getTerm();
  return { title: term("Reservas de pistas") };
}

/** Alto de una hora en la rejilla, en píxeles. */
const HOUR_PX = 56;

type Block = {
  key: string;
  kind: "session" | "booking" | "club";
  id: string;
  label: string;
  startMinute: number;
  endMinute: number;
  status?: string;
  /** Sesión de dos pistas: 2 = ocupa también la columna de al lado y se
   * dibuja una sola vez a lo ancho; "split" = pistas no contiguas. */
  span?: 2 | "split";
};

function shiftDay(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const DAY_LONG = (loc: string) => new Intl.DateTimeFormat(loc, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const DAY_SHORT = (loc: string) => new Intl.DateTimeFormat(loc, {
  weekday: "short",
  timeZone: "UTC",
});

/**
 * Ocupación de las pistas de un día: una columna por pista con las sesiones
 * (del monitor o del club) y las reservas de clientes desde el enlace público.
 */
export default async function CourtBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const term = await getTerm();
  const intlLocale = (await getLocale()) === "en" ? "en-GB" : "es-ES";
  const tx = await getTranslations("ui.s_reservaspistas_page");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = localDateOf(new Date());
  const { dia } = await searchParams;
  const date =
    dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && !isNaN(Date.parse(dia))
      ? dia
      : today;
  const dayStart = localToUtc(date, 0);
  const dayEnd = localToUtc(date, 24 * 60);

  const placeRows = await db
    .select({
      id: places.id,
      name: places.name,
      bookingEnabled: places.bookingEnabled,
      openMinute: places.bookingOpenMinute,
      closeMinute: places.bookingCloseMinute,
    })
    .from(places)
    .where(eq(places.coachId, user.id))
    .orderBy(places.name);
  const placeIds = placeRows.map((p) => p.id);

  const [sessionRows, bookingRows] =
    placeIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              id: sessions.id,
              placeId: sessions.placeId,
              secondPlaceId: sessions.secondPlaceId,
              title: sessions.title,
              start: sessions.scheduledAt,
              minutes: sessions.durationMinutes,
              status: sessions.status,
            })
            .from(sessions)
            .where(
              and(
                sessionAtPlaces(placeIds),
                ne(sessions.status, "cancelled"),
                gte(
                  sessions.scheduledAt,
                  new Date(dayStart.getTime() - 10 * 3600_000)
                ),
                lt(sessions.scheduledAt, dayEnd)
              )
            ),
          db
            .select({
              id: courtBookings.id,
              placeId: courtBookings.placeId,
              fullName: courtBookings.fullName,
              bookingKind: courtBookings.kind,
              start: courtBookings.startAt,
              minutes: courtBookings.durationMinutes,
            })
            .from(courtBookings)
            .where(
              and(
                inArray(courtBookings.placeId, placeIds),
                isNull(courtBookings.cancelledAt),
                gte(
                  courtBookings.startAt,
                  new Date(dayStart.getTime() - 10 * 3600_000)
                ),
                lt(courtBookings.startAt, dayEnd)
              )
            ),
        ]);

  // Minutos del día (hora local) de cada bloque, recortados al día.
  const toBlock = (
    start: Date,
    minutes: number
  ): { startMinute: number; endMinute: number } | null => {
    const end = new Date(start.getTime() + minutes * 60_000);
    if (end <= dayStart || start >= dayEnd) return null;
    const startMinute = start < dayStart ? 0 : localMinutesOf(start);
    const endMinute = end >= dayEnd ? 24 * 60 : localMinutesOf(end) || 24 * 60;
    return { startMinute, endMinute };
  };

  const blocksByPlace = new Map<string, Block[]>();
  // Una sesión de dos pistas pinta un bloque en cada lugar que ocupa.
  // Si las dos pistas son columnas contiguas, la sesión se dibuja una sola
  // vez cubriendo las dos; si no, un bloque en cada una marcado «2 pistas».
  const placeIndex = new Map(placeRows.map((p, i) => [p.id, i]));
  for (const s of sessionRows) {
    const b = toBlock(s.start, s.minutes);
    if (!b) continue;
    const ids = [s.placeId, s.secondPlaceId].filter(
      (id): id is string => !!id && placeIndex.has(id)
    );
    const two = !!s.placeId && !!s.secondPlaceId && ids.length === 2;
    const adjacent =
      two &&
      Math.abs(
        (placeIndex.get(ids[0]) ?? 0) - (placeIndex.get(ids[1]) ?? 0)
      ) === 1;
    const targets = adjacent
      ? [
          ids.reduce((a, c) =>
            (placeIndex.get(a) ?? 0) < (placeIndex.get(c) ?? 0) ? a : c
          ),
        ]
      : ids;
    for (const placeId of targets) {
      const list = blocksByPlace.get(placeId) ?? [];
      list.push({
        key: `s-${s.id}-${placeId}`,
        kind: "session",
        id: s.id,
        label: s.title,
        status: s.status,
        span: adjacent ? 2 : two ? "split" : undefined,
        ...b,
      });
      blocksByPlace.set(placeId, list);
    }
  }
  for (const r of bookingRows) {
    const b = toBlock(r.start, r.minutes);
    if (!b) continue;
    const list = blocksByPlace.get(r.placeId) ?? [];
    list.push({
      key: `b-${r.id}`,
      kind: r.bookingKind === "club" ? "club" : "booking",
      id: r.id,
      label: r.bookingKind === "club" ? `Club: ${r.fullName}` : r.fullName,
      ...b,
    });
    blocksByPlace.set(r.placeId, list);
  }

  // Franja visible: horario de las pistas, ampliado si hay algo fuera.
  const allBlocks = [...blocksByPlace.values()].flat();
  const firstHour = Math.floor(
    Math.min(
      ...placeRows.map((p) => p.openMinute),
      ...allBlocks.map((b) => b.startMinute),
      8 * 60
    ) / 60
  );
  const lastHour = Math.ceil(
    Math.max(
      ...placeRows.map((p) => p.closeMinute),
      ...allBlocks.map((b) => b.endMinute),
      22 * 60
    ) / 60
  );
  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, i) => firstHour + i
  );
  const top = (minute: number) => ((minute - firstHour * 60) / 60) * HOUR_PX;

  const week = Array.from({ length: 7 }, (_, i) => shiftDay(date, i - 3));
  const dayDate = (d: string) => new Date(`${d}T00:00:00Z`);
  const sessionCount = sessionRows.filter((s) => s.placeId).length;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-foreground">
              <CalendarCheck className="size-6 text-brand" />
              {tx("reservasDePistas")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tx("ocupacionDeCadaPista")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClubBookingButton
              places={placeRows.map((p) => ({ id: p.id, name: p.name }))}
              date={date}
            />
            <Link
              href="/places"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Settings2 className="size-3.5" />
              {tx("pistasHorarioYEnlace")}
            </Link>
          </div>
        </header>

        {/* Navegación por días */}
        <nav aria-label={tx("dia")} className="flex items-center gap-2">
          <Link
            href={`/reservas-pistas?dia=${shiftDay(date, -1)}`}
            aria-label={tx("diaAnterior")}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div className="grid flex-1 grid-cols-7 gap-1">
            {week.map((d) => (
              <Link
                key={d}
                href={`/reservas-pistas?dia=${d}`}
                aria-current={d === date ? "date" : undefined}
                className={cn(
                  "flex flex-col items-center rounded-xl border py-1.5 text-center transition-colors",
                  d === date
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-muted",
                  d === today && d !== date && "border-brand"
                )}
              >
                <span className="text-[10px] font-bold uppercase opacity-70">
                  {DAY_SHORT(intlLocale).format(dayDate(d)).replace(".", "")}
                </span>
                <span className="text-sm font-black">
                  {dayDate(d).getUTCDate()}
                </span>
              </Link>
            ))}
          </div>
          <Link
            href={`/reservas-pistas?dia=${shiftDay(date, 1)}`}
            aria-label={tx("diaSiguiente")}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </Link>
        </nav>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold capitalize text-foreground">
            {DAY_LONG(intlLocale).format(dayDate(date))}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-brand" />{" "}{tx("sesiones")}
            {sessionCount})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-400" />{" "}{tx("reservasDeClientes")}
            {bookingRows.filter((b) => b.bookingKind !== "club").length})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-violet-500" />{" "}{tx("reservasDelClub")}{bookingRows.filter((b) => b.bookingKind === "club").length})
          </span>
          {date !== today && (
            <Link href="/reservas-pistas" className="font-semibold underline">
              {tx("hoy")}
            </Link>
          )}
        </div>

        {placeRows.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Aún no tienes pistas. Dalas de alta en{" "}
            <Link href="/places" className="font-semibold underline">
              {tx("lugares")}
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <div
              className="grid min-w-max"
              style={{
                gridTemplateColumns: `3.25rem repeat(${placeRows.length}, minmax(9.5rem, 1fr))`,
              }}
            >
              {/* Cabecera */}
              <div className="sticky left-0 z-20 border-b border-border bg-card" />
              {placeRows.map((p) => (
                <div
                  key={p.id}
                  className="border-b border-l border-border px-2 py-2 text-center"
                >
                  <p className="truncate text-sm font-bold text-foreground">
                    {p.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.bookingEnabled
                      ? `Reservable ${minutesLabel(p.openMinute)}–${minutesLabel(p.closeMinute)}`
                      : "Solo sesiones"}
                  </p>
                </div>
              ))}

              {/* Horas */}
              <div
                className="sticky left-0 z-10 bg-card"
                style={{ height: hours.length * HOUR_PX }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pr-1.5 text-right text-[10px] tabular-nums text-muted-foreground"
                    style={{ height: HOUR_PX }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Columnas de pistas */}
              {placeRows.map((p) => (
                <div
                  key={p.id}
                  className="relative border-l border-border"
                  style={{ height: hours.length * HOUR_PX }}
                >
                  {hours.map((h, i) => (
                    <div
                      key={h}
                      className={cn(
                        "absolute inset-x-0 border-t border-border/50",
                        // Fuera del horario de reserva: sombreado.
                        p.bookingEnabled &&
                          (h * 60 < p.openMinute || h * 60 >= p.closeMinute) &&
                          "bg-muted/40"
                      )}
                      style={{ top: i * HOUR_PX, height: HOUR_PX }}
                    />
                  ))}
                  {(blocksByPlace.get(p.id) ?? [])
                    .sort((a, b) => a.startMinute - b.startMinute)
                    .map((b) => {
                      const height = Math.max(
                        top(b.endMinute) - top(b.startMinute) - 2,
                        22
                      );
                      const time = `${minutesLabel(b.startMinute)}–${minutesLabel(b.endMinute % 1440)}`;
                      const content = (
                        <>
                          <span className="block truncate text-[12px] font-bold leading-tight">
                            {term(b.label)}
                          </span>
                          <span className="block text-[10px] tabular-nums opacity-75">
                            {time}
                            {b.span ? tx("2Pistas") : ""}
                            {b.kind === "session" && b.status === "completed"
                              ? tx("completada")
                              : ""}
                          </span>
                        </>
                      );
                      return b.kind === "session" ? (
                        <Link
                          key={b.key}
                          href={`/sessions/${b.id}`}
                          className={cn(
                            "absolute left-1 overflow-hidden rounded-lg border border-brand/60 bg-brand/25 px-2 py-1 text-foreground hover:bg-brand/40",
                            b.span === 2 ? "z-10" : "right-1"
                          )}
                          style={{
                            top: top(b.startMinute) + 1,
                            height,
                            // Cubre su columna y la siguiente.
                            ...(b.span === 2
                              ? { width: "calc(200% - 0.5rem + 1px)" }
                              : {}),
                          }}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div
                          key={b.key}
                          className={cn(
                            "absolute inset-x-1 flex items-start gap-1 overflow-hidden rounded-lg border px-2 py-1 text-foreground",
                            b.kind === "club"
                              ? "border-violet-500/60 bg-violet-500/20"
                              : "border-amber-500/60 bg-amber-400/25"
                          )}
                          style={{ top: top(b.startMinute) + 1, height }}
                        >
                          <div className="min-w-0 flex-1">{content}</div>
                          <CancelBookingButton id={b.id} name={b.label} />
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
