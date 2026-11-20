// Ocupación de las pistas en un periodo (semana, mes o año) para las vistas
// de Reservas de pistas: sesiones, reservas de clientes, reservas del club y
// torneos, una fila por pista y día. La vista «Día» tiene su propia rejilla.

import { and, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { courtBookings, sessions } from "@/db/schema";
import { localDateOf, localMinutesOf } from "./availability";
import {
  expandSessionPlaces,
  loadTournamentBusy,
  sessionAtPlaces,
} from "./server";

export type OccupancyKind = "session" | "booking" | "club" | "tournament";

export type OccupancyItem = {
  key: string;
  kind: OccupancyKind;
  /** Sesión o torneo: para enlazar a su ficha. */
  id: string;
  placeId: string;
  label: string;
  /** Día local (YYYY-MM-DD) en que empieza. */
  date: string;
  startMinute: number;
  minutes: number;
};

export async function loadOccupancy(
  placeIds: string[],
  from: Date,
  to: Date,
  timeZone: string
): Promise<OccupancyItem[]> {
  if (!placeIds.length) return [];
  const windowStart = new Date(from.getTime() - 10 * 3600_000);
  const [sessionRows, bookingRows, tournamentRows] = await Promise.all([
    db
      .select({
        id: sessions.id,
        placeId: sessions.placeId,
        secondPlaceId: sessions.secondPlaceId,
        title: sessions.title,
        start: sessions.scheduledAt,
        minutes: sessions.durationMinutes,
      })
      .from(sessions)
      .where(
        and(
          sessionAtPlaces(placeIds),
          ne(sessions.status, "cancelled"),
          gte(sessions.scheduledAt, windowStart),
          lt(sessions.scheduledAt, to)
        )
      )
      .then(expandSessionPlaces),
    db
      .select({
        id: courtBookings.id,
        placeId: courtBookings.placeId,
        fullName: courtBookings.fullName,
        kind: courtBookings.kind,
        start: courtBookings.startAt,
        minutes: courtBookings.durationMinutes,
      })
      .from(courtBookings)
      .where(
        and(
          inArray(courtBookings.placeId, placeIds),
          isNull(courtBookings.cancelledAt),
          gte(courtBookings.startAt, windowStart),
          lt(courtBookings.startAt, to)
        )
      ),
    loadTournamentBusy(placeIds, from, to),
  ]);

  const at = (start: Date) => ({
    date: localDateOf(start, timeZone),
    startMinute: localMinutesOf(start, timeZone),
  });
  const inRange = (start: Date, minutes: number) =>
    start < to && new Date(start.getTime() + minutes * 60_000) > from;

  const items: OccupancyItem[] = [
    ...sessionRows
      .filter((s) => placeIds.includes(s.placeId) && inRange(s.start, s.minutes))
      .map((s) => ({
        key: `s-${s.id}-${s.placeId}`,
        kind: "session" as const,
        id: s.id,
        placeId: s.placeId,
        label: s.title,
        minutes: s.minutes,
        ...at(s.start),
      })),
    ...bookingRows
      .filter((b) => inRange(b.start, b.minutes))
      .map((b) => ({
        key: `b-${b.id}`,
        kind: (b.kind === "club" ? "club" : "booking") as OccupancyKind,
        id: b.id,
        placeId: b.placeId,
        label: b.kind === "club" ? `Club: ${b.fullName}` : b.fullName,
        minutes: b.minutes,
        ...at(b.start),
      })),
    ...tournamentRows.map((t) => ({
      key: `t-${t.id}-${t.placeId}-${t.start.getTime()}`,
      kind: "tournament" as const,
      id: t.id,
      placeId: t.placeId,
      label: `Torneo: ${t.name}`,
      minutes: Math.round((t.end.getTime() - t.start.getTime()) / 60_000),
      ...at(t.start),
    })),
  ];
  return items.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute
  );
}
