import { and, asc, eq, inArray } from "drizzle-orm";
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

const schema = z.object({
  scheduledAt: z.string().datetime(),
  title: z.string().trim().min(1).max(255).optional(),
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

  const [original] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .limit(1);
  if (!original)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

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
        sourceClassId: original.sourceClassId,
        intensity: original.intensity,
        tags: original.tags,
        location: original.location,
        placeId: original.placeId,
        // Mismo espacio (club o particular), grupo y deporte que el original:
        // sin esto la copia caía en el modo particular y no se veía en el club.
        clubId: original.clubId,
        groupId: original.groupId,
        sport: original.sport,
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
            exerciseId: item.exerciseId,
            exerciseName: item.exerciseName,
            exerciseDescription: item.exerciseDescription,
            freeText: item.freeText,
            title: item.title,
            kind: item.kind,
            stations: item.stations,
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
          exerciseId: e.exerciseId,
          orderIndex: e.orderIndex,
          durationMinutes: e.durationMinutes,
          notes: e.notes,
          phase: e.phase,
          intensity: e.intensity,
        }))
      );
    }

    if (students.length > 0) {
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
