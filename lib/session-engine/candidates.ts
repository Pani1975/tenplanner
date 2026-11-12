// Candidatos de cada hueco, con cascada de relajación (obligatoria por la
// cobertura real de datos: la mitad de los ejercicios no tiene golpes).

import type { SkillLevel } from "@/lib/skill-levels";
import { levelsWithin } from "./level";
import type { Slot } from "./skeleton";
import type { EngineExercise, Focus } from "./types";

export const MAX_RELAX_STEP = 5;
const MIN_CANDIDATES = 3;

export type CandidateContext = {
  levels: SkillLevel[];
  level: string;
  focus: Exclude<Focus, "auto">;
  attendees: number;
  usedIds: Set<string>;
  excludeIds: Set<string>;
  /** Ejercicios de las 3 últimas sesiones completadas. */
  recent3: Set<string>;
};

/** Aspecto que exige el hueco de técnica según el foco. */
function tecnicaAspect(focus: Exclude<Focus, "auto">): string {
  if (focus === "fisico") return "fisico";
  if (focus === "tactica") return "tactica";
  return "tecnica";
}

function isGolpeFocus(focus: string): boolean {
  return focus !== "tactica" && focus !== "fisico";
}

export function matchesSlot(
  ex: EngineExercise,
  slot: Slot,
  ctx: CandidateContext,
  step: number
): boolean {
  if (!ex.fases.includes(slot.phase)) return false;
  if (ctx.usedIds.has(ex.id) || ctx.excludeIds.has(ex.id)) return false;
  if (step < MAX_RELAX_STEP) {
    if (ctx.recent3.has(ex.id)) return false;
    if (ex.numJugadores !== null && ex.numJugadores > ctx.attendees)
      return false;
  }

  // Tipo de hueco.
  if (step < MAX_RELAX_STEP) {
    if (
      slot.kind === "tecnica" &&
      !ex.aspectos.includes(tecnicaAspect(ctx.focus))
    )
      return false;
    if (slot.kind === "tactica" && !ex.aspectos.includes("tactica"))
      return false;
    if (slot.kind === "puntos" && !ex.caracter.includes("competitivo"))
      return false;
  }

  // Golpe del foco (se relaja en el paso 2).
  if (
    step < 2 &&
    isGolpeFocus(ctx.focus) &&
    (slot.kind === "tecnica" || slot.kind === "tactica") &&
    !ex.golpes.includes(ctx.focus)
  )
    return false;

  // Nivel.
  if (step < MAX_RELAX_STEP) {
    const radius = step === 0 ? 0 : step < 4 ? 1 : 2;
    const allowed = levelsWithin(ctx.levels, ctx.level, radius);
    if (!ex.niveles.some((n) => allowed.includes(n))) return false;
  }

  // Duración.
  if (step < MAX_RELAX_STEP) {
    const [lo, hi] = step < 3 ? [0.6, 1.6] : [0.3, 2.5];
    if (ex.durationMinutes < slot.minutes * lo) return false;
    if (ex.durationMinutes > slot.minutes * hi) return false;
  }
  return true;
}

/** Primer paso de la cascada con al menos 3 candidatos (o el último). */
export function findCandidates(
  exercises: readonly EngineExercise[],
  slot: Slot,
  ctx: CandidateContext,
  minStep = 0
): { step: number; list: EngineExercise[] } {
  let last: { step: number; list: EngineExercise[] } = {
    step: minStep,
    list: [],
  };
  for (let step = minStep; step <= MAX_RELAX_STEP; step++) {
    const list = exercises.filter((ex) => matchesSlot(ex, slot, ctx, step));
    last = { step, list };
    if (list.length >= MIN_CANDIDATES) return last;
  }
  return last;
}
