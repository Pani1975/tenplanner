import {
  DEFAULT_BLOCK_ITEM_DURATION,
  emptyStationDraft,
  type AspectoJuego,
  type StationDraftItem,
} from "@/lib/block-items";
import type {
  TrainingPhase,
  WizardExercise,
  WizardSessionBlock,
  WizardState,
} from "./types";

export const TEXT_ITEM_PREFIX = "text-";
export const WARMUP_ITEM_PREFIX = "warmup-";
export const STATIONS_ITEM_PREFIX = "stations-";
/** Misma duración por defecto que usa el servidor al calcular el total. */
export const DEFAULT_TEXT_DURATION = DEFAULT_BLOCK_ITEM_DURATION;

export const BLOCK_DEFAULTS: Array<{ orderIndex: 1 | 2 | 3; title: string }> = [
  { orderIndex: 1, title: "Bloque inicial" },
  { orderIndex: 2, title: "Bloque principal" },
  { orderIndex: 3, title: "Bloque final" },
];

export function isTextItem(item: WizardExercise) {
  return item.kind === "text";
}

export function isWarmupItem(item: WizardExercise) {
  return item.kind === "warmup";
}

export function isStationsItem(item: WizardExercise) {
  return item.kind === "stations";
}

/** Items que son un ejercicio real de la biblioteca (kind indefinido = exercise). */
export function isLibraryExerciseItem(item: WizardExercise) {
  return !item.kind || item.kind === "exercise";
}

function randomKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTextItem(
  text = "",
  phase: TrainingPhase | null = null,
  durationMinutes: number | null = null,
  notes = "",
  title = "",
  aspecto: AspectoJuego | null = null
): WizardExercise {
  return {
    exerciseId: `${TEXT_ITEM_PREFIX}${randomKey()}`,
    kind: "text",
    freeText: text,
    title,
    name: text,
    category: "text",
    durationMinutes: durationMinutes ?? DEFAULT_TEXT_DURATION,
    overrideDuration: durationMinutes,
    notes,
    phase,
    intensity: null,
    aspecto,
  };
}

export function createWarmupItem(
  phase: TrainingPhase | null = null,
  durationMinutes: number | null = null
): WizardExercise {
  return {
    exerciseId: `${WARMUP_ITEM_PREFIX}${randomKey()}`,
    kind: "warmup",
    name: "Descanso",
    category: "warmup",
    durationMinutes: durationMinutes ?? DEFAULT_TEXT_DURATION,
    overrideDuration: durationMinutes,
    notes: "",
    phase,
    intensity: null,
  };
}

export function createStationsItem(
  phase: TrainingPhase | null = null,
  stationCount = 4,
  introText = "",
  /** Duración por estación (la misma para todas), no la suma. */
  durationMinutes: number | null = null
): WizardExercise {
  return {
    exerciseId: `${STATIONS_ITEM_PREFIX}${randomKey()}`,
    kind: "stations",
    freeText: introText,
    stations: Array.from({ length: stationCount }, emptyStationDraft),
    name: "Estaciones",
    category: "stations",
    durationMinutes: durationMinutes ?? DEFAULT_TEXT_DURATION,
    overrideDuration: durationMinutes,
    notes: "",
    phase,
    intensity: null,
  };
}

export function phaseToBlockOrder(phase: TrainingPhase | null): 1 | 2 | 3 {
  if (phase === "activation") return 1;
  if (phase === "cooldown") return 3;
  return 2;
}

export function blockOrderToPhase(order: number): TrainingPhase {
  if (order === 1) return "activation";
  if (order === 3) return "cooldown";
  return "main";
}

