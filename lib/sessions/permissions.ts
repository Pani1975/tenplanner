import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers, sessions } from "@/db/schema";

/**
 * Quién puede editar una sesión:
 * - quien la creó (user_id),
 * - el monitor que la imparte (coach_id),
 * - el gestor del club al que pertenece (dueño activo del club de club_id).
 *
 * El resto de monitores del club la ven (ver sharedWithClubCondition) y
 * pueden duplicarla, pero no editarla.
 */

/** Monitor que imparte la sesión: coach_id o, si no hay, quien la creó. */
export const sessionCoachColumn = sql<string>`COALESCE(${sessions.coachId}, ${sessions.userId})`;

/** Condición: la sesión la imparte `userId`. */
export function taughtByCondition(userId: string): SQL {
  return sql`COALESCE(${sessions.coachId}, ${sessions.userId}) = ${userId}`;
}

async function getOwnedClubIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ clubId: clubMembers.clubId })
    .from(clubMembers)
    .where(
      and(
        eq(clubMembers.userId, userId),
        eq(clubMembers.role, "owner"),
        eq(clubMembers.status, "active")
      )
    );
  return rows.map((r) => r.clubId);
}

/** Condición SQL: sesiones que `userId` puede editar. */
export async function editableSessionCondition(userId: string): Promise<SQL> {
  const ownedClubIds = await getOwnedClubIds(userId);
  const conditions: SQL[] = [
    eq(sessions.userId, userId),
    eq(sessions.coachId, userId),
  ];
  if (ownedClubIds.length > 0)
    conditions.push(inArray(sessions.clubId, ownedClubIds));
  return or(...conditions)!;
}

/** ¿Puede `userId` editar esta sesión? */
export async function canEditSession(
  userId: string,
  row: { userId: string; coachId?: string | null; clubId?: string | null }
): Promise<boolean> {
  if (row.userId === userId || row.coachId === userId) return true;
  if (!row.clubId) return false;
  const ownedClubIds = await getOwnedClubIds(userId);
  return ownedClubIds.includes(row.clubId);
}
