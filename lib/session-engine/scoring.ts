// Puntuación de candidatos y elección con semilla (softmax sobre los 8
// mejores, no el mejor siempre: "Otra propuesta" da algo distinto sin caer
// en lo mediocre).

import { keywordHits, type ObjectiveFocus } from "./objectives";
import type { Slot } from "./skeleton";
import type { EngineExercise, Focus, Intensity } from "./types";

export type ScoreContext = {
  level: string;
  focus: Exclude<Focus, "auto">;
  intensity: Intensity;
  /** Ejercicios de las 3 y de las 8 últimas sesiones completadas. */
  recent3: Set<string>;
  recent8: Set<string>;
  /** Propuesta anterior ("Otra propuesta" debe cambiar). */
  previousIds: Set<string>;
  prev: EngineExercise | null;
  /** Golpes y aspectos de los objetivos de la sesión. */
  objectives?: ObjectiveFocus;
};

const PREFERRED_CARACTER: Record<Intensity, string> = {
  suave: "cooperativo",
  media: "reto",
  alta: "competitivo",
};

export function scoreExercise(
  ex: EngineExercise,
  slot: Slot,
  ctx: ScoreContext
): number {
  let s = 0;
  if (ex.niveles.includes(ctx.level)) s += 3;
  if (ex.golpes.includes(ctx.focus)) s += 2;
  if (ex.hasSteps) s += 1.5;
  if (ex.hasVariantes) s += 1;
  if (ex.hasMedia) s += 0.8;
  if (ex.ratingAvg !== null) s += 0.5 * (ex.ratingAvg / 5);
  // La intensidad no filtra (exercises.intensity está vacío): prefiere un
  // carácter. En el hueco de puntos ya se exige "competitivo".
  if (
    slot.kind !== "puntos" &&
    ex.caracter.includes(PREFERRED_CARACTER[ctx.intensity])
  )
    s += 1;
  // Objetivos de la sesión: más puntos a lo que trabajan.
  const obj = ctx.objectives;
  if (obj) {
    if (ex.golpes.some((g) => (obj.golpes as string[]).includes(g))) s += 1;
    if (ex.aspectos.some((a) => obj.aspectos.includes(a))) s += 1;
    if ((ex.parametros ?? []).some((p) => obj.parametros.includes(p))) s += 1;
    if ((ex.situaciones ?? []).some((p) => obj.situaciones.includes(p)))
      s += 0.75;
    if (obj.competitivo && ex.caracter.includes("competitivo")) s += 0.5;
    // La ficha dice buscar lo mismo (en su nombre u objetivos).
    s += Math.min(2, 0.5 * keywordHits(obj.keywords, ex.text ?? ""));
  }
  if (ctx.recent3.has(ex.id)) s -= 4;
  else if (ctx.recent8.has(ex.id)) s -= 2;
  if (ctx.previousIds.has(ex.id)) s -= 6;
  if (ctx.prev) {
    if (ex.tipoActividad && ex.tipoActividad === ctx.prev.tipoActividad)
      s -= 1.5;
    if (ex.tipoPelota && ex.tipoPelota === ctx.prev.tipoPelota) s -= 1;
  }
  return s;
}

export function pickWithSeed(
  scored: { ex: EngineExercise; score: number }[],
  rand: () => number
): { ex: EngineExercise; score: number } | null {
  if (scored.length === 0) return null;
  const top = [...scored]
    .sort((a, b) => b.score - a.score || a.ex.id.localeCompare(b.ex.id))
    .slice(0, 8);
  const max = top[0].score;
  const weights = top.map((t) => Math.exp(t.score - max));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[top.length - 1];
}
