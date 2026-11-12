// Nivel del grupo para la clase de hoy y distancias en la escalera.

import type { SkillLevel } from "@/lib/skill-levels";
import type { LevelSource } from "./types";

export const FALLBACK_LEVEL = "descubrimiento";

/**
 * Cascada de F1: moda de los niveles de los que vienen (empate → el más
 * bajo) → nivel por defecto del grupo → "descubrimiento".
 * (En F2, student_skills entra delante de todo.)
 */
export function resolveGroupLevel(
  levels: readonly SkillLevel[],
  attendeeLevels: readonly (string | null)[],
  groupDefault: string | null
): { code: string; source: LevelSource } {
  const known = new Map(levels.map((l) => [l.code, l]));
  const counts = new Map<string, number>();
  for (const code of attendeeLevels) {
    if (code && known.has(code)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  if (counts.size > 0) {
    const best = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return rank(known.get(a[0])!) - rank(known.get(b[0])!);
    })[0];
    return { code: best[0], source: "asistentes" };
  }
  if (groupDefault && known.has(groupDefault)) {
    return { code: groupDefault, source: "grupo" };
  }
  return { code: FALLBACK_LEVEL, source: "defecto" };
}

/** Orden para desempatar hacia "el más bajo" (base antes que adultos). */
function rank(l: SkillLevel): number {
  return (l.track === "base" ? 0 : 100) + l.position;
}

/**
 * Niveles a una distancia máxima `radius` del nivel dado, en su misma
 * escala y vía. Incluye el propio nivel.
 */
export function levelsWithin(
  levels: readonly SkillLevel[],
  code: string,
  radius: number
): string[] {
  const center = levels.find((l) => l.code === code);
  if (!center) return [code];
  return levels
    .filter(
      (l) =>
        l.sport === center.sport &&
        l.track === center.track &&
        Math.abs(l.position - center.position) <= radius
    )
    .map((l) => l.code);
}

/** Nivel desplazado `shift` posiciones (se queda en los extremos). */
export function shiftLevel(
  levels: readonly SkillLevel[],
  code: string,
  shift: number
): string {
  if (shift === 0) return code;
  const center = levels.find((l) => l.code === code);
  if (!center) return code;
  const same = levels
    .filter((l) => l.sport === center.sport && l.track === center.track)
    .sort((a, b) => a.position - b.position);
  const idx = same.findIndex((l) => l.code === code);
  const next = Math.min(same.length - 1, Math.max(0, idx + shift));
  return same[next].code;
}

export function levelLabel(
  levels: readonly SkillLevel[],
  code: string
): string {
  return levels.find((l) => l.code === code)?.labelEs ?? code;
}
