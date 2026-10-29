import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  sessionBlockItems,
  sessionBlocks,
  sessions,
} from "@/db/schema";
import type { AnimationInputBlock } from "@/lib/classes/animation";

// Datos mínimos para reproducir la animación de una sesión en su enlace
// público: título, objetivo y bloques. Nada de alumnos, notas ni horarios.

export interface SessionAnimationData {
  name: string;
  objectives: string | null;
  blocks: AnimationInputBlock[];
}

export async function loadSessionAnimationData(
  sessionId: string
): Promise<SessionAnimationData | null> {
  const [session] = await db
    .select({ title: sessions.title, objective: sessions.objective })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return null;

  const rows = await db
    .select({
      blockId: sessionBlocks.id,
      blockOrderIndex: sessionBlocks.orderIndex,
      blockTitle: sessionBlocks.title,
      itemId: sessionBlockItems.id,
      kind: sessionBlockItems.kind,
      exerciseId: sessionBlockItems.exerciseId,
      exerciseName: sessionBlockItems.exerciseName,
      exerciseDescription: sessionBlockItems.exerciseDescription,
      freeText: sessionBlockItems.freeText,
      durationMinutes: sessionBlockItems.durationMinutes,
      stations: sessionBlockItems.stations,
      notes: sessionBlockItems.notes,
      libraryDescription: exercises.description,
      exerciseObjectives: exercises.objectives,
      animationScene: exercises.animationScene,
    })
    .from(sessionBlocks)
    .leftJoin(
      sessionBlockItems,
      eq(sessionBlockItems.blockId, sessionBlocks.id)
    )
    .leftJoin(exercises, eq(exercises.id, sessionBlockItems.exerciseId))
    .where(eq(sessionBlocks.sessionId, sessionId))
    .orderBy(asc(sessionBlocks.orderIndex), asc(sessionBlockItems.orderIndex));

  const blocks = new Map<string, AnimationInputBlock>();
  for (const row of rows) {
    const block = blocks.get(row.blockId) ?? {
      orderIndex: row.blockOrderIndex,
      title: row.blockTitle,
      items: [],
    };
    if (row.itemId) {
      block.items.push({
        kind: row.kind,
        exerciseId: row.exerciseId,
        exerciseName: row.exerciseName,
        exerciseDescription: row.exerciseDescription ?? row.libraryDescription,
        exerciseObjectives: row.exerciseObjectives,
        freeText: row.freeText,
        durationMinutes: row.durationMinutes,
        stations: row.stations,
        notes: row.notes,
        animationScene: row.animationScene,
      });
    }
    blocks.set(row.blockId, block);
  }

  return {
    name: session.title,
    objectives: session.objective,
    blocks: Array.from(blocks.values()),
  };
}
