/**
 * Colores de los bloques de una sesión (los mismos de la barra de tiempo):
 * Calentamiento azul, Bloque principal verde lima y Vuelta a la calma violeta.
 * Las tarjetas de la sesión se colorean por bloque, no por tipo de ejercicio.
 */
import type { TrainingPhase } from "./analytics";

export const PHASE_BAR: Record<TrainingPhase, string> = {
  activation: "bg-sky-400",
  main: "bg-brand",
  cooldown: "bg-violet-400",
};

export const PHASE_TEXT: Record<TrainingPhase, string> = {
  activation: "text-sky-500",
  main: "text-lime-700 dark:text-brand",
  cooldown: "text-violet-500",
};

export const PHASE_CARD: Record<TrainingPhase, string> = {
  activation: "border-sky-500/40 bg-sky-500/5",
  main: "border-brand/60 bg-brand/10",
  cooldown: "border-violet-500/40 bg-violet-500/5",
};

export const PHASE_LABEL: Record<TrainingPhase, string> = {
  activation: "Calentamiento",
  main: "Bloque principal",
  cooldown: "Vuelta a la calma",
};

/** Bloque 1, 2 o 3 del plan → fase. */
export function phaseFromBlockOrder(order: number | null | undefined): TrainingPhase {
  if (order === 1) return "activation";
  if (order === 3) return "cooldown";
  return "main";
}
