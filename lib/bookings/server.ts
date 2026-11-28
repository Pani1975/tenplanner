import { randomBytes } from "node:crypto";
import { and, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  courtBookings,
  places,
  sessions,
  tournaments,
  users,
} from "@/db/schema";
import { tournamentIntervals } from "@/lib/tournaments/hours";
import {
  BOOKING_DAYS_AHEAD,
  BOOKING_DURATIONS,
  BOOKING_STEP_MINUTES,
  BOOKING_TIME_ZONE,
  bookingDays,
  isPlaceFree,
  localDateOf,
  localMinutesOf,
  localToUtc,
  type BookablePlace,
} from "./availability";

/** Dueño de un enlace público de reservas, con el nombre a mostrar. */
export async function getBookingOwner(token: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return null;
  const [owner] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.bookingToken, token))
    .limit(1);
  if (!owner) return null;
  // Si es la cuenta de un club, se muestra el nombre del club.
  const [club] = await db
    .select({ name: clubs.name, timeZone: clubs.timeZone })
    .from(clubs)
    .where(eq(clubs.ownerId, owner.id))
    .limit(1);
  return {
    id: owner.id,
    displayName: club?.name ?? owner.name,
    // Hora del club («Mi club»); sin club, la de siempre.
    timeZone: club?.timeZone ?? BOOKING_TIME_ZONE,
  };
}

