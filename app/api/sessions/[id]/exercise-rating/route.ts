import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions, sessionExercises } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { canEditSession } from "@/lib/sessions/permissions";

const patchSchema = z.object({
  exerciseId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await context.params;

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

  const [session] = await db
    .select({
      userId: sessions.userId,
      coachId: sessions.coachId,
      clubId: sessions.clubId,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canEditSession(user.id, session)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db
    .update(sessionExercises)
    .set({ coachRating: parsed.data.rating })
    .where(
      and(
        eq(sessionExercises.sessionId, sessionId),
        eq(sessionExercises.exerciseId, parsed.data.exerciseId)
      )
    );

  return NextResponse.json({ ok: true });
}
