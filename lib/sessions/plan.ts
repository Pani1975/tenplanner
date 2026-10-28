import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
} from "@/db/schema";
import {
  resolveItemKind,
  type AspectoJuego,
  type StationItemJson,
} from "@/lib/block-items";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";

export type SessionPlanPhase = "activation" | "main" | "cooldown";

type ExerciseDetails = {
  exerciseId: string;
  name: string;
  description: string | null;
  category: string;
  difficulty: string;
  defaultDurationMinutes: number;
  steps: Array<{ title: string; description: string }>;
  tips: string | null;
  materials: string[];
};

export type SessionPlanItem =
  | ({
      kind: "exercise";
      key: string;
      phase: SessionPlanPhase;
      blockOrder: 1 | 2 | 3;
      durationMinutes: number | null;
      notes: string | null;
    } & ExerciseDetails)
  | {
      kind: "text";
      key: string;
      phase: SessionPlanPhase;
      blockOrder: 1 | 2 | 3;
      text: string;
      title: string | null;
      /** Descripción guardada (p. ej. de un ejercicio que ya no existe). */
      description: string | null;
      durationMinutes: number | null;
      notes: string | null;
      /** Aspecto del juego elegido para este texto libre, si lo tiene. */
      aspecto: AspectoJuego | null;
    }
  | {
      kind: "warmup";
      key: string;
      phase: SessionPlanPhase;
      blockOrder: 1 | 2 | 3;
      durationMinutes: number | null;
      notes: string | null;
    }
  | {
      kind: "stations";
      key: string;
      phase: SessionPlanPhase;
      blockOrder: 1 | 2 | 3;
      introText: string | null;
      stations: StationItemJson[];
      durationMinutes: number | null;
      notes: string | null;
    };

export type SessionPlanBlock = {
  orderIndex: 1 | 2 | 3;
  title: string;
  notes: string | null;
};

export type SessionPlan = {
  blocks: SessionPlanBlock[];
  items: SessionPlanItem[];
};

export const BLOCK_TITLES: Record<1 | 2 | 3, string> = {
  1: "Bloque inicial",
  2: "Bloque principal",
  3: "Bloque final",
};

export function blockOrderFromIndex(value: number): 1 | 2 | 3 {
  return value === 1 || value === 3 ? value : 2;
}

export function phaseFromBlockOrder(order: number): SessionPlanPhase {
  if (order === 1) return "activation";
  if (order === 3) return "cooldown";
  return "main";
}

export function blockOrderFromPhase(
  phase: string | null | undefined
): 1 | 2 | 3 {
  if (phase === "activation") return 1;
  if (phase === "cooldown") return 3;
  return 2;
}

function toSteps(
  value: unknown
): Array<{ title: string; description: string }> {
  return Array.isArray(value)
    ? (value as Array<{ title: string; description: string }>)
    : [];
}

function toStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/**
 * Plan completo de una sesión, en orden: bloques y, dentro de cada bloque,
 * ejercicios de la biblioteca y textos libres tal como los ordenó el monitor.
 * Para sesiones antiguas sin bloques, se reconstruye desde session_exercises.
 */
