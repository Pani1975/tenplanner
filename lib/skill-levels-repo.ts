import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { skillLevels } from "@/db/schema";
import type { SkillLevel } from "@/lib/skill-levels";

// Catálogo que solo cambia con migraciones: se guarda en memoria unos minutos.
const LEVELS_TTL_MS = 10 * 60_000;
let levelsCache: { at: number; rows: Promise<SkillLevel[]> } | null = null;

/** Todos los niveles de la tabla skill_levels. */
export async function loadSkillLevels(): Promise<SkillLevel[]> {
  const now = Date.now();
  if (levelsCache && now - levelsCache.at < LEVELS_TTL_MS) {
    return levelsCache.rows;
  }
  const rows = db
    .select({
      code: skillLevels.code,
      sport: skillLevels.sport,
      track: skillLevels.track,
      position: skillLevels.position,
      labelEs: skillLevels.labelEs,
    })
    .from(skillLevels)
    .then((r) => r as SkillLevel[]);
  levelsCache = { at: now, rows };
  rows.catch(() => {
    levelsCache = null;
  });
  return rows;
}

/** Códigos de la lista que no existen en skill_levels (sin repetir). */
export async function invalidSkillLevelCodes(
  codes: readonly (string | null | undefined)[]
): Promise<string[]> {
  const wanted = Array.from(
    new Set(codes.filter((c): c is string => typeof c === "string" && !!c))
  );
  if (wanted.length === 0) return [];
  const rows = await db
    .select({ code: skillLevels.code })
    .from(skillLevels)
    .where(inArray(skillLevels.code, wanted));
  const found = new Set(rows.map((r) => r.code));
  return wanted.filter((c) => !found.has(c));
}
