// Estadística de entrenamiento de un grupo o un alumno a partir del plan de
// sus sesiones ya pasadas: horas jugadas, ejercicio más hecho, tiempo por
// fase, aspectos del juego, tipos de ejercicio y golpes.
//
// Reglas de reparto (acordadas con el monitor):
// - Los descansos suman a las horas y al tiempo de su fase, pero no a
//   aspectos, tipos ni golpes.
// - Un elemento con varios aspectos o varios tipos reparte su tiempo a
//   partes iguales entre ellos.
// - Golpes: si el ejercicio es de peloteo, cada golpe suma el tiempo entero
//   (aunque sean varios y aunque también sea de puntos). Si no es peloteo y
//   es un juego de puntos, no suma a golpes. En el resto, el tiempo se
//   reparte a partes iguales entre sus golpes.
// - Las estaciones reparten su tiempo a partes iguales entre las estaciones,
//   y cada estación aplica estas mismas reglas.

import {
  DEFAULT_BLOCK_ITEM_DURATION,
  resolveItemKind,
} from "@/lib/block-items";

export type StatPhase = "activation" | "main" | "cooldown";
export type StatAspect = "tecnica" | "tactica" | "fisico" | "mental";

export const STAT_PHASES: StatPhase[] = ["activation", "main", "cooldown"];
export const STAT_ASPECTS: StatAspect[] = [
  "tecnica",
  "tactica",
  "fisico",
  "mental",
];

/** Datos de biblioteca de un ejercicio que importan para la estadística. */
export interface StatExerciseInfo {
  name: string;
  category?: string | null;
  durationMinutes?: number | null;
  aspectos?: string[] | null;
  aspecto?: string | null;
  tipos?: string[] | null;
  tipo?: string | null;
  golpes?: string[] | null;
}

export interface StatStation {
  kind?: string | null;
  exerciseId?: string | null;
  freeText?: string | null;
}

export interface StatItem {
  kind?: string | null;
  exerciseId?: string | null;
  exerciseName?: string | null;
  title?: string | null;
  freeText?: string | null;
  durationMinutes?: number | null;
  /** Aspecto etiquetado en un texto libre (sin ejercicio). */
  aspectoJuego?: string | null;
  stations?: StatStation[] | null;
}

export interface StatBlock {
  orderIndex: number;
  items: StatItem[];
}

export interface StatSession {
  id: string;
  durationMinutes: number;
  blocks: StatBlock[];
}

export interface Share<K extends string = string> {
  key: K;
  minutes: number;
  pct: number;
}

export interface TopExercise {
  key: string;
  name: string;
  times: number;
  minutes: number;
}

export interface TrainingStats {
  sessionCount: number;
  /** Suma de la duración de las sesiones (la que figura en cada sesión). */
  totalMinutes: number;
  phases: Share<StatPhase>[];
  aspects: Share<StatAspect>[];
  types: Share[];
  strokes: Share[];
  topExercises: TopExercise[];
}

const CATEGORY_TO_ASPECT: Record<string, StatAspect> = {
  technique: "tecnica",
  tactics: "tactica",
  fitness: "fisico",
  "warm-up": "fisico",
};

function phaseOfBlock(orderIndex: number): StatPhase {
  if (orderIndex <= 1) return "activation";
  if (orderIndex >= 3) return "cooldown";
  return "main";
}

function isRest(item: StatItem, info?: StatExerciseInfo): boolean {
  if (resolveItemKind(item) === "warmup") return true;
  const name = (item.title ?? info?.name ?? item.exerciseName ?? "")
    .trim()
    .toLowerCase();
  return name === "descanso" || name.startsWith("descanso ");
}

function add(map: Map<string, number>, key: string, minutes: number) {
  if (minutes <= 0) return;
  map.set(key, (map.get(key) ?? 0) + minutes);
}

function list(values: (string | null | undefined)[] | null | undefined) {
  return Array.from(
    new Set((values ?? []).filter((v): v is string => !!v?.trim()))
  );
}

