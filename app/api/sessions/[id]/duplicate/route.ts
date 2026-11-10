import { and, asc, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
  sessions,
  sessionStudents,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getBooleanSetting } from "@/lib/app-settings";
import { canTagWithClub, getActiveClubIds } from "@/lib/clubs";
import {
  remapExerciseId,
  remapStations,
  sendPrivateExercisesToClub,
  stationExerciseIds,
} from "@/lib/club-transfer";
import { editableSessionCondition } from "@/lib/sessions/permissions";

const schema = z.object({
  scheduledAt: z.string().datetime(),
  title: z.string().trim().min(1).max(255).optional(),
  // "Enviar al club": copia una sesión del espacio propio del monitor (Modo
  // monitor) al club del que es monitor. La imparte él.
  toClubId: z.string().uuid().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

// Duplica una sesión completa (plan por bloques, textos libres, alumnos) en
// otra fecha. No copia lo que pasó al darla (notas, valoraciones, asistencia).
export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creationEnabled = await getBooleanSetting(
    "feature.session_creation_enabled"
  );
  if (!creationEnabled)
    return NextResponse.json(
      { error: "La creación de sesiones está desactivada." },
      { status: 403 }
    );

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  // Puede duplicarla quien puede editarla y, además, cualquier monitor del
  // club al que pertenece la sesión (la copia es suya, para aprovecharla).
  const [editable, activeClubIds] = await Promise.all([
    editableSessionCondition(user.id),
    getActiveClubIds(user.id),
  ]);
  const [original] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, id),
        activeClubIds.length > 0
          ? or(editable, inArray(sessions.clubId, activeClubIds))
          : editable
      )
    )
    .limit(1);
  if (!original)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const toClubId = parsed.data.toClubId ?? null;
  if (toClubId) {
    if (original.clubId || original.userId !== user.id)
      return NextResponse.json(
        { error: "Solo puedes enviar al club sesiones de tu espacio." },
        { status: 403 }
      );
    if (!(await canTagWithClub(user.id, toClubId)))
      return NextResponse.json(
        { error: "No eres monitor de ese club." },
        { status: 403 }
      );
  }
  const [editableOriginal] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, id), editable))
    .limit(1);

  const [blocks, legacyExercises, students] = await Promise.all([
    db
      .select()
      .from(sessionBlocks)
      .where(eq(sessionBlocks.sessionId, id))
      .orderBy(asc(sessionBlocks.orderIndex)),
    db
      .select()
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, id))
      .orderBy(asc(sessionExercises.orderIndex)),
    db
      .select({ studentId: sessionStudents.studentId })
      .from(sessionStudents)
      .where(eq(sessionStudents.sessionId, id)),
  ]);
  const items =
    blocks.length > 0
      ? await db
          .select()
          .from(sessionBlockItems)
          .where(
            inArray(
              sessionBlockItems.blockId,
              blocks.map((b) => b.id)
            )
          )
          .orderBy(asc(sessionBlockItems.orderIndex))
      : [];

  const newId = await db.transaction(async (tx) => {
    // Al enviarla al club, sus ejercicios privados van también al club.
    const exerciseMap = toClubId
      ? await sendPrivateExercisesToClub(
          tx,
          [
            ...items.flatMap((i) => [
              i.exerciseId,
              ...stationExerciseIds(i.stations),
            ]),
            ...legacyExercises.map((e) => e.exerciseId),
          ],
          user.id,
          toClubId
        )
      : new Map<string, string>();
    const [created] = await tx
      .insert(sessions)
      .values({
        title: parsed.data.title ?? original.title,
        description: original.description,
        scheduledAt: new Date(parsed.data.scheduledAt),
        durationMinutes: original.durationMinutes,
        userId: user.id,
        objective: original.objective,
        material: original.material,
        observations: original.observations,
        // Clase y lugar del espacio propio: el club no los ve.
        sourceClassId: toClubId ? null : original.sourceClassId,
        intensity: original.intensity,
        tags: original.tags,
        location: original.location,
        placeId: toClubId ? null : original.placeId,
        // Mismo espacio (club o particular), grupo y deporte que el original:
        // sin esto la copia caía en el modo particular y no se veía en el club.
        clubId: toClubId ?? original.clubId,
        groupId: toClubId ? null : original.groupId,
        sport: original.sport,
        // Si quien duplica puede editar la original, mantiene el monitor;
        // si es otro monitor del club, la copia la imparte él.
        coachId: editableOriginal ? original.coachId : null,
        status: "scheduled",
      })
      .returning({ id: sessions.id });

    for (const block of blocks) {
      const [newBlock] = await tx
        .insert(sessionBlocks)
        .values({
          sessionId: created.id,
          orderIndex: block.orderIndex,
          title: block.title,
          notes: block.notes,
        })
        .returning({ id: sessionBlocks.id });
      const blockItems = items.filter((item) => item.blockId === block.id);
      if (blockItems.length > 0) {
        await tx.insert(sessionBlockItems).values(
          blockItems.map((item) => ({
            blockId: newBlock.id,
            exerciseId: remapExerciseId(item.exerciseId, exerciseMap),
            exerciseName: item.exerciseName,
            exerciseDescription: item.exerciseDescription,
            freeText: item.freeText,
            title: item.title,
            kind: item.kind,
            stations: remapStations(item.stations, exerciseMap),
            aspectoJuego: item.aspectoJuego,
            orderIndex: item.orderIndex,
            durationMinutes: item.durationMinutes,
            notes: item.notes,
          }))
        );
      }
    }

    if (legacyExercises.length > 0) {
      await tx.insert(sessionExercises).values(
        legacyExercises.map((e) => ({
          sessionId: created.id,
          exerciseId: remapExerciseId(e.exerciseId, exerciseMap),
          orderIndex: e.orderIndex,
          durationMinutes: e.durationMinutes,
          notes: e.notes,
          phase: e.phase,
          intensity: e.intensity,
        }))
      );
    }

    if (students.length > 0 && !toClubId) {
      await tx.insert(sessionStudents).values(
        students.map((s) => ({
          sessionId: created.id,
          studentId: s.studentId,
        }))
      );
    }

    return created.id;
  });

  return NextResponse.json({ data: { id: newId } }, { status: 201 });
}
