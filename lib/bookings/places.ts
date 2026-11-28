import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clubs, places } from "@/db/schema";
import { getActiveWorkClubId } from "@/lib/clubs";
import { BOOKING_TIME_ZONE } from "./availability";

/**
 * Dueños de las pistas que puede usar el usuario al montar una sesión: él
 * mismo y, si trabaja en un club, la cuenta del club. Así las sesiones de los
 * monitores ocupan las pistas del club y salen en sus Reservas de pistas.
 * `clubId` = club de la sesión (al editar); por defecto, el modo de trabajo.
 */
export async function usablePlaceOwners(
  userId: string,
  clubId?: string | null
): Promise<{ ownerIds: string[]; clubOwnerId: string | null; clubName: string | null }> {
  const cid = clubId === undefined ? await getActiveWorkClubId(userId) : clubId;
  if (!cid) return { ownerIds: [userId], clubOwnerId: null, clubName: null };
  const [club] = await db
    .select({ ownerId: clubs.ownerId, name: clubs.name })
    .from(clubs)
    .where(eq(clubs.id, cid))
    .limit(1);
  if (!club || club.ownerId === userId) {
    return { ownerIds: [userId], clubOwnerId: club?.ownerId ?? null, clubName: club?.name ?? null };
  }
  return {
    ownerIds: [club.ownerId, userId],
    clubOwnerId: club.ownerId,
    clubName: club.name,
  };
}

/**
 * Pistas para elegir en una sesión. Monitor en el entorno de un club: solo
 * las del club (sus pistas particulares, en su entorno particular). `keep` =
 * pistas que ya usa la sesión que se edita: se siguen ofreciendo aunque sean
 * particulares, para no perderlas al guardar (marcadas «(mía)»).
 */
export async function listUsablePlaces(
  userId: string,
  clubId?: string | null,
  keep: (string | null | undefined)[] = []
): Promise<{ id: string; name: string }[]> {
  const { ownerIds, clubOwnerId } = await usablePlaceOwners(userId, clubId);
  const clubAsMonitor = !!clubOwnerId && clubOwnerId !== userId;
  const rows = (
    await db
      .select({ id: places.id, name: places.name, ownerId: places.coachId })
      .from(places)
      .where(inArray(places.coachId, ownerIds))
      .orderBy(asc(places.name))
  ).filter(
    (r) => !clubAsMonitor || r.ownerId === clubOwnerId || keep.includes(r.id)
  );
  const mixed = !!clubOwnerId && clubOwnerId !== userId &&
    rows.some((r) => r.ownerId === clubOwnerId) &&
    rows.some((r) => r.ownerId === userId);
  return [
    ...rows.filter((r) => r.ownerId !== userId),
    ...rows.filter((r) => r.ownerId === userId),
  ].map((r) => ({
    id: r.id,
    name: mixed && r.ownerId === userId ? `${r.name} (mía)` : r.name,
  }));
}

/**
 * Zona horaria de las pistas de un dueño: la de su club si es la cuenta de
 * un club («Mi club»); si no, la de siempre (BOOKING_TIME_ZONE).
 */
export async function timeZoneForOwner(ownerId: string): Promise<string> {
  const [club] = await db
    .select({ timeZone: clubs.timeZone })
    .from(clubs)
    .where(eq(clubs.ownerId, ownerId))
    .limit(1);
  return club?.timeZone ?? BOOKING_TIME_ZONE;
}