export async function loadSessionPlan(
  sessionId: string,
  viewerId: string
): Promise<SessionPlan> {
  const rows = await db
    .select({
      blockOrder: sessionBlocks.orderIndex,
      blockTitle: sessionBlocks.title,
      blockNotes: sessionBlocks.notes,
      itemId: sessionBlockItems.id,
      itemOrder: sessionBlockItems.orderIndex,
      itemExerciseId: sessionBlockItems.exerciseId,
      itemExerciseName: sessionBlockItems.exerciseName,
      itemExerciseDescription: sessionBlockItems.exerciseDescription,
      itemFreeText: sessionBlockItems.freeText,
      itemTitle: sessionBlockItems.title,
      itemDuration: sessionBlockItems.durationMinutes,
      itemNotes: sessionBlockItems.notes,
      itemKind: sessionBlockItems.kind,
      itemStations: sessionBlockItems.stations,
      itemAspectoJuego: sessionBlockItems.aspectoJuego,
      exId: exercises.id,
      exName: exercises.name,
      exDescription: exercises.description,
      exCategory: exercises.category,
      exDifficulty: exercises.difficulty,
      exDuration: exercises.durationMinutes,
      exSteps: exercises.steps,
      exTips: exercises.tips,
      exMaterials: exercises.materials,
    })
    .from(sessionBlocks)
    .leftJoin(
      sessionBlockItems,
      eq(sessionBlockItems.blockId, sessionBlocks.id)
    )
    .leftJoin(
      exercises,
      and(
        eq(exercises.id, sessionBlockItems.exerciseId),
        exerciseVisibleToUserCondition(viewerId)
      )
    )
    .where(eq(sessionBlocks.sessionId, sessionId))
    .orderBy(asc(sessionBlocks.orderIndex), asc(sessionBlockItems.orderIndex));

  const hasBlockItems = rows.some((row) => row.itemId !== null);

  const blockMap = new Map<1 | 2 | 3, SessionPlanBlock>();
  for (const row of rows) {
    const order = blockOrderFromIndex(row.blockOrder);
    if (!blockMap.has(order)) {
      blockMap.set(order, {
        orderIndex: order,
        title: row.blockTitle || BLOCK_TITLES[order],
        notes: row.blockNotes ?? null,
      });
    }
  }
  const blocks = ([1, 2, 3] as const).map(
    (order) =>
      blockMap.get(order) ?? {
        orderIndex: order,
        title: BLOCK_TITLES[order],
        notes: null,
      }
  );

  if (hasBlockItems) {
    const items: SessionPlanItem[] = [];
    for (const row of rows) {
      if (row.itemId === null) continue;
      const order = blockOrderFromIndex(row.blockOrder);
      const phase = phaseFromBlockOrder(order);
      const itemKind = resolveItemKind({
        kind: row.itemKind,
        exerciseId: row.itemExerciseId,
        freeText: row.itemFreeText,
      });
      if (itemKind === "warmup") {
        items.push({
          kind: "warmup",
          key: row.itemId,
          phase,
          blockOrder: order,
          durationMinutes: row.itemDuration ?? null,
          notes: row.itemNotes ?? null,
        });
        continue;
      }
      if (itemKind === "stations") {
        items.push({
          kind: "stations",
          key: row.itemId,
          phase,
          blockOrder: order,
          introText: row.itemFreeText ?? null,
          stations: (row.itemStations as StationItemJson[] | null) ?? [],
          durationMinutes: row.itemDuration ?? null,
          notes: row.itemNotes ?? null,
        });
        continue;
      }
      if (row.exId && row.exName && row.exCategory && row.exDifficulty) {
        items.push({
          kind: "exercise",
          key: row.itemId,
          phase,
          blockOrder: order,
          exerciseId: row.exId,
          name: row.exName,
          description: row.exDescription ?? null,
          category: row.exCategory,
          difficulty: row.exDifficulty,
          defaultDurationMinutes: row.exDuration ?? 0,
          steps: toSteps(row.exSteps),
          tips: row.exTips ?? null,
          materials: toStrings(row.exMaterials),
          durationMinutes: row.itemDuration ?? null,
          notes: row.itemNotes ?? null,
        });
        continue;
      }
      const text = row.itemFreeText?.trim() || row.itemExerciseName?.trim();
      const title = row.itemTitle?.trim() || null;
      if (!text && !title) continue;
      items.push({
        kind: "text",
        key: row.itemId,
        phase,
        blockOrder: order,
        text: text ?? "",
        title,
        description:
          row.itemFreeText || row.itemExerciseId
            ? null
            : (row.itemExerciseDescription ?? null),
        durationMinutes: row.itemDuration ?? null,
        notes: row.itemNotes ?? null,
        aspecto: (row.itemAspectoJuego as AspectoJuego | null) ?? null,
      });
    }
    return { blocks, items };
  }

  // Sesiones antiguas: solo session_exercises.
  const legacy = await db
    .select({
      id: sessionExercises.id,
      phase: sessionExercises.phase,
      durationMinutes: sessionExercises.durationMinutes,
      notes: sessionExercises.notes,
      exId: exercises.id,
      exName: exercises.name,
      exDescription: exercises.description,
      exCategory: exercises.category,
      exDifficulty: exercises.difficulty,
      exDuration: exercises.durationMinutes,
      exSteps: exercises.steps,
      exTips: exercises.tips,
      exMaterials: exercises.materials,
    })
    .from(sessionExercises)
    .innerJoin(
      exercises,
      and(
        eq(exercises.id, sessionExercises.exerciseId),
        exerciseVisibleToUserCondition(viewerId)
      )
    )
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(asc(sessionExercises.orderIndex));

  const items: SessionPlanItem[] = legacy.map((row) => {
    const order = blockOrderFromPhase(row.phase);
    return {
      kind: "exercise",
      key: row.id,
      phase: phaseFromBlockOrder(order),
      blockOrder: order,
      exerciseId: row.exId,
      name: row.exName,
      description: row.exDescription ?? null,
      category: row.exCategory,
      difficulty: row.exDifficulty,
      defaultDurationMinutes: row.exDuration ?? 0,
      steps: toSteps(row.exSteps),
      tips: row.exTips ?? null,
      materials: toStrings(row.exMaterials),
      durationMinutes: row.durationMinutes ?? null,
      notes: row.notes ?? null,
    };
  });
  // Mantener el orden por bloque (inicial, principal, final).
  items.sort((a, b) => a.blockOrder - b.blockOrder);
  return { blocks, items };
}
