// Coincidencias de un torneo con lo que ya ocupa sus pistas: sesiones (el
// organizador decide si las cancela o las deja) y reservas (solo aviso; los
// nombres de clientes solo los ve el dueño de la pista).

import { and, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { courtBookings, places, sessions, users } from "@/db/schema";
import { sessionAtPlaces } from "@/lib/bookings/server";
import { sendEmail } from "@/lib/email";
import { renderActionEmailHtml } from "@/lib/email-layout";
import { siteUrl } from "@/lib/site";
import { tournamentIntervals, type TournamentHours } from "./hours";

export type CourtPlan = {
  placeIds: string[] | null | undefined;
  startDate: string;
  endDate?: string | null;
  playHours?: TournamentHours | null;
  timeZone?: string | null;
};

export type SessionConflict = {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  placeName: string;
  coachName: string | null;
};

export type BookingConflict = {
  id: string;
  label: string;
  startAt: string;
  durationMinutes: number;
  placeName: string;
};

const overlaps = (
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
) => a.start < b.end && b.start < a.end;

/** Sesiones no canceladas y reservas que caen en las pistas y horas. */
export async function findCourtConflicts(
  plan: CourtPlan,
  viewerId: string
): Promise<{ sessions: SessionConflict[]; bookings: BookingConflict[] }> {
  const ids = [...new Set(plan.placeIds ?? [])];
  const intervals = tournamentIntervals(plan);
  if (!ids.length || !intervals.length) return { sessions: [], bookings: [] };
  const from = new Date(
    Math.min(...intervals.map((i) => i.start.getTime())) - 12 * 3600_000
  );
  const to = new Date(Math.max(...intervals.map((i) => i.end.getTime())));

  const [placeRows, sessionRows, bookingRows] = await Promise.all([
    db
      .select({ id: places.id, name: places.name, ownerId: places.coachId })
      .from(places)
      .where(inArray(places.id, ids)),
    db
      .select({
        id: sessions.id,
        title: sessions.title,
        start: sessions.scheduledAt,
        minutes: sessions.durationMinutes,
        placeId: sessions.placeId,
        secondPlaceId: sessions.secondPlaceId,
        coachName: users.name,
      })
      .from(sessions)
      .leftJoin(
        users,
        // Quien la imparte: el monitor asignado o, si no hay, quien la creó.
        eq(users.id, sql`coalesce(${sessions.coachId}, ${sessions.userId})`)
      )
      .where(
        and(
          sessionAtPlaces(ids),
          ne(sessions.status, "cancelled"),
          gte(sessions.scheduledAt, from),
          lt(sessions.scheduledAt, to)
        )
      ),
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
          inArray(courtBookings.placeId, ids),
          isNull(courtBookings.cancelledAt),
          gte(courtBookings.startAt, from),
          lt(courtBookings.startAt, to)
        )
      ),
  ]);
  const placeById = new Map(placeRows.map((p) => [p.id, p]));
  const hits = (start: Date, minutes: number) => {
    const r = { start, end: new Date(start.getTime() + minutes * 60_000) };
    return intervals.some((i) => overlaps(r, i));
  };

  const sessionsOut: SessionConflict[] = sessionRows
    .filter((s) => hits(s.start, s.minutes))
    .map((s) => {
      const placeId = [s.placeId, s.secondPlaceId].find(
        (p) => p && ids.includes(p)
      );
      return {
        id: s.id,
        title: s.title,
        scheduledAt: s.start.toISOString(),
        durationMinutes: s.minutes,
        placeName: placeById.get(placeId ?? "")?.name ?? "",
        coachName: s.coachName,
      };
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const bookingsOut: BookingConflict[] = bookingRows
    .filter((b) => hits(b.start, b.minutes))
    .map((b) => {
      const place = placeById.get(b.placeId);
      const isOwner = place?.ownerId === viewerId;
      return {
        id: b.id,
        label:
          b.kind === "club"
            ? `Reserva del club: ${b.fullName}`
            : isOwner
              ? `Reserva de ${b.fullName}`
              : "Reserva de un cliente",
        startAt: b.start.toISOString(),
        durationMinutes: b.minutes,
        placeName: place?.name ?? "",
      };
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return { sessions: sessionsOut, bookings: bookingsOut };
}

/**
 * Cancela las sesiones elegidas, solo si de verdad coinciden con el torneo
 * (no se puede usar para cancelar cualquier sesión), y avisa por correo a
 * quien la imparte si no es quien cancela. No borra nada.
 */
export async function cancelConflictingSessions(
  plan: CourtPlan,
  sessionIds: string[],
  tournamentName: string,
  viewerId: string
): Promise<{ cancelled: number; notified: number }> {
  if (!sessionIds.length) return { cancelled: 0, notified: 0 };
  const { sessions: conflicts } = await findCourtConflicts(plan, viewerId);
  const allowed = new Set(conflicts.map((c) => c.id));
  const ids = sessionIds.filter((id) => allowed.has(id));
  if (!ids.length) return { cancelled: 0, notified: 0 };

  const rows = await db
    .update(sessions)
    .set({
      status: "cancelled",
      statusNote: `Cancelada por el torneo «${tournamentName}»`,
      updatedAt: new Date(),
    })
    .where(and(inArray(sessions.id, ids), ne(sessions.status, "cancelled")))
    .returning({
      id: sessions.id,
      title: sessions.title,
      scheduledAt: sessions.scheduledAt,
      coachId: sessions.coachId,
      userId: sessions.userId,
    });

  let notified = 0;
  const teacherIds = [
    ...new Set(
      rows.map((r) => r.coachId ?? r.userId).filter((u) => u !== viewerId)
    ),
  ];
  if (teacherIds.length) {
    const teachers = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(inArray(users.id, teacherIds));
    const fmt = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: plan.timeZone || "Europe/Madrid",
    });
    for (const t of teachers) {
      if (!t.email) continue;
      const mine = rows.filter((r) => (r.coachId ?? r.userId) === t.id);
      const lines = mine.map(
        (r) => `«${r.title}», ${fmt.format(r.scheduledAt)}`
      );
      const subject =
        mine.length === 1
          ? `Sesión cancelada por el torneo «${tournamentName}»`
          : `${mine.length} sesiones canceladas por el torneo «${tournamentName}»`;
      const paragraphs = [
        `Hola${t.name ? ` ${t.name}` : ""}: el torneo «${tournamentName}» usa la pista a esa hora y se ha cancelado:`,
        ...lines,
        "La sesión no se ha borrado: sigue en tu lista como cancelada por si quieres pasarla a otro día u otra pista.",
      ];
      const url = `${siteUrl}/sessions`;
      const res = await sendEmail({
        to: t.email,
        subject,
        html: renderActionEmailHtml({
          greeting: "Sesión cancelada",
          paragraphs,
          buttonLabel: "Ver mis sesiones",
          buttonUrl: url,
          footnote:
            "Te llega este correo porque impartes esa sesión en Ten Planner.",
        }),
        text: [...paragraphs, "", url].join("\n"),
      });
      if (res.sent) notified++;
    }
  }
  return { cancelled: rows.length, notified };
}
