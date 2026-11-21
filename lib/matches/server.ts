import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { matches } from "@/db/schema";
import type { MatchData, MatchType } from "./validation";

/**
 * Acceso a Mis partidos. Siempre filtra por el dueño (userId): un usuario
 * nunca ve ni toca los partidos de otro, y los datos del rival no salen de
 * aquí hacia nadie más.
 */

export type MatchRow = typeof matches.$inferSelect;

export async function listMatches(
  userId: string,
  filters: { type?: MatchType | null; year?: number | null } = {}
): Promise<MatchRow[]> {
  const conds = [eq(matches.userId, userId)];
  if (filters.type) conds.push(eq(matches.matchType, filters.type));
  if (filters.year) {
    conds.push(gte(matches.matchDate, `${filters.year}-01-01`));
    conds.push(lt(matches.matchDate, `${filters.year + 1}-01-01`));
  }
  return db
    .select()
    .from(matches)
    .where(and(...conds))
    .orderBy(desc(matches.matchDate), desc(matches.createdAt));
}

/** Años con algún partido, del más reciente al más antiguo. */
export async function listMatchYears(userId: string): Promise<number[]> {
  const rows = await db
    .select({ date: matches.matchDate })
    .from(matches)
    .where(eq(matches.userId, userId));
  const years = new Set(rows.map((r) => Number(r.date.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

export async function getMatch(
  userId: string,
  id: string
): Promise<MatchRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.id, id), eq(matches.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createMatch(userId: string, data: MatchData) {
  const [row] = await db
    .insert(matches)
    .values({ userId, ...data })
    .returning();
  return row;
}

export async function updateMatch(userId: string, id: string, data: MatchData) {
  if (!isUuid(id)) return null;
  const [row] = await db
    .update(matches)
    .set(data)
    .where(and(eq(matches.id, id), eq(matches.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteMatch(userId: string, id: string) {
  if (!isUuid(id)) return false;
  const rows = await db
    .delete(matches)
    .where(and(eq(matches.id, id), eq(matches.userId, userId)))
    .returning({ id: matches.id });
  return rows.length > 0;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}
