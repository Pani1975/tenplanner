// Shared types for the "block item" building blocks used by both classes
// (class_blocks / class_block_exercises) and sessions
// (session_blocks / session_block_items).
//
// Historically an item was either an "exercise" (exerciseId set) or a
// "text" (freeText set), inferred from which column was populated. We now
// support two more kinds that need an explicit discriminator:
//   - "warmup": only asks for a duration (no exercise/text content).
//   - "stations": 2-10 sub-items ("estaciones"), each itself an exercise or
//     a free text, plus an optional intro/description (stored in the
//     item's own `freeText` column).
//
// `kind` is nullable in the DB for backwards compatibility: rows written
// before this feature have `kind = null` and must keep being inferred the
// old way (exerciseId -> "exercise", else freeText -> "text").

export const BLOCK_ITEM_KINDS = [
  "exercise",
  "text",
  "warmup",
  "stations",
] as const;

export type BlockItemKind = (typeof BLOCK_ITEM_KINDS)[number];

// Aspecto del juego con el que se puede etiquetar un item de texto libre,
// descanso o estaciones que no tiene ficha de ejercicio propia (misma
// clasificación que `exercises.aspectoJuego`). Se usa para que las
// estadísticas de la sesión puedan contar su tiempo por categoría aunque
// el monitor no haya creado un ejercicio completo.
export const ASPECTO_JUEGO_VALUES = [
  "tecnica",
  "tactica",
  "fisico",
  "mental",
] as const;

export type AspectoJuego = (typeof ASPECTO_JUEGO_VALUES)[number];

export const STATION_COUNT_MIN = 2;
export const STATION_COUNT_MAX = 10;

// A single "estación" inside a stations item. Stored as jsonb — exerciseName
// is a denormalized snapshot (taken at write time) so rendering a station
// never needs an extra join/query.
export interface StationItemJson {
  kind: "exercise" | "text";
  exerciseId: string | null;
  exerciseName: string | null;
  freeText: string | null;
  durationMinutes: number | null;
}

// Mutable, UI-side shape of a single station while it's being edited (before
// it's serialized into a StationItemJson for the API/DB).
export interface StationDraftItem {
  kind: "exercise" | "text";
  exerciseId: string | null;
  name: string;
  freeText: string;
  durationMinutes: number | null;
}

export function emptyStationDraft(): StationDraftItem {
  return {
    kind: "text",
    exerciseId: null,
    name: "",
    freeText: "",
    durationMinutes: null,
  };
}

export function resolveItemKind(item: {
  kind?: string | null;
  exerciseId?: string | null;
  freeText?: string | null;
}): BlockItemKind {
  if (item.kind === "warmup" || item.kind === "stations") return item.kind;
  if (item.exerciseId) return "exercise";
  return "text";
}

// Duración por defecto para un item sin duración explícita y sin ejercicio
// de biblioteca del que heredarla (texto libre, descanso, o estaciones).
// Compartida por el creador de sesiones (línea de tiempo) y por el cálculo
// de la duración total en el servidor, para que ambos coincidan siempre.
export const DEFAULT_BLOCK_ITEM_DURATION = 5;

/**
 * Duración efectiva de un item de bloque: su propia duración si la tiene,
 * si no la del ejercicio de biblioteca (cuando aplica), si no el valor por
 * defecto. Usado para calcular la duración total real de una sesión/clase
 * a partir de su contenido, en vez de depender de un número introducido a
 * mano que puede quedar desactualizado.
 */
export function resolveBlockItemDuration(
  item: {
    kind?: string | null;
    exerciseId?: string | null;
    freeText?: string | null;
    durationMinutes?: number | null;
  },
  exerciseDurationById: Map<string, number>
): number {
  if (typeof item.durationMinutes === "number") return item.durationMinutes;
  const kind = resolveItemKind(item);
  if (kind === "exercise") {
    return item.exerciseId
      ? (exerciseDurationById.get(item.exerciseId) ?? 0)
      : 0;
  }
  return DEFAULT_BLOCK_ITEM_DURATION;
}

/**
 * Suma la duración real de todos los items de una lista de bloques
 * (ejercicios, textos libres, descansos y estaciones), resolviendo
 * duraciones por defecto donde falten. Esta es la duración "de verdad" de
 * la sesión/clase: la que ve el monitor al construir el plan.
 */
export function sumBlocksDuration(
  blocks: Array<{
    items: Array<{
      kind?: string | null;
      exerciseId?: string | null;
      freeText?: string | null;
      durationMinutes?: number | null;
    }>;
  }>,
  exerciseDurationById: Map<string, number>
): number {
  return blocks.reduce(
    (sum, block) =>
      sum +
      block.items.reduce(
        (blockSum, item) =>
          blockSum + resolveBlockItemDuration(item, exerciseDurationById),
        0
      ),
    0
  );
}
