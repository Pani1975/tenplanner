import { and, asc, count, eq, inArray, or } from "drizzle-orm";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  classBlockExercises,
  classBlocks,
  classes,
  exercises,
  groups,
  groupStudents,
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
  sessionStudents,
  sessions,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getBooleanSetting, getNumberSetting } from "@/lib/app-settings";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { classDraftVisibility } from "@/lib/classes/visibility";
import { getActiveSport } from "@/lib/sports";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { embedSession } from "@/lib/ai/semantic-search";
import { sumBlocksDuration, type StationItemJson } from "@/lib/block-items";
import { zodValidationErrorResponse } from "../validation";

// Crea una o varias sesiones a partir de una clase, directamente para un
// grupo (p. ej. "Asignar clase" en la ficha de grupo/clase, con el
// calendario de fechas). Cada fecha es una sesión independiente con el
// mismo contenido de la clase; si se eligió solo una fecha, el flujo
// normal pasa por el wizard en vez de este endpoint — este es para el
// caso de varias fechas a la vez (repetir la clase).
const bodySchema = z.object({
  classId: z.string().uuid("ID de clase inválido"),
  groupId: z.string().uuid("ID de grupo inválido"),
  dates: z
    .array(z.string().datetime("Debe ser una fecha/hora ISO válida"))
    .min(1, "Elige al menos una fecha")
    .max(60, "Máximo 60 fechas a la vez"),
});

