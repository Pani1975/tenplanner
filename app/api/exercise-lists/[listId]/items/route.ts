import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseListItems } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getExerciseListInActiveSpace } from "@/lib/exercises/lists";
import { getAccessibleExerciseDurationMap } from "@/lib/exercise-access";
import { z } from "zod";

type Context = { params: Promise<{ listId: string }> };

// Cualquier miembro del espacio de la lista (particular: su autor; club:
// todos sus miembros activos) puede añadir y quitar ejercicios.
async function assertOwner(userId: string, listId: string) {
  return !!(await getExerciseListInActiveSpace(listId, userId));
}

export async function POST(request: Request, context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await context.params;
  if (!(await assertOwner(user.id, listId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z.object({ exerciseId: z.string().uuid() }).safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const { inaccessibleIds } = await getAccessibleExerciseDurationMap(user.id, [
    parsed.data.exerciseId,
  ]);
  if (inaccessibleIds.length > 0) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  await db
    .insert(exerciseListItems)
    .values({ listId, exerciseId: parsed.data.exerciseId })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request, context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await context.params;
  if (!(await assertOwner(user.id, listId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z.object({ exerciseId: z.string().uuid() }).safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  await db
    .delete(exerciseListItems)
    .where(
      and(
        eq(exerciseListItems.listId, listId),
        eq(exerciseListItems.exerciseId, parsed.data.exerciseId)
      )
    );

  return NextResponse.json({ ok: true });
}
