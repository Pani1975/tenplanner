import { randomBytes } from "node:crypto";
import { and, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubs, courtBookings, places, sessions, users } from "@/db/schema";
import {
  BOOKING_DAYS_AHEAD,
  BOOKING_DURATIONS,
  BOOKING_STEP_MINUTES,
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
    .select({ name: clubs.name })
    .from(clubs)
    .where(eq(clubs.ownerId, owner.id))
    .limit(1);
  return { id: owner.id, displayName: club?.name ?? owner.name };
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

  const [sessionRows, bookingRows] = await Promise.all([
    db
      .select({
        placeId: sessions.placeId,
        start: sessions.scheduledAt,
        minutes: sessions.durationMinutes,
      })
      .from(sessions)
      .where(
        and(
          inArray(sessions.placeId, ids),
          ne(sessions.status, "cancelled"),
          gte(sessions.scheduledAt, windowStart),
          lt(sessions.scheduledAt, to)
        )
      ),
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
  ]);

  return placeRows.map((p) => ({
    ...p,
    busy: [...sessionRows, ...bookingRows]
      .filter((b) => b.placeId === p.id)
      .map((b) => ({
        start: b.start,
        end: new Date(b.start.getTime() + b.minutes * 60_000),
      })),
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
}: {
  ownerId: string;
  placeId: string;
  start: Date;
  durationMinutes: number;
  fullName: string;
  now?: Date;
}): Promise<
  { ok: true; id: string } | { ok: false; error: CreateBookingError }
> {
  if (!(BOOKING_DURATIONS as readonly number[]).includes(durationMinutes)) {
    return { ok: false, error: "invalid_time" };
  }
  const dateStr = localDateOf(start);
  const minute = localMinutesOf(start);
  if (
    minute % BOOKING_STEP_MINUTES !== 0 ||
    localToUtc(dateStr, minute).getTime() !== start.getTime() ||
    !bookingDays(now, BOOKING_DAYS_AHEAD).includes(dateStr)
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
    if (!isPlaceFree(place, dateStr, minute, durationMinutes, now)) {
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
  const [sessionRows, bookingRows] = await Promise.all([
    tx
      .select({
        start: sessions.scheduledAt,
        minutes: sessions.durationMinutes,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.placeId, placeId),
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
  ]);
  return [
    {
      ...p,
      busy: [...sessionRows, ...bookingRows].map((b) => ({
        start: b.start,
        end: new Date(b.start.getTime() + b.minutes * 60_000),
      })),
    },
  ];
}
