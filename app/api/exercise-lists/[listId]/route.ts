import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseLists, exerciseListItems } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getExerciseListInActiveSpace } from "@/lib/exercises/lists";
import { z } from "zod";

type Context = { params: Promise<{ listId: string }> };

export async function PATCH(request: Request, context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await context.params;

  const list = await getExerciseListInActiveSpace(listId, user.id);

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      emoji: z.string().max(10).optional(),
    })
    .safeParse(body);

  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const [updated] = await db
    .update(exerciseLists)
    .set({ ...parsed.data })
    .where(eq(exerciseLists.id, listId))
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await context.params;

  const list = await getExerciseListInActiveSpace(listId, user.id);

  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (list.isDefault) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(exerciseListItems)
      .where(eq(exerciseListItems.listId, listId));
    if (Number(total) > 0) {
      return NextResponse.json(
        {
          error:
            "No puedes eliminar la lista de favoritos principal mientras tenga ejercicios.",
        },
        { status: 409 }
      );
    }
  }

  await db.delete(exerciseLists).where(eq(exerciseLists.id, list.id));

  return NextResponse.json({ ok: true });
}
