import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classListItems, classLists, classes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { classDraftVisibility } from "@/lib/classes/visibility";

type RouteContext = { params: Promise<{ listId: string }> };

const paramsSchema = z.object({
  listId: z.string().uuid(),
});

const itemSchema = z.object({
  classId: z.string().uuid(),
});

async function ensureOwnedList(listId: string, userId: string) {
  const [list] = await db
    .select({ id: classLists.id })
    .from(classLists)
    .where(and(eq(classLists.id, listId), eq(classLists.userId, userId)))
    .limit(1);
  return list;
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = itemSchema.safeParse(body);
  if (!parsedBody.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const list = await ensureOwnedList(parsedParams.data.listId, user.id);
  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  const classActiveClubId = await getActiveWorkClubId(user.id);
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(
      and(
        eq(classes.id, parsedBody.data.classId),
        or(
          eq(classes.isLibrary, true),
          sharedWithClubCondition(
            classes.createdBy,
            classes.clubId,
            user.id,
            classActiveClubId
          )
        )!,
        classDraftVisibility(user.id)
      )
    )
    .limit(1);
  if (!cls)
    return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const [item] = await db
    .insert(classListItems)
    .values({
      listId: parsedParams.data.listId,
      classId: parsedBody.data.classId,
    })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json({ data: item ?? null }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });

  const parsedBody = itemSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsedBody.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const list = await ensureOwnedList(parsedParams.data.listId, user.id);
  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  await db
    .delete(classListItems)
    .where(
      and(
        eq(classListItems.listId, parsedParams.data.listId),
        eq(classListItems.classId, parsedBody.data.classId)
      )
    );

  return NextResponse.json({ ok: true });
}
