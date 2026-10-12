import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises, classBlockExercises, classBlocks } from "@/db/schema";
import { resolveItemKind, type StationItemJson } from "@/lib/block-items";
import {
  BLOCK_TITLES,
  blockOrderFromIndex,
  phaseFromBlockOrder,
  type SessionPlanBlock,
  type SessionPlanItem,
  type SessionPlanPhase,
} from "@/lib/sessions/plan";

// Plan de una clase de biblioteca, con la misma forma que el de una sesión
// (ver lib/sessions/plan.ts) para poder reutilizar el PDF y otras vistas.
// A diferencia de session_block_items, class_block_exercises no guarda una
// copia (snapshot) del nombre/descripción del ejercicio, así que siempre se
// obtienen al vuelo mediante join con la tabla exercises.

export type ClassPlanBlock = SessionPlanBlock;
export type ClassPlanItem = SessionPlanItem;

export type ClassPlan = {
  blocks: ClassPlanBlock[];
  items: ClassPlanItem[];
};

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

export async function loadClassPlan(classId: string): Promise<ClassPlan> {
  const rows = await db
    .select({
      blockOrder: classBlocks.orderIndex,
      blockTitle: classBlocks.title,
      blockNotes: classBlocks.notes,
      itemId: classBlockExercises.id,
      itemExerciseId: classBlockExercises.exerciseId,
      itemFreeText: classBlockExercises.freeText,
      itemTitle: classBlockExercises.title,
      itemDuration: classBlockExercises.durationMinutes,
      itemKind: classBlockExercises.kind,
      itemStations: classBlockExercises.stations,
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
    .from(classBlocks)
    .leftJoin(
      classBlockExercises,
      eq(classBlockExercises.blockId, classBlocks.id)
    )
    .leftJoin(exercises, eq(exercises.id, classBlockExercises.exerciseId))
    .where(eq(classBlocks.classId, classId))
    .orderBy(asc(classBlocks.orderIndex), asc(classBlockExercises.orderIndex));

  const blockMap = new Map<1 | 2 | 3, ClassPlanBlock>();
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

  const items: ClassPlanItem[] = [];
  for (const row of rows) {
    if (row.itemId === null) continue;
    const order = blockOrderFromIndex(row.blockOrder);
    const phase: SessionPlanPhase = phaseFromBlockOrder(order);
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
        notes: null,
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
        notes: null,
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
        notes: null,
      });
      continue;
    }
    const text = row.itemFreeText?.trim();
    const title = row.itemTitle?.trim() || null;
    if (!text && !title) continue;
    items.push({
      kind: "text",
      key: row.itemId,
      phase,
      blockOrder: order,
      text: text || title || "",
      title,
      description: null,
      durationMinutes: row.itemDuration ?? null,
      notes: null,
      // La clasificación por aspecto del juego para texto libre sin ficha
      // solo está implementada en el creador de sesiones por ahora.
      aspecto: null,
    });
  }

  return { blocks, items };
}
