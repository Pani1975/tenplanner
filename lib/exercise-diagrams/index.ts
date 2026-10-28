import raw from "./diagrams.json";
import animated from "./diagrams-animated.json";
import type { Diagram, DiagramMap } from "./types";

// "diagrams-animated" son los ejercicios de Ten Planner con animación (piloto):
// los hay automáticos (sin choreo) y currados (con choreo).
const diagrams = {
  ...(raw as unknown as DiagramMap),
  ...(animated as unknown as DiagramMap),
} as DiagramMap;

/** Esquema de pista de un ejercicio de la biblioteca (si se ha dibujado). */
export function getExerciseDiagram(
  exerciseId: string | null | undefined
): Diagram | null {
  if (!exerciseId) return null;
  return diagrams[exerciseId] ?? null;
}

export function getExerciseDiagrams(
  exerciseIds: Array<string | null | undefined>
): Record<string, Diagram> {
  const out: Record<string, Diagram> = {};
  for (const id of exerciseIds) {
    if (id && diagrams[id]) out[id] = diagrams[id];
  }
  return out;
}

export function countExerciseDiagrams() {
  return Object.keys(diagrams).length;
}