export function normalizeBlocks(
  blocks: WizardSessionBlock[] | undefined
): WizardSessionBlock[] {
  const byOrder = new Map(blocks?.map((block) => [block.orderIndex, block]));
  return BLOCK_DEFAULTS.map((fallback) => {
    const block = byOrder.get(fallback.orderIndex);
    return {
      orderIndex: fallback.orderIndex,
      title: block?.title || fallback.title,
      notes: block?.notes ?? "",
      // Los items viven en la línea de tiempo (state.exercises).
      items: [],
    };
  });
}

/**
 * Convierte los textos libres que vengan dentro de bloques (p. ej. de una
 * clase de la biblioteca) en items de la línea de tiempo, para que el monitor
 * los vea y los pueda editar. Los ejercicios de esos bloques ya llegan en
 * `exercises`, así que aquí solo se añaden los textos.
 */
export function textItemsFromBlocks(
  blocks: WizardSessionBlock[] | undefined
): WizardExercise[] {
  if (!blocks) return [];
  return blocks.flatMap((block) => {
    const phase = blockOrderToPhase(block.orderIndex);
    return block.items.flatMap((item): WizardExercise[] => {
      if (item.kind === "warmup") {
        return [createWarmupItem(phase, item.durationMinutes ?? null)];
      }
      if (item.kind === "stations") {
        const stationsItem = createStationsItem(
          phase,
          item.stations?.length || 1,
          item.freeText ?? "",
          item.durationMinutes ?? null
        );
        if (item.stations?.length) stationsItem.stations = item.stations;
        return [stationsItem];
      }
      if (!item.exerciseId && (item.freeText?.trim() || item.title?.trim())) {
        return [
          createTextItem(
            item.freeText?.trim() ?? "",
            phase,
            item.durationMinutes ?? null,
            item.notes ?? "",
            item.title?.trim() ?? "",
            item.aspecto ?? null
          ),
        ];
      }
      return [];
    });
  });
}

export type BlockPayloadItem = {
  kind?: "exercise" | "text" | "warmup" | "stations";
  exerciseId?: string;
  freeText?: string | null;
  title?: string | null;
  durationMinutes: number | null;
  notes: string | null;
  stations?: StationDraftItem[];
  aspecto?: AspectoJuego | null;
};

export type BlockPayload = {
  orderIndex: 1 | 2 | 3;
  title: string;
  notes: string | null;
  items: BlockPayloadItem[];
};

/** Bloques para el servidor, respetando el orden de la línea de tiempo. */
export function buildBlocksPayload(
  state: Pick<WizardState, "blocks" | "exercises">
): BlockPayload[] {
  const blocks = normalizeBlocks(state.blocks);
  const byOrder = new Map<1 | 2 | 3, BlockPayload>(
    blocks.map((block) => [
      block.orderIndex,
      {
        orderIndex: block.orderIndex,
        title: block.title,
        notes: block.notes.trim() || null,
        items: [],
      },
    ])
  );

  for (const item of state.exercises) {
    const block = byOrder.get(phaseToBlockOrder(item.phase))!;
    if (isWarmupItem(item)) {
      block.items.push({
        kind: "warmup",
        durationMinutes: item.overrideDuration ?? null,
        notes: item.notes.trim() || null,
      });
    } else if (isStationsItem(item)) {
      block.items.push({
        kind: "stations",
        freeText: item.freeText?.trim() || null,
        stations: item.stations ?? [],
        durationMinutes: item.overrideDuration ?? null,
        notes: item.notes.trim() || null,
      });
    } else if (isTextItem(item)) {
      const text = item.freeText?.trim() || null;
      const title = item.title?.trim() || null;
      if (!text && !title) continue;
      block.items.push({
        kind: "text",
        freeText: text,
        title,
        durationMinutes: item.overrideDuration ?? null,
        notes: item.notes.trim() || null,
        aspecto: item.aspecto ?? null,
      });
    } else {
      block.items.push({
        kind: "exercise",
        exerciseId: item.exerciseId,
        durationMinutes: item.overrideDuration ?? null,
        notes: item.notes.trim() || null,
      });
    }
  }

  return BLOCK_DEFAULTS.map((block) => byOrder.get(block.orderIndex)!);
}