/** Token del enlace público del usuario; lo crea la primera vez. */
export async function ensureBookingToken(userId: string) {
  const [row] = await db
    .select({ token: users.bookingToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (row?.token) return row.token;
  const token = randomBytes(9).toString("base64url");
  await db
    .update(users)
    .set({ bookingToken: token })
    .where(and(eq(users.id, userId), isNull(users.bookingToken)));
  const [after] = await db
    .select({ token: users.bookingToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return after?.token ?? token;
}

/**
 * Una sesión con dos pistas ocupa dos lugares: el principal (placeId) y el
 * de la segunda pista (secondPlaceId). Estas condiciones las usan las
 * reservas, el aviso de coincidencias y el calendario de pistas.
 */
export const sessionAtPlace = (placeId: string) =>
  or(eq(sessions.placeId, placeId), eq(sessions.secondPlaceId, placeId));

export const sessionAtPlaces = (placeIds: string[]) =>
  or(
    inArray(sessions.placeId, placeIds),
    inArray(sessions.secondPlaceId, placeIds)
  );

/** Una fila por lugar ocupado: una sesión de dos pistas da dos filas. */
export function expandSessionPlaces<
  T extends { placeId: string | null; secondPlaceId: string | null },
>(rows: T[]): Array<Omit<T, "secondPlaceId"> & { placeId: string }> {
  return rows.flatMap((row) => {
    const { secondPlaceId, ...rest } = row;
    return [row.placeId, secondPlaceId]
      .filter((id): id is string => !!id)
      .map((placeId) => ({ ...rest, placeId }));
  });
}

type Exec = Pick<typeof db, "select">;

/**
 * Tramos en que los torneos ocupan las pistas indicadas entre `from` y
 * `to` (según su horario: todo el día, cada día o por días). Una fila por
 * pista y tramo.
 */
export async function loadTournamentBusy(
  placeIds: string[],
  from: Date,
  to: Date,
  exec: Exec = db
): Promise<
  { id: string; name: string; placeId: string; start: Date; end: Date }[]
> {
  if (!placeIds.length) return [];
  // Fechas con un día de margen: la zona del torneo puede ser otra.
  const day = (d: Date, shift: number) =>
    new Date(d.getTime() + shift * 86400_000).toISOString().slice(0, 10);
  const rows = await exec
    .select({
      id: tournaments.id,
      name: tournaments.name,
      placeIds: tournaments.placeIds,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      playHours: tournaments.playHours,
      timeZone: tournaments.timeZone,
    })
    .from(tournaments)
    .where(
      and(
        sql`jsonb_exists_any(${tournaments.placeIds}, ARRAY[${sql.join(
          placeIds.map((id) => sql`${id}`),
          sql`, `
        )}]::text[])`,
        sql`${tournaments.startDate} <= ${day(to, 1)}`,
        sql`coalesce(${tournaments.endDate}, ${tournaments.startDate}) >= ${day(from, -1)}`
      )
    );
  return rows.flatMap((t) =>
    tournamentIntervals(t)
      .filter((i) => i.start < to && from < i.end)
      .flatMap((i) =>
        (t.placeIds ?? [])
          .filter((p) => placeIds.includes(p))
          .map((placeId) => ({ id: t.id, name: t.name, placeId, ...i }))
      )
  );
}

/**
 * Pistas reservables del dueño con lo que las ocupa entre `from` y `to`
 * (sesiones no canceladas y reservas no canceladas). Sin nombres.
 */
export async function loadBookablePlaces(
  ownerId: string,
  from: Date,
  to: Date,
  placeIds?: string[]
): Promise<BookablePlace[]> {
  const placeRows = await db
    .select({
      id: places.id,
      name: places.name,
      openMinute: places.bookingOpenMinute,
      closeMinute: places.bookingCloseMinute,
    })
    .from(places)
    .where(
      and(
        eq(places.coachId, ownerId),
        eq(places.bookingEnabled, true),
        placeIds ? inArray(places.id, placeIds) : undefined
      )
    )
    .orderBy(places.name);
  if (placeRows.length === 0) return [];
  const ids = placeRows.map((p) => p.id);
  // Margen hacia atrás por si una sesión larga empezó antes de `from`.
  const windowStart = new Date(from.getTime() - 10 * 3600_000);

  const [sessionRows, bookingRows, tournamentRows] = await Promise.all([
    db
      .select({
        placeId: sessions.placeId,
        secondPlaceId: sessions.secondPlaceId,
        start: sessions.scheduledAt,
        minutes: sessions.durationMinutes,
      })
      .from(sessions)
      .where(
        and(
          sessionAtPlaces(ids),
          ne(sessions.status, "cancelled"),
          gte(sessions.scheduledAt, windowStart),
          lt(sessions.scheduledAt, to)
        )
      )
      .then(expandSessionPlaces),
    db
      .select({
        placeId: courtBookings.placeId,
        start: courtBookings.startAt,
        minutes: courtBookings.durationMinutes,
      })
      .from(courtBookings)
      .where(
        and(
          inArray(courtBookings.placeId, ids),
          isNull(courtBookings.cancelledAt),
          gte(courtBookings.startAt, windowStart),
          lt(courtBookings.startAt, to)
        )
      ),
    loadTournamentBusy(ids, from, to),
  ]);

  return placeRows.map((p) => ({
    ...p,
    busy: [
      ...[...sessionRows, ...bookingRows]
        .filter((b) => b.placeId === p.id)
        .map((b) => ({
          start: b.start,
          end: new Date(b.start.getTime() + b.minutes * 60_000),
        })),
      ...tournamentRows
        .filter((t) => t.placeId === p.id)
        .map((t) => ({ start: t.start, end: t.end })),
    ],
  }));
}

export type CreateBookingError = "not_found" | "invalid_time" | "taken";

/**
 * Crea una reserva comprobando, dentro de una transacción con bloqueo por
 * pista, que sigue libre (dos personas no pueden reservar el mismo hueco).
 */
export async function createCourtBooking({
  ownerId,
  placeId,
  start,
  durationMinutes,
  fullName,
  now = new Date(),
  timeZone = BOOKING_TIME_ZONE,
}: {
  ownerId: string;
  placeId: string;
  start: Date;
  durationMinutes: number;
  fullName: string;
  now?: Date;
  timeZone?: string;
}): Promise<
  { ok: true; id: string } | { ok: false; error: CreateBookingError }
> {
  if (!(BOOKING_DURATIONS as readonly number[]).includes(durationMinutes)) {
    return { ok: false, error: "invalid_time" };
  }
  const dateStr = localDateOf(start, timeZone);
  const minute = localMinutesOf(start, timeZone);
  if (
    minute % BOOKING_STEP_MINUTES !== 0 ||
    localToUtc(dateStr, minute, timeZone).getTime() !== start.getTime() ||
    !bookingDays(now, BOOKING_DAYS_AHEAD, timeZone).includes(dateStr)
  ) {
    return { ok: false, error: "invalid_time" };
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${placeId}))`);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const [place] = await loadBookablePlacesTx(
      tx,
      ownerId,
      placeId,
      start,
      end
    );
    if (!place) return { ok: false as const, error: "not_found" as const };
    if (
      !isPlaceFree(place, dateStr, minute, durationMinutes, now, timeZone)
    ) {
      return { ok: false as const, error: "taken" as const };
    }
    const [created] = await tx
      .insert(courtBookings)
      .values({
        placeId,
        ownerId,
        startAt: start,
        durationMinutes,
        fullName: fullName.trim().replace(/\s+/g, " "),
      })
      .returning({ id: courtBookings.id });
    return { ok: true as const, id: created.id };
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Igual que loadBookablePlaces, pero dentro de la transacción. */
async function loadBookablePlacesTx(
  tx: Tx,
  ownerId: string,
  placeId: string,
  from: Date,
  to: Date
): Promise<BookablePlace[]> {
  const [p] = await tx
    .select({
      id: places.id,
      name: places.name,
      openMinute: places.bookingOpenMinute,
      closeMinute: places.bookingCloseMinute,
    })
    .from(places)
    .where(
      and(
        eq(places.id, placeId),
        eq(places.coachId, ownerId),
        eq(places.bookingEnabled, true)
      )
    )
    .limit(1);
  if (!p) return [];
  const windowStart = new Date(from.getTime() - 10 * 3600_000);
  const [sessionRows, bookingRows, tournamentRows] = await Promise.all([
    tx
      .select({
        start: sessions.scheduledAt,
        minutes: sessions.durationMinutes,
      })
      .from(sessions)
      .where(
        and(
          sessionAtPlace(placeId),
          ne(sessions.status, "cancelled"),
          gte(sessions.scheduledAt, windowStart),
          lt(sessions.scheduledAt, to)
        )
      ),
    tx
      .select({
        start: courtBookings.startAt,
        minutes: courtBookings.durationMinutes,
      })
      .from(courtBookings)
      .where(
        and(
          eq(courtBookings.placeId, placeId),
          isNull(courtBookings.cancelledAt),
          gte(courtBookings.startAt, windowStart),
          lt(courtBookings.startAt, to)
        )
      ),
    loadTournamentBusy([placeId], from, to, tx),
  ]);
  return [
    {
      ...p,
      busy: [
        ...[...sessionRows, ...bookingRows].map((b) => ({
          start: b.start,
          end: new Date(b.start.getTime() + b.minutes * 60_000),
        })),
        ...tournamentRows.map((t) => ({ start: t.start, end: t.end })),
      ],
    },
  ];
}

export type ClubBookingError = "not_found" | "invalid_time" | "taken";

/**
 * Reserva hecha por el propio club (o monitor) sobre una de sus pistas, para
 * lo que indique (mantenimiento, torneo, clase particular…). No depende de si
 * la pista está abierta a reservas públicas ni de su horario, pero no puede
 * chocar con una sesión o con otra reserva.
 */
export async function createClubBooking({
  ownerId,
  createdBy,
  placeId,
  start,
  durationMinutes,
  purpose,
}: {
  /** Dueño de la pista (el monitor o la cuenta del club). */
  ownerId: string;
  /** Quién reserva: el dueño o un monitor del club. */
  createdBy: string;
  placeId: string;
  start: Date;
  durationMinutes: number;
  purpose: string;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; error: ClubBookingError; conflict?: string }
> {
  if (
    isNaN(start.getTime()) ||
    durationMinutes < 15 ||
    durationMinutes > 12 * 60
  ) {
    return { ok: false, error: "invalid_time" };
  }
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${placeId}))`);
    const [place] = await tx
      .select({ id: places.id })
      .from(places)
      .where(and(eq(places.id, placeId), eq(places.coachId, ownerId)))
      .limit(1);
    if (!place) return { ok: false as const, error: "not_found" as const };

    const windowStart = new Date(start.getTime() - 12 * 3600_000);
    const [sessionRows, bookingRows, tournamentRows] = await Promise.all([
      tx
        .select({
          title: sessions.title,
          start: sessions.scheduledAt,
          minutes: sessions.durationMinutes,
        })
        .from(sessions)
        .where(
          and(
            sessionAtPlace(placeId),
            ne(sessions.status, "cancelled"),
            gte(sessions.scheduledAt, windowStart),
            lt(sessions.scheduledAt, end)
          )
        ),
      tx
        .select({
          title: courtBookings.fullName,
          start: courtBookings.startAt,
          minutes: courtBookings.durationMinutes,
        })
        .from(courtBookings)
        .where(
          and(
            eq(courtBookings.placeId, placeId),
            isNull(courtBookings.cancelledAt),
            gte(courtBookings.startAt, windowStart),
            lt(courtBookings.startAt, end)
          )
        ),
      loadTournamentBusy([placeId], start, end, tx),
    ]);
    const tournamentClash = tournamentRows[0];
    if (tournamentClash) {
      return {
        ok: false as const,
        error: "taken" as const,
        conflict: `Torneo: ${tournamentClash.name}`,
      };
    }
    const clash = [...sessionRows, ...bookingRows].find(
      (b) =>
        b.start < end &&
        start < new Date(b.start.getTime() + b.minutes * 60_000)
    );
    if (clash) {
      return {
        ok: false as const,
        error: "taken" as const,
        conflict: clash.title,
      };
    }
    const [created] = await tx
      .insert(courtBookings)
      .values({
        placeId,
        ownerId,
        startAt: start,
        durationMinutes,
        fullName: purpose.trim().replace(/\s+/g, " ").slice(0, 120),
        kind: "club",
        createdBy,
      })
      .returning({ id: courtBookings.id });
    return { ok: true as const, id: created.id };
  });
}
