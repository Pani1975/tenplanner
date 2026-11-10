import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  canEditSession,
  editableSessionCondition,
} from "@/lib/sessions/permissions";

const patchSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]),
  statusNote: z.string().trim().max(2000).nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const [existing] = await db
    .select({
      userId: sessions.userId,
      coachId: sessions.coachId,
      clubId: sessions.clubId,
    })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditSession(user.id, existing)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const setValues: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.statusNote !== undefined) {
    setValues.statusNote = parsed.data.statusNote;
  }

  const [updated] = await db
    .update(sessions)
    .set(setValues)
    .where(and(eq(sessions.id, id), await editableSessionCondition(user.id)))
    .returning({
      id: sessions.id,
      status: sessions.status,
      statusNote: sessions.statusNote,
    });

  return NextResponse.json({ data: updated });
}