/** Golpes y minutos que aporta un ejercicio según las reglas de reparto. */
export function strokeMinutes(
  info: StatExerciseInfo | undefined,
  minutes: number
): Map<string, number> {
  const out = new Map<string, number>();
  const golpes = list(info?.golpes);
  if (!info || golpes.length === 0 || minutes <= 0) return out;
  const tipos = list([...(info.tipos ?? []), info.tipo]);
  if (tipos.includes("peloteo")) {
    for (const g of golpes) add(out, g, minutes);
    return out;
  }
  if (tipos.includes("juego_puntos")) return out;
  for (const g of golpes) add(out, g, minutes / golpes.length);
  return out;
}

function shares<K extends string>(
  map: Map<string, number>,
  order?: K[]
): Share<K>[] {
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
  const keys = order ?? (Array.from(map.keys()) as K[]);
  return keys
    .map((key) => {
      const minutes = map.get(key) ?? 0;
      return { key, minutes, pct: total > 0 ? (minutes / total) * 100 : 0 };
    })
    .filter((s) => order || s.minutes > 0)
    .sort((a, b) => (order ? 0 : b.minutes - a.minutes));
}

export function computeTrainingStats(
  sessions: StatSession[],
  exercises: Map<string, StatExerciseInfo>
): TrainingStats {
  const phase = new Map<string, number>();
  const aspect = new Map<string, number>();
  const type = new Map<string, number>();
  const stroke = new Map<string, number>();
  const exerciseUse = new Map<string, TopExercise>();

  // Aplica aspectos, tipos y golpes de un ejercicio (o texto) a sus minutos.
  function tally(
    piece: { exerciseId?: string | null; aspectoJuego?: string | null },
    minutes: number,
    label: string | null
  ) {
    const info = piece.exerciseId ? exercises.get(piece.exerciseId) : undefined;
    const aspects = info
      ? list(info.aspectos).length
        ? list(info.aspectos)
        : list([info.aspecto, CATEGORY_TO_ASPECT[info.category ?? ""]])
      : list([piece.aspectoJuego]);
    const validAspects = aspects.filter((a): a is StatAspect =>
      (STAT_ASPECTS as string[]).includes(a)
    );
    for (const a of validAspects) add(aspect, a, minutes / validAspects.length);

    const tipos = info ? list([...(info.tipos ?? []), info.tipo]) : [];
    for (const t of tipos) add(type, t, minutes / tipos.length);

    for (const [g, m] of strokeMinutes(info, minutes)) add(stroke, g, m);

    const key = piece.exerciseId ?? (label ? `texto:${label}` : null);
    const name = info?.name ?? label;
    if (key && name) {
      const prev = exerciseUse.get(key) ?? { key, name, times: 0, minutes: 0 };
      prev.times += 1;
      prev.minutes += minutes;
      exerciseUse.set(key, prev);
    }
  }

  let totalMinutes = 0;
  for (const session of sessions) {
    totalMinutes += session.durationMinutes;
    for (const block of session.blocks) {
      const p = phaseOfBlock(block.orderIndex);
      for (const item of block.items) {
        const info = item.exerciseId
          ? exercises.get(item.exerciseId)
          : undefined;
        const minutes =
          typeof item.durationMinutes === "number"
            ? item.durationMinutes
            : resolveItemKind(item) === "exercise"
              ? (info?.durationMinutes ?? DEFAULT_BLOCK_ITEM_DURATION)
              : DEFAULT_BLOCK_ITEM_DURATION;
        add(phase, p, minutes);
        if (isRest(item, info)) continue;

        if (resolveItemKind(item) === "stations") {
          const stations = item.stations ?? [];
          if (stations.length === 0) continue;
          for (const st of stations) {
            tally(st, minutes / stations.length, st.freeText?.trim() || null);
          }
          continue;
        }
        tally(
          item,
          minutes,
          item.title?.trim() ||
            item.exerciseName?.trim() ||
            item.freeText?.trim().slice(0, 60) ||
            null
        );
      }
    }
  }

  return {
    sessionCount: sessions.length,
    totalMinutes,
    phases: shares(phase, STAT_PHASES),
    aspects: shares(aspect, STAT_ASPECTS),
    types: shares(type),
    strokes: shares(stroke),
    topExercises: Array.from(exerciseUse.values())
      .sort((a, b) => b.times - a.times || b.minutes - a.minutes)
      .slice(0, 5),
  };
}
