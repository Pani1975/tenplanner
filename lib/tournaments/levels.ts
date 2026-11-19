// Niveles para torneos: la escala de la app (skill_levels) mostrada con su
// bola en tenis, que es como la reconocen monitores y familias:
// "Bola roja · Descubrimiento", "Bola amarilla · Competición"…

import { BALLS, LEVEL_TO_BALL } from "@/lib/objectives-taxonomy";
import { skillLevelsForSport, type SkillLevel } from "@/lib/skill-levels";

export type LevelOption = { code: string; label: string; color: string | null };

export function levelOptions(
  levels: readonly SkillLevel[],
  sport: string
): LevelOption[] {
  return skillLevelsForSport(levels, sport).map((l) => {
    const ball = BALLS.find((b) => b.id === LEVEL_TO_BALL[l.code]);
    if (!ball || sport === "padel") {
      return { code: l.code, label: l.labelEs, color: null };
    }
    return {
      code: l.code,
      label: `Bola ${ball.label.toLowerCase()} · ${l.labelEs}`,
      color: ball.color,
    };
  });
}
