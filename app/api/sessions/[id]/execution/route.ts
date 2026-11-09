import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessionExercises, sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  sessionCloseFields,
  sessionCloseValues,
} from "@/lib/sessions/close-schema";

const executionItemSchema = z.object({
  exerciseId: z.string().uuid(),
  actualDurationSeconds: z.number().int().min(0).max(86400).optional(),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const executionSchema = z.object({
  exercises: z.array(executionItemSchema).min(1).max(80),
  completeSession: z.boolean().optional().default(true),
  ...sessionCloseFields,
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = executionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (session.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uniqueExerciseIds = Array.from(
    new Set(parsed.data.exercises.map((item) => item.exerciseId))
  );
  const existingRows = await db
    .select({ exerciseId: sessionExercises.exerciseId })
    .from(sessionExercises)
    .where(
      and(
        eq(sessionExercises.sessionId, sessionId),
        inArray(sessionExercises.exerciseId, uniqueExerciseIds)
      )
    );
  const existingIds = new Set(existingRows.map((row) => row.exerciseId));
  const invalidIds = uniqueExerciseIds.filter((id) => !existingIds.has(id));

  if (invalidIds.length > 0) {
    return NextResponse.json(
      {
        error: "Algunos ejercicios no pertenecen a esta sesión.",
        invalidExerciseIds: invalidIds,
      },
      { status: 400 }
    );
  }

  const completedAt = new Date();

  await db.transaction(async (tx) => {
    for (const item of parsed.data.exercises) {
      await tx
        .update(sessionExercises)
        .set({
          actualDurationSeconds: item.actualDurationSeconds ?? null,
          completedAt: item.completed === false ? null : completedAt,
          executionNotes: item.notes ?? null,
          coachRating: item.rating ?? null,
          wasSkipped: item.skipped ?? false,
        })
        .where(
          and(
            eq(sessionExercises.sessionId, sessionId),
            eq(sessionExercises.exerciseId, item.exerciseId)
          )
        );
    }

    if (parsed.data.completeSession) {
      await tx
        .update(sessions)
        .set({ status: "completed", ...sessionCloseValues(parsed.data) })
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
    }
  });

  return NextResponse.json({ ok: true });
}