const BLOCK_TITLE_BY_PHASE: Record<number, string> = {
  1: "Bloque inicial",
  2: "Bloque principal",
  3: "Bloque final",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Código de sesión AAMMDD_Grupo, igual que sessionCode() del wizard. */
function sessionCode(date: Date, groupName: string) {
  const code = `${String(date.getFullYear()).slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const group = groupName.trim();
  return group ? `${code}_${group}` : code;
}

type LoadedBlockItem = {
  kind?: string | null;
  exerciseId: string | null;
  freeText: string | null;
  title: string | null;
  durationMinutes: number | null;
  stations: StationItemJson[] | null;
  aspecto: string | null;
};

type LoadedBlock = {
  orderIndex: 1 | 2 | 3;
  title: string | null;
  notes: string | null;
  items: LoadedBlockItem[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionCreationEnabled = await getBooleanSetting(
    "feature.session_creation_enabled"
  );
  if (!sessionCreationEnabled) {
    return NextResponse.json(
      { error: "La creación de sesiones está desactivada." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);
  const { classId, groupId, dates } = parsed.data;

  try {
    if (user.email) {
      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : user.email;
      await db
        .insert(users)
        .values({ id: user.id, name: metadataName, email: user.email })
        .onConflictDoNothing();
    }

    const [clubId, activeSport] = await Promise.all([
      getActiveWorkClubId(user.id),
      getActiveSport(user.id),
    ]);

    const maxSessionsPerUser = await getNumberSetting(
      "system.max_sessions_per_user",
      0
    );
    if (maxSessionsPerUser > 0) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(sessions)
        .where(eq(sessions.userId, user.id));
      if (Number(total ?? 0) + dates.length > maxSessionsPerUser) {
        return NextResponse.json(
          {
            error:
              "Esto superaría el límite de sesiones de tu cuenta. Reduce el número de fechas.",
          },
          { status: 403 }
        );
      }
    }

    const [group] = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(
        and(
          eq(groups.id, groupId),
          sharedWithClubCondition(
            groups.coachId,
            groups.clubId,
            user.id,
            clubId ?? null
          )
        )
      )
      .limit(1);
    if (!group) {
      return NextResponse.json(
        { error: "El grupo no existe o no es accesible" },
        { status: 400 }
      );
    }

    const memberRows = await db
      .select({ studentId: groupStudents.studentId })
      .from(groupStudents)
      .where(eq(groupStudents.groupId, groupId));
    const studentIds = memberRows.map((m) => m.studentId);

    const [cls] = await db
      .select({
        id: classes.id,
        name: classes.name,
        objetivos: classes.objetivos,
        material: classes.material,
        observations: classes.aspectosImportantes,
        sport: classes.sport,
      })
      .from(classes)
      .where(
        and(
          eq(classes.id, classId),
          or(
            eq(classes.isLibrary, true),
            sharedWithClubCondition(
              classes.createdBy,
              classes.clubId,
              user.id,
              clubId
            )
          ),
          classDraftVisibility(user.id)
        )
      )
      .limit(1);
    if (!cls) {
      return NextResponse.json(
        { error: "La clase de origen no existe o no es accesible" },
        { status: 400 }
      );
    }

    const rows = await db
      .select({
        blockOrder: classBlocks.orderIndex,
        blockTitle: classBlocks.title,
        blockNotes: classBlocks.notes,
        itemExerciseId: classBlockExercises.exerciseId,
        freeText: classBlockExercises.freeText,
        itemTitle: classBlockExercises.title,
        itemDuration: classBlockExercises.durationMinutes,
        itemKind: classBlockExercises.kind,
        itemStations: classBlockExercises.stations,
        itemAspecto: classBlockExercises.aspectoJuego,
      })
      .from(classBlocks)
      .leftJoin(
        classBlockExercises,
        eq(classBlockExercises.blockId, classBlocks.id)
      )
      .where(eq(classBlocks.classId, classId))
      .orderBy(asc(classBlocks.orderIndex), asc(classBlockExercises.orderIndex));

    const blockMap = new Map<number, LoadedBlock>();
    for (const row of rows) {
      const orderIndex = (
        row.blockOrder === 1 || row.blockOrder === 3 ? row.blockOrder : 2
      ) as 1 | 2 | 3;
      const block =
        blockMap.get(orderIndex) ??
        ({
          orderIndex,
          title: row.blockTitle,
          notes: row.blockNotes,
          items: [],
        } satisfies LoadedBlock);
      const hasContent =
        !!row.itemExerciseId ||
        !!row.freeText?.trim() ||
        !!row.itemTitle?.trim() ||
        row.itemKind === "warmup" ||
        row.itemKind === "stations";
      if (hasContent) {
        block.items.push({
          kind: row.itemKind,
          exerciseId: row.itemExerciseId ?? null,
          freeText: row.freeText ?? null,
          title: row.itemTitle ?? null,
          durationMinutes: row.itemDuration ?? null,
          stations: (row.itemStations as StationItemJson[] | null) ?? null,
          aspecto: row.itemAspecto ?? null,
        });
      }
      blockMap.set(orderIndex, block);
    }
    const blocks: LoadedBlock[] = [1, 2, 3].map(
      (orderIndex) =>
        blockMap.get(orderIndex) ?? {
          orderIndex: orderIndex as 1 | 2 | 3,
          title: null,
          notes: null,
          items: [],
        }
    );

    const exerciseIds = Array.from(
      new Set(
        blocks.flatMap((b) =>
          b.items.flatMap((it) => [
            ...(it.exerciseId ? [it.exerciseId] : []),
            ...(it.stations ?? []).flatMap((s) =>
              s.exerciseId ? [s.exerciseId] : []
            ),
          ])
        )
      )
    );

    const snapshots = new Map<
      string,
      { id: string; name: string; description: string | null; durationMinutes: number }
    >();
    if (exerciseIds.length > 0) {
      const exRows = await db
        .select({
          id: exercises.id,
          name: exercises.name,
          description: exercises.description,
          durationMinutes: exercises.durationMinutes,
        })
        .from(exercises)
        .where(
          and(
            inArray(exercises.id, exerciseIds),
            exerciseVisibleToUserCondition(user.id)
          )
        );
      for (const row of exRows) snapshots.set(row.id, row);
    }
    const inaccessible = exerciseIds.filter((id) => !snapshots.has(id));
    if (inaccessible.length > 0) {
      return NextResponse.json(
        { error: "Algunos ejercicios de la clase ya no son accesibles" },
        { status: 400 }
      );
    }

    const exerciseDurationById = new Map(
      Array.from(snapshots.values()).map((row) => [row.id, row.durationMinutes])
    );
    const durationMinutes =
      sumBlocksDuration(blocks, exerciseDurationById) || 60;

    const createdIds: string[] = [];

    await db.transaction(async (tx) => {
      for (const dateIso of dates) {
        const scheduledAt = new Date(dateIso);
        const title = sessionCode(scheduledAt, group.name);

        const [session] = await tx
          .insert(sessions)
          .values({
            title,
            description: null,
            scheduledAt,
            durationMinutes,
            userId: user.id,
            objective: cls.objetivos ?? null,
            material: cls.material ?? null,
            observations: cls.observations ?? null,
            sourceClassId: cls.id,
            intensity: null,
            tags: null,
            location: null,
            placeId: null,
            groupId: group.id,
            clubId: clubId ?? null,
            sport: cls.sport ?? activeSport,
          })
          .returning();

        for (const block of blocks) {
          const [sessionBlock] = await tx
            .insert(sessionBlocks)
            .values({
              sessionId: session.id,
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
                  exerciseId: item.exerciseId,
                  exerciseName: snapshot?.name ?? null,
                  exerciseDescription: snapshot?.description ?? null,
                  freeText: item.freeText?.trim() || null,
                  title: item.title?.trim() || null,
                  orderIndex: idx,
                  durationMinutes:
                    item.durationMinutes ?? snapshot?.durationMinutes ?? null,
                  notes: null,
                  kind: item.kind ?? null,
                  stations:
                    item.kind === "stations"
                      ? (item.stations ?? []).map((s) => ({
                          kind: s.kind,
                          exerciseId: s.exerciseId ?? null,
                          exerciseName: s.exerciseId
                            ? snapshots.get(s.exerciseId)?.name ?? null
                            : null,
                          freeText: s.freeText ?? null,
                          durationMinutes: s.durationMinutes ?? null,
                        }))
                      : null,
                  aspectoJuego: item.exerciseId ? null : (item.aspecto ?? null),
                };
              })
            );
          }
        }

        const compatibilityExercises = blocks.flatMap((b) =>
          b.items
            .filter((it) => it.exerciseId)
            .map((it, idx) => ({
              exerciseId: it.exerciseId as string,
              orderIndex: idx,
              durationMinutes: it.durationMinutes ?? null,
              phase:
                b.orderIndex === 1
                  ? ("activation" as const)
                  : b.orderIndex === 3
                    ? ("cooldown" as const)
                    : ("main" as const),
            }))
        );
        if (compatibilityExercises.length > 0) {
          await tx.insert(sessionExercises).values(
            compatibilityExercises.map((item, idx) => ({
              sessionId: session.id,
              exerciseId: item.exerciseId,
              orderIndex: idx,
              durationMinutes: item.durationMinutes,
              phase: item.phase,
            }))
          );
        }

        if (studentIds.length > 0) {
          await tx.insert(sessionStudents).values(
            studentIds.map((studentId) => ({
              sessionId: session.id,
              studentId,
            }))
          );
        }

        createdIds.push(session.id);
      }
    });

    after(() => {
      for (const id of createdIds) {
        embedSession(id, user.id).catch(console.error);
      }
    });

    return NextResponse.json(
      { data: { count: createdIds.length, sessionIds: createdIds } },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