/** Lista plana de ejercicios de la biblioteca (compatibilidad del servidor). */
export function buildExercisesPayload(state: Pick<WizardState, "exercises">) {
  return state.exercises
    .filter((item) => isLibraryExerciseItem(item))
    .map((exercise) => ({
      exerciseId: exercise.exerciseId,
      durationMinutes: exercise.overrideDuration ?? null,
      notes: exercise.notes.trim() || null,
      phase: exercise.phase,
      intensity: exercise.intensity,
    }));
}

/**
 * Duración total real de la línea de tiempo: la suma de cada item tal y
 * como la ve el monitor (duración editada a mano, o la de por defecto si
 * no la ha tocado). Esta es la duración "de verdad" de la sesión — el
 * campo "Duración" del paso 1 se mantiene sincronizado con este valor en
 * cuanto hay contenido, para que nunca se quede desactualizado.
 */
export function computeTimelineDuration(
  state: Pick<WizardState, "exercises">
): number {
  return state.exercises.reduce(
    (sum, e) => sum + (e.overrideDuration ?? e.durationMinutes),
    0
  );
}

export function hasPlanContent(state: Pick<WizardState, "exercises">) {
  return state.exercises.some(
    (item) =>
      isLibraryExerciseItem(item) ||
      isWarmupItem(item) ||
      isStationsItem(item) ||
      !!item.freeText?.trim() ||
      !!item.title?.trim()
  );
}

type PlanItemLike =
  | {
      kind: "exercise";
      exerciseId: string;
      name: string;
      category: string;
      defaultDurationMinutes: number;
      durationMinutes: number | null;
      notes: string | null;
      phase: TrainingPhase;
    }
  | {
      kind: "text";
      text: string;
      title: string | null;
      durationMinutes: number | null;
      notes: string | null;
      phase: TrainingPhase;
      aspecto?: AspectoJuego | null;
    }
  | {
      kind: "warmup";
      durationMinutes: number | null;
      notes: string | null;
      phase: TrainingPhase;
    }
  | {
      kind: "stations";
      introText: string | null;
      stations: Array<{
        kind: "exercise" | "text";
        exerciseId: string | null;
        exerciseName: string | null;
        freeText: string | null;
        durationMinutes: number | null;
      }>;
      durationMinutes: number | null;
      notes: string | null;
      phase: TrainingPhase;
    };

/** Plan guardado de una sesión → línea de tiempo del creador. */
export function planItemsToWizard(items: PlanItemLike[]): WizardExercise[] {
  return items.map((item) => {
    if (item.kind === "text") {
      return createTextItem(
        item.text,
        item.phase,
        item.durationMinutes,
        item.notes ?? "",
        item.title ?? "",
        item.aspecto ?? null
      );
    }
    if (item.kind === "warmup") {
      return createWarmupItem(item.phase, item.durationMinutes);
    }
    if (item.kind === "stations") {
      const draftStations: StationDraftItem[] = item.stations.map((s) => ({
        kind: s.kind,
        exerciseId: s.exerciseId,
        name: s.exerciseName ?? "",
        freeText: s.freeText ?? "",
        durationMinutes: s.durationMinutes,
      }));
      const stationsItem = createStationsItem(
        item.phase,
        draftStations.length || 1,
        item.introText ?? "",
        item.durationMinutes
      );
      if (draftStations.length) stationsItem.stations = draftStations;
      stationsItem.notes = item.notes ?? "";
      return stationsItem;
    }
    return {
      exerciseId: item.exerciseId,
      kind: "exercise",
      name: item.name,
      category: item.category,
      durationMinutes: item.durationMinutes ?? item.defaultDurationMinutes,
      overrideDuration: item.durationMinutes ?? null,
      notes: item.notes ?? "",
      phase: item.phase,
      intensity: null,
    };
  });
}
