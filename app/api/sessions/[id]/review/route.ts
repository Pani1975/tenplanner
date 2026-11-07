import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

// Valoración de la clase al terminarla: de 1 a 5 estrellas (obligatoria) y un
// comentario opcional.
const patchSchema = z.object({
  coachRating: z.number().int().min(1).max(5),
  coachComment: z.string().trim().max(2000).nullable().optional(),
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
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.userId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const setValues: Record<string, unknown> = {
    coachRating: parsed.data.coachRating,
  };
  if (parsed.data.coachComment !== undefined) {
    setValues.coachComment = parsed.data.coachComment || null;
  }

  await db
    .update(sessions)
    .set(setValues)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));

  return NextResponse.json({ ok: true });
}
