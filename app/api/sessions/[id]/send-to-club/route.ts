import { and, eq, inArray, isNull } from "drizzle-orm";
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
import { canTagWithClub } from "@/lib/clubs";
import {
  remapExerciseId,
  remapStations,
  sendPrivateExercisesToClub,
  stationExerciseIds,
} from "@/lib/club-transfer";

const schema = z.object({ clubId: z.string().uuid() });

type Ctx = { params: Promise<{ id: string }> };

/**
 * "Enviar al club" de una sesión del espacio propio del monitor (Modo
 * monitor): la sesión se MUEVE al club (no se duplica) y pasa a ser una
 * sesión del club que imparte él, así que la sigue viendo en su espacio
 * (Sesiones y Calendario del Modo monitor).
 *
 * Lo que es solo de su espacio no viaja: alumnos, grupo, lugar y clase de
 * origen. Sus ejercicios privados que usa la sesión se envían al club como
 * copias del club, para que el resto de monitores pueda verlos.
 */
export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });
  const { clubId } = parsed.data;

  const [original] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, id),
        eq(sessions.userId, user.id),
        isNull(sessions.clubId)
      )
    )
    .limit(1);
  if (!original)
    return NextResponse.json(
      { error: "Solo puedes enviar al club sesiones de tu espacio." },
      { status: 403 }
    );
  if (!(await canTagWithClub(user.id, clubId)))
    return NextResponse.json(
      { error: "No eres monitor de ese club." },
      { status: 403 }
    );

  const blocks = await db
    .select({ id: sessionBlocks.id })
    .from(sessionBlocks)
    .where(eq(sessionBlocks.sessionId, id));
  const blockIds = blocks.map((b) => b.id);
  const [items, legacyExercises] = await Promise.all([
    blockIds.length > 0
      ? db
          .select({
            id: sessionBlockItems.id,
            exerciseId: sessionBlockItems.exerciseId,
            stations: sessionBlockItems.stations,
          })
          .from(sessionBlockItems)
          .where(inArray(sessionBlockItems.blockId, blockIds))
      : Promise.resolve([]),
    db
      .select({
        id: sessionExercises.id,
        exerciseId: sessionExercises.exerciseId,
      })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, id)),
  ]);

  await db.transaction(async (tx) => {
    const exerciseMap = await sendPrivateExercisesToClub(
      tx,
      [
        ...items.flatMap((i) => [
          i.exerciseId,
          ...stationExerciseIds(i.stations),
        ]),
        ...legacyExercises.map((e) => e.exerciseId),
      ],
      user.id,
      clubId
    );
    if (exerciseMap.size > 0) {
      for (const item of items) {
        const exerciseId = remapExerciseId(item.exerciseId, exerciseMap);
        const stations = remapStations(item.stations, exerciseMap);
        if (
          exerciseId !== item.exerciseId ||
          JSON.stringify(stations) !== JSON.stringify(item.stations)
        )
          await tx
            .update(sessionBlockItems)
            .set({ exerciseId, stations })
            .where(eq(sessionBlockItems.id, item.id));
      }
      for (const e of legacyExercises) {
        const exerciseId = remapExerciseId(e.exerciseId, exerciseMap);
        if (exerciseId !== e.exerciseId)
          await tx
            .update(sessionExercises)
            .set({ exerciseId })
            .where(eq(sessionExercises.id, e.id));
      }
    }
    await tx.delete(sessionStudents).where(eq(sessionStudents.sessionId, id));
    await tx
      .update(sessions)
      .set({
        clubId,
        coachId: null, // la imparte él (el creador)
        groupId: null,
        placeId: null,
        sourceClassId: null,
      })
      .where(eq(sessions.id, id));
  });

  return NextResponse.json({ data: { id } });
}
