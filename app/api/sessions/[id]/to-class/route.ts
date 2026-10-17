import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  classBlockExercises,
  classBlocks,
  classes,
  exercises,
  sessionBlockItems,
  sessionBlocks,
  sessions,
  sessionStudents,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId } from "@/lib/clubs";
import { normalizeTags } from "@/lib/tags";
import { DEFAULT_BLOCK_ITEM_DURATION } from "@/lib/block-items";
import { hasSessionAnimation } from "@/lib/classes/animation";

type Ctx = { params: Promise<{ id: string }> };

// Guarda una sesión propia como clase en "Mis clases", con su misma
// información: nombre, duración, objetivo, material, observaciones (como
// aspectos importantes) y el plan por bloques. No copia lo que pasó al
// darla (asistencia, valoraciones, notas de ejecución) ni la fecha.
export async function POST(_request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .limit(1);
  if (!session)
    return NextResponse.json(
      { error: "Sesión no encontrada" },
      { status: 404 }
    );

  const blocks = await db
    .select()
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, id))
    .orderBy(asc(sessionBlocks.orderIndex));
  const items = blocks.length
    ? await db
        .select({
          item: sessionBlockItems,
          libraryDescription: exercises.description,
        })
        .from(sessionBlockItems)
        .leftJoin(exercises, eq(exercises.id, sessionBlockItems.exerciseId))
        .where(
          inArray(
            sessionBlockItems.blockId,
            blocks.map((b) => b.id)
          )
        )
        .orderBy(asc(sessionBlockItems.orderIndex))
    : [];
  const studentRows = await db
    .select({ id: sessionStudents.studentId })
    .from(sessionStudents)
    .where(eq(sessionStudents.sessionId, id));
  const studentCount = studentRows.length;

  const clubId = await getActiveWorkClubId(user.id);

  const classId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(classes)
      .values({
        createdBy: user.id,
        name: session.title.slice(0, 255),
        duracionMinutes: session.durationMinutes,
        alumnosTipo:
          studentCount > 1 || session.groupId
            ? "grupal"
            : studentCount === 1
              ? "individual"
              : null,
        numAlumnos: studentCount > 0 ? studentCount : null,
        objetivos: session.objective,
        material: session.material,
        aspectosImportantes: session.observations,
        tags: normalizeTags(session.tags),
        // Si la sesión tenía animación, la clase también.
        animationEnabled: hasSessionAnimation(id),
        isLibrary: false,
        autoria: "libre",
        clubId,
        sport: session.sport,
        status: "published",
      })
      .returning({ id: classes.id });

    for (const block of blocks) {
      const [createdBlock] = await tx
        .insert(classBlocks)
        .values({
          classId: created.id,
          orderIndex: block.orderIndex,
          title: block.title,
          notes: block.notes,
        })
        .returning({ id: classBlocks.id });

      const blockItems = items.filter((r) => r.item.blockId === block.id);
      if (blockItems.length === 0) continue;
      await tx.insert(classBlockExercises).values(
        blockItems.map(({ item, libraryDescription }) => {
          // La descripción propia de la sesión (si difiere de la de la
          // biblioteca) se conserva como texto del item.
          const ownDescription =
            item.exerciseId &&
            item.exerciseDescription?.trim() &&
            item.exerciseDescription.trim() !== libraryDescription?.trim()
              ? item.exerciseDescription.trim()
              : null;
          return {
            blockId: createdBlock.id,
            exerciseId: item.exerciseId,
            freeText: item.freeText ?? ownDescription,
            title: item.title,
            notes: item.notes,
            orderIndex: item.orderIndex,
            // Un descanso sin minutos dura lo de por defecto en la sesión; en
            // la clase la duración del descanso es obligatoria.
            durationMinutes:
              item.durationMinutes ??
              (item.kind === "warmup" ? DEFAULT_BLOCK_ITEM_DURATION : null),
            kind: item.kind,
            stations: item.stations,
            aspectoJuego: item.aspectoJuego,
          };
        })
      );
    }

    // La sesión queda vinculada a su clase.
    await tx
      .update(sessions)
      .set({ sourceClassId: created.id })
      .where(eq(sessions.id, id));

    return created.id;
  });

  return NextResponse.json({ data: { classId } }, { status: 201 });
}
