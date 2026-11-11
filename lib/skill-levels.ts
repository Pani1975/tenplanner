// Escalera de niveles (tabla skill_levels, migración 0094). Aquí solo hay
// tipos y funciones puras; la lectura de la base está en
// lib/skill-levels-repo.ts.

export type SkillLevelSport = "tenis" | "padel" | "pickleball" | "tenis_playa";

export type SkillLevel = {
  code: string;
  sport: SkillLevelSport;
  /** "base" o "adultos" (vía paralela). */
  track: string;
  /** Orden dentro de (sport, track), de menor a mayor. */
  position: number;
  labelEs: string;
};

/**
 * Escala que usa un deporte. Pádel tiene la suya; pickleball y tenis playa
 * usan la de tenis, igual que el resto de la app (nivelesForSport).
 */
export function scaleSportFor(
  sport: string | null | undefined
): SkillLevelSport {
  return sport === "padel" ? "padel" : "tenis";
}

const TRACK_ORDER: Record<string, number> = { base: 0, adultos: 1 };

/** Niveles de la escala de un deporte, en orden: vía base y luego adultos. */
export function skillLevelsForSport(
  levels: readonly SkillLevel[],
  sport: string | null | undefined
): SkillLevel[] {
  const scale = scaleSportFor(sport);
  return levels
    .filter((l) => l.sport === scale)
    .sort(
      (a, b) =>
        (TRACK_ORDER[a.track] ?? 9) - (TRACK_ORDER[b.track] ?? 9) ||
        a.position - b.position
    );
}

/** ¿El código pertenece a la escala de ese deporte? */
export function isLevelOfSport(
  levels: readonly SkillLevel[],
  code: string,
  sport: string | null | undefined
): boolean {
  const scale = scaleSportFor(sport);
  return levels.some((l) => l.code === code && l.sport === scale);
}
