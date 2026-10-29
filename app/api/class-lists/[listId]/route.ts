import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classLists } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  canManageList,
  getListInActiveSpace,
  isUserAdmin,
} from "@/lib/classes/lists";

type RouteContext = { params: Promise<{ listId: string }> };

const paramsSchema = z.object({
  listId: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  emoji: z.string().max(10).optional(),
  // Solo admins: publica la lista en la Biblioteca para que otros la copien.
  isPublic: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsedBody = updateSchema.safeParse(body);
  if (!parsedBody.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const list = await getListInActiveSpace(parsedParams.data.listId, user.id);
  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  if (!(await canManageList(list, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (parsedBody.data.isPublic !== undefined && !(await isUserAdmin(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [updated] = await db
    .update(classLists)
    .set(parsedBody.data)
    .where(eq(classLists.id, list.id))
    .returning();
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });

  const list = await getListInActiveSpace(parsedParams.data.listId, user.id);
  if (!list)
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  if (!(await canManageList(list, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(classLists).where(eq(classLists.id, list.id));
  return NextResponse.json({ ok: true });
}
