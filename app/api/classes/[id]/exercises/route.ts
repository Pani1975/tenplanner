import { NextResponse } from "next/server";
import { and, eq, max, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  classes,
  classBlocks,
  classBlockExercises,
  exercises,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { exerciseOwnOrClubCondition } from "@/lib/exercise-access";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  exerciseId: z.string().uuid(),
  // 1 = bloque inicial, 2 = principal, 3 = final
  blockOrder: z.number().int().min(1).max(3).default(2),
});

/**
 * Añade un ejercicio al final de un bloque de una clase en borrador del
 * usuario. Si el bloque todavía no existe, se crea.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  const { exerciseId, blockOrder } = parsed.data;

  const [cls] = await db
    .select({ id: classes.id, status: classes.status })
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.createdBy, user.id)))
    .limit(1);
  if (!cls)
    return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  if (cls.status !== "draft")
    return NextResponse.json(
      { error: "Solo se pueden añadir ejercicios a clases en borrador." },
      { status: 409 }
    );

  const [exercise] = await db
    .select({ id: exercises.id, durationMinutes: exercises.durationMinutes })
    .from(exercises)
    .where(
      and(
        eq(exercises.id, exerciseId),
        or(eq(exercises.isGlobal, true), exerciseOwnOrClubCondition(user.id))
      )
    )
    .limit(1);
  if (!exercise)
    return NextResponse.json(
      { error: "Ejercicio no accesible" },
      { status: 400 }
    );

  try {
    await db.transaction(async (tx) => {
      const existingBlock = await tx
        .select({ id: classBlocks.id })
        .from(classBlocks)
        .where(
          and(
            eq(classBlocks.classId, id),
            eq(classBlocks.orderIndex, blockOrder)
          )
        )
        .limit(1);
      let blockId = existingBlock[0]?.id;
      if (!blockId) {
        const created = await tx
          .insert(classBlocks)
          .values({ classId: id, orderIndex: blockOrder })
          .returning({ id: classBlocks.id });
        blockId = created[0]?.id;
      }
      if (!blockId) throw new Error("No se pudo crear el bloque");

      const lastRows = await tx
        .select({ lastOrder: max(classBlockExercises.orderIndex) })
        .from(classBlockExercises)
        .where(eq(classBlockExercises.blockId, blockId));
      const nextOrder = (lastRows[0]?.lastOrder ?? -1) + 1;

      await tx.insert(classBlockExercises).values({
        blockId,
        exerciseId: exercise.id,
        orderIndex: nextOrder,
        durationMinutes: exercise.durationMinutes,
        kind: "exercise",
      });
      await tx
        .update(classes)
        .set({ updatedAt: new Date() })
        .where(eq(classes.id, id));
    });
  } catch (err) {
    console.error("Error adding exercise to class:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ data: { classId: id } }, { status: 201 });
}
