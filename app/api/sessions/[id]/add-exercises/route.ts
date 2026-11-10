import { and, asc, eq, inArray, max } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  exercises,
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
  sessions,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { embedSession } from "@/lib/ai/semantic-search";
import {
  BLOCK_TITLES,
  blockOrderFromIndex,
  blockOrderFromPhase,
  phaseFromBlockOrder,
} from "@/lib/sessions/plan";
import { canEditSession } from "@/lib/sessions/permissions";

// Añade ejercicios de la biblioteca al final de un bloque de una sesión ya
// creada, sin tocar lo que la sesión ya tenía.
const bodySchema = z.object({
  exerciseIds: z.array(z.string().uuid()).min(1).max(50),
  blockOrder: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await context.params;
  if (!z.string().uuid().safeParse(sessionId).success) {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 422 });
  }
  const { exerciseIds, blockOrder } = parsed.data;

  const [session] = await db
    .select({
      userId: sessions.userId,
      coachId: sessions.coachId,
      clubId: sessions.clubId,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) {
    return NextResponse.json(
      { error: "Sesión no encontrada" },
      { status: 404 }
    );
  }
  if (!(await canEditSession(user.id, session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uniqueIds = Array.from(new Set(exerciseIds));
  const exerciseRows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      description: exercises.description,
      durationMinutes: exercises.durationMinutes,
    })
    .from(exercises)
    .where(
      and(
        inArray(exercises.id, uniqueIds),
        exerciseVisibleToUserCondition(user.id)
      )
    );
  const byId = new Map(exerciseRows.map((row) => [row.id, row]));
  const toAdd = exerciseIds
    .map((exerciseId) => byId.get(exerciseId))
    .filter((row): row is NonNullable<typeof row> => !!row);
  if (toAdd.length === 0) {
    return NextResponse.json(
      { error: "Los ejercicios no existen o no son accesibles" },
      { status: 400 }
    );
  }

  const phase = phaseFromBlockOrder(blockOrder);

  await db.transaction(async (tx) => {
    // Bloques existentes (1 = inicial, 2 = principal, 3 = final).
    const blockRows = await tx
      .select({ id: sessionBlocks.id, orderIndex: sessionBlocks.orderIndex })
      .from(sessionBlocks)
      .where(eq(sessionBlocks.sessionId, sessionId));
    const blockIdByOrder = new Map<1 | 2 | 3, string>();
    for (const row of blockRows) {
      const order = blockOrderFromIndex(row.orderIndex);
      if (!blockIdByOrder.has(order)) blockIdByOrder.set(order, row.id);
    }

    const existingItems =
      blockRows.length > 0
        ? await tx
            .select({ id: sessionBlockItems.id })
            .from(sessionBlockItems)
            .where(
              inArray(
                sessionBlockItems.blockId,
                blockRows.map((row) => row.id)
              )
            )
            .limit(1)
        : [];

    async function ensureBlock(order: 1 | 2 | 3) {
      const existing = blockIdByOrder.get(order);
      if (existing) return existing;
      const [created] = await tx
        .insert(sessionBlocks)
        .values({ sessionId, orderIndex: order, title: BLOCK_TITLES[order] })
        .returning({ id: sessionBlocks.id });
      blockIdByOrder.set(order, created.id);
      return created.id;
    }

    // Sesiones antiguas sin items en bloques: pasar primero sus ejercicios
    // a bloques para que no desaparezcan del plan al añadir uno nuevo.
    if (existingItems.length === 0) {
      const legacy = await tx
        .select({
          exerciseId: sessionExercises.exerciseId,
          phase: sessionExercises.phase,
          durationMinutes: sessionExercises.durationMinutes,
          notes: sessionExercises.notes,
          name: exercises.name,
          description: exercises.description,
          defaultDuration: exercises.durationMinutes,
        })
        .from(sessionExercises)
        .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
        .where(eq(sessionExercises.sessionId, sessionId))
        .orderBy(asc(sessionExercises.orderIndex));
      const counters = new Map<1 | 2 | 3, number>();
      for (const row of legacy) {
        const order = blockOrderFromPhase(row.phase);
        const blockId = await ensureBlock(order);
        const idx = counters.get(order) ?? 0;
        counters.set(order, idx + 1);
        await tx.insert(sessionBlockItems).values({
          blockId,
          exerciseId: row.exerciseId,
          exerciseName: row.name,
          exerciseDescription: row.description,
          orderIndex: idx,
          durationMinutes: row.durationMinutes ?? row.defaultDuration ?? null,
          notes: row.notes ?? null,
        });
      }
    }

    const targetBlockId = await ensureBlock(blockOrder);
    const [maxItem] = await tx
      .select({ value: max(sessionBlockItems.orderIndex) })
      .from(sessionBlockItems)
      .where(eq(sessionBlockItems.blockId, targetBlockId));
    let nextItemIndex = (maxItem?.value ?? -1) + 1;

    const [maxExercise] = await tx
      .select({ value: max(sessionExercises.orderIndex) })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, sessionId));
    let nextExerciseIndex = (maxExercise?.value ?? -1) + 1;

    for (const exercise of toAdd) {
      await tx.insert(sessionBlockItems).values({
        blockId: targetBlockId,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseDescription: exercise.description,
        orderIndex: nextItemIndex++,
        durationMinutes: exercise.durationMinutes ?? null,
        notes: null,
      });
      await tx.insert(sessionExercises).values({
        sessionId,
        exerciseId: exercise.id,
        orderIndex: nextExerciseIndex++,
        durationMinutes: null,
        notes: null,
        phase,
        intensity: null,
      });
    }
  });

  after(() => embedSession(sessionId, user.id).catch(console.error));

  return NextResponse.json({ ok: true, added: toAdd.length });
}
