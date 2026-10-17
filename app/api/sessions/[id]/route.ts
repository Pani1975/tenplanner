import { and, asc, eq, inArray, or } from "drizzle-orm";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  classes,
  exercises,
  groups,
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
  sessionStudents,
  sessions,
  students,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  sessionIdParamsSchema,
  updateSessionSchema,
  zodValidationErrorResponse,
} from "../validation";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { embedSession } from "@/lib/ai/semantic-search";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { classDraftVisibility } from "@/lib/classes/visibility";
import { sumBlocksDuration, type StationItemJson } from "@/lib/block-items";

function internalServerError() {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

type SessionBlockInputItem = {
  kind?: "exercise" | "text" | "warmup" | "stations";
  exerciseId?: string | null;
  freeText?: string | null;
  title?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  stations?: Array<{
    kind: "exercise" | "text";
    exerciseId?: string | null;
    freeText?: string | null;
    durationMinutes?: number | null;
  }> | null;
  aspecto?: string | null;
};

type SessionBlockInput = {
  orderIndex: number;
  title?: string | null;
  notes?: string | null;
  items: SessionBlockInputItem[];
};

type TrainingPhase = "activation" | "main" | "cooldown";

type ExerciseSnapshot = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

const BLOCK_TITLE_BY_PHASE: Record<number, string> = {
  1: "Bloque inicial",
  2: "Bloque principal",
  3: "Bloque final",
};

function phaseToBlockOrder(phase?: string | null) {
  if (phase === "activation") return 1;
  if (phase === "cooldown") return 3;
  return 2;
}

function blockOrderToPhase(orderIndex: number): TrainingPhase {
  if (orderIndex === 1) return "activation";
  if (orderIndex === 3) return "cooldown";
  return "main";
}

function normalizePhase(phase?: string | null): TrainingPhase | null {
  if (phase === "activation" || phase === "main" || phase === "cooldown") {
    return phase;
  }
  return null;
}

function buildBlocksFromExercises(
  exerciseItems: {
    exerciseId: string;
    durationMinutes?: number | null;
    notes?: string | null;
    phase?: string | null;
  }[]
): SessionBlockInput[] {
  const grouped = new Map<number, SessionBlockInput>();
  for (const item of exerciseItems) {
    const orderIndex = phaseToBlockOrder(item.phase);
    const block =
      grouped.get(orderIndex) ??
      ({
        orderIndex,
        title: BLOCK_TITLE_BY_PHASE[orderIndex],
        notes: null,
        items: [],
      } satisfies SessionBlockInput);
    block.items.push({
      exerciseId: item.exerciseId,
      freeText: null,
      durationMinutes: item.durationMinutes ?? null,
      notes: item.notes ?? null,
    });
    grouped.set(orderIndex, block);
  }
  return [1, 2, 3].map(
    (orderIndex) =>
      grouped.get(orderIndex) ?? {
        orderIndex,
        title: BLOCK_TITLE_BY_PHASE[orderIndex],
        notes: null,
        items: [],
      }
  );
}

function normalizeBlocks(
  blocks: SessionBlockInput[] | null | undefined,
  exerciseItems: {
    exerciseId: string;
    durationMinutes?: number | null;
    notes?: string | null;
    phase?: string | null;
  }[]
) {
  const source =
    blocks && blocks.length > 0
      ? blocks
      : buildBlocksFromExercises(exerciseItems);
  const byOrder = new Map<number, SessionBlockInput>();

  for (const block of source) {
    const orderIndex = block.orderIndex;
    const existing =
      byOrder.get(orderIndex) ??
      ({
        orderIndex,
        title: block.title ?? BLOCK_TITLE_BY_PHASE[orderIndex],
        notes: block.notes ?? null,
        items: [],
      } satisfies SessionBlockInput);

    existing.title =
      block.title ?? existing.title ?? BLOCK_TITLE_BY_PHASE[orderIndex];
    existing.notes = block.notes ?? existing.notes ?? null;
    existing.items.push(...block.items);
    byOrder.set(orderIndex, existing);
  }

  return [1, 2, 3].map(
    (orderIndex) =>
      byOrder.get(orderIndex) ?? {
        orderIndex,
        title: BLOCK_TITLE_BY_PHASE[orderIndex],
        notes: null,
        items: [],
      }
  );
}

function exerciseIdsFromBlocks(blocks: SessionBlockInput[]) {
  return blocks.flatMap((block) =>
    block.items.flatMap((item) => [
      ...(item.exerciseId ? [item.exerciseId] : []),
      ...(item.stations ?? []).flatMap((s) =>
        s.exerciseId ? [s.exerciseId] : []
      ),
    ])
  );
}

function buildCompatibilityExercises(
  blocks: SessionBlockInput[],
  exerciseItems: {
    exerciseId: string;
    durationMinutes?: number | null;
    notes?: string | null;
    phase?: string | null;
    intensity?: number | null;
  }[]
) {
  if (exerciseItems.length > 0) return exerciseItems;

  return blocks.flatMap((block) =>
    block.items.flatMap((item) =>
      item.exerciseId
        ? [
            {
              exerciseId: item.exerciseId,
              durationMinutes: item.durationMinutes ?? null,
              notes: item.notes ?? null,
              phase: blockOrderToPhase(block.orderIndex),
              intensity: null,
            },
          ]
        : []
    )
  );
}

async function getAccessibleExerciseSnapshots(
  userId: string,
  exerciseIds: string[]
) {
  const uniqueIds = Array.from(new Set(exerciseIds));
  if (uniqueIds.length === 0) {
    return {
      snapshots: new Map<string, ExerciseSnapshot>(),
      inaccessibleIds: [],
    };
  }

  const rows = await db
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
        exerciseVisibleToUserCondition(userId)
      )
    );

  const snapshots = new Map(rows.map((row) => [row.id, row]));
  const inaccessibleIds = uniqueIds.filter((id) => !snapshots.has(id));

  return { snapshots, inaccessibleIds };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = sessionIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return zodValidationErrorResponse(parsedParams.error);
  }

  const { id } = parsedParams.data;

  try {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const exerciseRows = await db
      .select({
        orderIndex: sessionExercises.orderIndex,
        durationMinutes: sessionExercises.durationMinutes,
        notes: sessionExercises.notes,
        phase: sessionExercises.phase,
        intensity: sessionExercises.intensity,
        coachRating: sessionExercises.coachRating,
        actualDurationSeconds: sessionExercises.actualDurationSeconds,
        completedAt: sessionExercises.completedAt,
        executionNotes: sessionExercises.executionNotes,
        wasSkipped: sessionExercises.wasSkipped,
        exerciseId: exercises.id,
        exerciseName: exercises.name,
        exerciseCategory: exercises.category,
        exerciseDifficulty: exercises.difficulty,
        exerciseDurationMinutes: exercises.durationMinutes,
      })
      .from(sessionExercises)
      .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
      .where(eq(sessionExercises.sessionId, id))
      .orderBy(asc(sessionExercises.orderIndex));

    const studentRows = await db
      .select({
        id: students.id,
        name: students.name,
        imageUrl: students.imageUrl,
      })
      .from(sessionStudents)
      .innerJoin(students, eq(sessionStudents.studentId, students.id))
      .where(eq(sessionStudents.sessionId, id));

    const blockRows = await db
      .select({
        blockId: sessionBlocks.id,
        blockOrderIndex: sessionBlocks.orderIndex,
        blockTitle: sessionBlocks.title,
        blockNotes: sessionBlocks.notes,
        itemId: sessionBlockItems.id,
        itemOrderIndex: sessionBlockItems.orderIndex,
        itemExerciseId: sessionBlockItems.exerciseId,
        itemExerciseName: sessionBlockItems.exerciseName,
        itemExerciseDescription: sessionBlockItems.exerciseDescription,
        itemFreeText: sessionBlockItems.freeText,
        itemDurationMinutes: sessionBlockItems.durationMinutes,
        itemNotes: sessionBlockItems.notes,
        itemKind: sessionBlockItems.kind,
        itemStations: sessionBlockItems.stations,
        // Datos de la biblioteca (para la animación cuando el ítem no tiene
        // descripción propia).
        itemLibraryDescription: exercises.description,
        itemExerciseObjectives: exercises.objectives,
      })
      .from(sessionBlocks)
      .leftJoin(
        sessionBlockItems,
        eq(sessionBlockItems.blockId, sessionBlocks.id)
      )
      .leftJoin(exercises, eq(exercises.id, sessionBlockItems.exerciseId))
      .where(eq(sessionBlocks.sessionId, id))
      .orderBy(
        asc(sessionBlocks.orderIndex),
        asc(sessionBlockItems.orderIndex)
      );

    const blockMap = new Map<
      string,
      {
        id: string;
        orderIndex: number;
        title: string | null;
        notes: string | null;
        items: Array<{
          id: string;
          orderIndex: number;
          exerciseId: string | null;
          exerciseName: string | null;
          exerciseDescription: string | null;
          freeText: string | null;
          durationMinutes: number | null;
          notes: string | null;
          kind: string | null;
          stations: StationItemJson[] | null;
          libraryDescription: string | null;
          exerciseObjectives: string | null;
        }>;
      }
    >();

    for (const row of blockRows) {
      const block =
        blockMap.get(row.blockId) ??
        ({
          id: row.blockId,
          orderIndex: row.blockOrderIndex,
          title: row.blockTitle,
          notes: row.blockNotes,
          items: [],
        } satisfies {
          id: string;
          orderIndex: number;
          title: string | null;
          notes: string | null;
          items: Array<{
            id: string;
            orderIndex: number;
            exerciseId: string | null;
            exerciseName: string | null;
            exerciseDescription: string | null;
            freeText: string | null;
            durationMinutes: number | null;
            notes: string | null;
            kind: string | null;
            stations: StationItemJson[] | null;
            libraryDescription: string | null;
            exerciseObjectives: string | null;
          }>;
        });
      if (row.itemId) {
        block.items.push({
          id: row.itemId,
          orderIndex: row.itemOrderIndex ?? 0,
          exerciseId: row.itemExerciseId,
          exerciseName: row.itemExerciseName,
          exerciseDescription: row.itemExerciseDescription,
          freeText: row.itemFreeText,
          durationMinutes: row.itemDurationMinutes,
          notes: row.itemNotes,
          kind: row.itemKind,
          stations: row.itemStations as StationItemJson[] | null,
          libraryDescription: row.itemLibraryDescription ?? null,
          exerciseObjectives: row.itemExerciseObjectives ?? null,
        });
      }
      blockMap.set(row.blockId, block);
    }

    return NextResponse.json({
      data: {
        id: session.id,
        title: session.title,
        description: session.description,
        scheduledAt: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        userId: session.userId,
        objective: session.objective,
        material: session.material,
        observations: session.observations,
        sourceClassId: session.sourceClassId,
        intensity: session.intensity,
        tags: session.tags,
        location: session.location,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        exercises: exerciseRows.map((e) => ({
          exerciseId: e.exerciseId,
          name: e.exerciseName,
          category: e.exerciseCategory,
          difficulty: e.exerciseDifficulty,
          orderIndex: e.orderIndex,
          durationMinutes: e.durationMinutes ?? e.exerciseDurationMinutes,
          notes: e.notes,
          phase: e.phase,
          intensity: e.intensity,
          coachRating: e.coachRating,
          actualDurationSeconds: e.actualDurationSeconds,
          completedAt: e.completedAt,
          executionNotes: e.executionNotes,
          wasSkipped: e.wasSkipped,
        })),
        blocks: Array.from(blockMap.values()).sort(
          (a, b) => a.orderIndex - b.orderIndex
        ),
        students: studentRows,
      },
    });
  } catch {
    return internalServerError();
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = sessionIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return zodValidationErrorResponse(parsedParams.error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = updateSessionSchema.safeParse(body);
  if (!parsedBody.success) {
    return zodValidationErrorResponse(parsedBody.error);
  }

  const { id } = parsedParams.data;

  try {
    const [existing] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      exercises: exerciseItems,
      blocks,
      studentIds,
      tags,
      ...sessionFields
    } = parsedBody.data;

    if (studentIds !== undefined) {
      const unique = Array.from(new Set(studentIds));
      if (unique.length > 0) {
        const ownedRows = await db
          .select({ id: students.id })
          .from(students)
          .where(
            and(eq(students.coachId, user.id), inArray(students.id, unique))
          );
        if (ownedRows.length !== unique.length) {
          return NextResponse.json(
            { error: "Algunos alumnos no pertenecen al entrenador" },
            { status: 400 }
          );
        }
      }
    }

    if (sessionFields.groupId) {
      const groupActiveClubId = await getActiveWorkClubId(user.id);
      const [accessibleGroup] = await db
        .select({ id: groups.id })
        .from(groups)
        .where(
          and(
            eq(groups.id, sessionFields.groupId),
            sharedWithClubCondition(
              groups.coachId,
              groups.clubId,
              user.id,
              groupActiveClubId
            )
          )
        )
        .limit(1);
      if (!accessibleGroup) {
        return NextResponse.json(
          { error: "El grupo no existe o no es accesible" },
          { status: 400 }
        );
      }
    }

    if (sessionFields.sourceClassId) {
      const classActiveClubId = await getActiveWorkClubId(user.id);
      const [sourceClass] = await db
        .select({ id: classes.id })
        .from(classes)
        .where(
          and(
            eq(classes.id, sessionFields.sourceClassId),
            or(
              eq(classes.isLibrary, true),
              sharedWithClubCondition(
                classes.createdBy,
                classes.clubId,
                user.id,
                classActiveClubId
              )
            ),
            classDraftVisibility(user.id)
          )
        )
        .limit(1);

      if (!sourceClass) {
        return NextResponse.json(
          { error: "La clase de origen no existe o no es accesible" },
          { status: 400 }
        );
      }
    }

    const replacesPlan = exerciseItems !== undefined || blocks !== undefined;
    const normalizedBlocks = replacesPlan
      ? normalizeBlocks(blocks, exerciseItems ?? [])
      : [];
    const compatibilityExercises = replacesPlan
      ? buildCompatibilityExercises(normalizedBlocks, exerciseItems ?? [])
      : [];
    const exerciseIds = replacesPlan
      ? [
          ...compatibilityExercises.map((item) => item.exerciseId),
          ...exerciseIdsFromBlocks(normalizedBlocks),
        ]
      : [];
    const { snapshots, inaccessibleIds } = await getAccessibleExerciseSnapshots(
      user.id,
      exerciseIds
    );

    if (inaccessibleIds.length > 0) {
      return NextResponse.json(
        { error: "Algunos ejercicios no existen o no son accesibles" },
        { status: 400 }
      );
    }

    const updateValues: Record<string, unknown> = {};
    if (sessionFields.title !== undefined)
      updateValues.title = sessionFields.title;
    if (sessionFields.description !== undefined)
      updateValues.description = sessionFields.description;
    if (sessionFields.scheduledAt !== undefined)
      updateValues.scheduledAt = new Date(sessionFields.scheduledAt);
    if (sessionFields.objective !== undefined)
      updateValues.objective = sessionFields.objective;
    if (sessionFields.material !== undefined)
      updateValues.material = sessionFields.material;
    if (sessionFields.observations !== undefined)
      updateValues.observations = sessionFields.observations;
    if (sessionFields.sourceClassId !== undefined)
      updateValues.sourceClassId = sessionFields.sourceClassId;
    if (sessionFields.intensity !== undefined)
      updateValues.intensity = sessionFields.intensity;
    if (sessionFields.location !== undefined)
      updateValues.location = sessionFields.location;
    if (sessionFields.placeId !== undefined)
      updateValues.placeId = sessionFields.placeId;
    if (sessionFields.groupId !== undefined)
      updateValues.groupId = sessionFields.groupId;
    if (tags !== undefined) {
      updateValues.tags =
        tags && tags.length > 0
          ? Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)))
          : null;
    }

    // Igual que al crear: si el plan se está reemplazando, la duración real
    // se recalcula a partir de su contenido en vez de fiarse de un número
    // que puede haber quedado desactualizado. Un valor enviado explícito
    // solo se respeta cuando no hay contenido del que calcularla.
    if (replacesPlan) {
      const exerciseDurationById = new Map(
        Array.from(snapshots.values()).map((row) => [
          row.id,
          row.durationMinutes,
        ])
      );
      const computedDuration = sumBlocksDuration(
        normalizedBlocks,
        exerciseDurationById
      );
      if (computedDuration > 0) {
        updateValues.durationMinutes = computedDuration;
      } else if (sessionFields.durationMinutes !== undefined) {
        updateValues.durationMinutes = sessionFields.durationMinutes;
      }
    } else if (sessionFields.durationMinutes !== undefined) {
      updateValues.durationMinutes = sessionFields.durationMinutes;
    }

    const updatedSession = await db.transaction(async (tx) => {
      const [session] = await tx
        .update(sessions)
        .set(updateValues)
        .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
        .returning();

      if (replacesPlan) {
        // Conservar lo registrado al dar la clase (valoración, notas,
        // tiempos) de los ejercicios que siguen en la sesión.
        const previousExecution = await tx
          .select({
            exerciseId: sessionExercises.exerciseId,
            coachRating: sessionExercises.coachRating,
            actualDurationSeconds: sessionExercises.actualDurationSeconds,
            completedAt: sessionExercises.completedAt,
            executionNotes: sessionExercises.executionNotes,
            wasSkipped: sessionExercises.wasSkipped,
          })
          .from(sessionExercises)
          .where(eq(sessionExercises.sessionId, id));
        const executionByExercise = new Map<
          string,
          (typeof previousExecution)[number][]
        >();
        for (const row of previousExecution) {
          const list = executionByExercise.get(row.exerciseId) ?? [];
          list.push(row);
          executionByExercise.set(row.exerciseId, list);
        }

        await tx
          .delete(sessionExercises)
          .where(eq(sessionExercises.sessionId, id));

        if (compatibilityExercises.length > 0) {
          await tx.insert(sessionExercises).values(
            compatibilityExercises.map((item, idx) => {
              const previous = executionByExercise
                .get(item.exerciseId)
                ?.shift();
              return {
                sessionId: id,
                exerciseId: item.exerciseId,
                orderIndex: idx,
                durationMinutes: item.durationMinutes ?? null,
                notes: item.notes ?? null,
                phase: normalizePhase(item.phase),
                intensity: item.intensity ?? null,
                coachRating: previous?.coachRating ?? null,
                actualDurationSeconds: previous?.actualDurationSeconds ?? null,
                completedAt: previous?.completedAt ?? null,
                executionNotes: previous?.executionNotes ?? null,
                wasSkipped: previous?.wasSkipped ?? false,
              };
            })
          );
        }

        await tx.delete(sessionBlocks).where(eq(sessionBlocks.sessionId, id));

        function buildStations(
          stations: SessionBlockInputItem["stations"]
        ): StationItemJson[] {
          return (stations ?? []).map((s) => ({
            kind: s.kind,
            exerciseId: s.exerciseId ?? null,
            exerciseName: s.exerciseId
              ? (snapshots.get(s.exerciseId)?.name ?? null)
              : null,
            freeText: s.freeText ?? null,
            durationMinutes: s.durationMinutes ?? null,
          }));
        }

        for (const block of normalizedBlocks) {
          const [sessionBlock] = await tx
            .insert(sessionBlocks)
            .values({
              sessionId: id,
              orderIndex: block.orderIndex,
              title: block.title ?? BLOCK_TITLE_BY_PHASE[block.orderIndex],
              notes: block.notes ?? null,
            })
            .returning({ id: sessionBlocks.id });

          if (block.items.length > 0) {
            await tx.insert(sessionBlockItems).values(
              block.items.map((item, idx) => {
                const snapshot = item.exerciseId
                  ? snapshots.get(item.exerciseId)
                  : undefined;
                return {
                  blockId: sessionBlock.id,
                  exerciseId: item.exerciseId ?? null,
                  exerciseName: snapshot?.name ?? null,
                  exerciseDescription: snapshot?.description ?? null,
                  freeText: item.freeText?.trim() || null,
                  title: item.title?.trim() || null,
                  orderIndex: idx,
                  durationMinutes:
                    item.durationMinutes ?? snapshot?.durationMinutes ?? null,
                  notes: item.notes ?? null,
                  kind: item.kind ?? null,
                  stations:
                    item.kind === "stations"
                      ? buildStations(item.stations)
                      : null,
                  aspectoJuego: item.exerciseId
                    ? null
                    : (item.aspecto ?? null),
                };
              })
            );
          }
        }
      }

      if (studentIds !== undefined) {
        const unique = Array.from(new Set(studentIds));
        await tx
          .delete(sessionStudents)
          .where(eq(sessionStudents.sessionId, id));
        if (unique.length > 0) {
          await tx
            .insert(sessionStudents)
            .values(unique.map((studentId) => ({ sessionId: id, studentId })));
        }
      }

      return session;
    });

    if (updatedSession) {
      after(() =>
        embedSession(updatedSession.id, user.id).catch(console.error)
      );
    }

    return NextResponse.json({ data: updatedSession });
  } catch {
    return internalServerError();
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = sessionIdParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return zodValidationErrorResponse(parsedParams.error);
  }

  const { id } = parsedParams.data;

  try {
    const [existing] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(sessions).where(eq(sessions.id, id));

    return NextResponse.json({ ok: true });
  } catch {
    return internalServerError();
  }
}
