import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions, sessionStudents, students } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { canEditSession } from "@/lib/sessions/permissions";

const patchSchema = z
  .object({
    studentId: z.string().uuid(),
    attended: z.boolean().optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    feedback: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (d) =>
      d.attended !== undefined ||
      d.rating !== undefined ||
      d.feedback !== undefined,
    { message: "Debes enviar al menos un campo a actualizar" }
  );

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

  // Verify session belongs to user
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

  // Verify student belongs to coach
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(eq(students.id, parsed.data.studentId), eq(students.coachId, user.id))
    )
    .limit(1);

  if (!student)
    return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const updateSet: Record<string, unknown> = {};
  if (parsed.data.attended !== undefined)
    updateSet.attended = parsed.data.attended;
  if (parsed.data.rating !== undefined) updateSet.rating = parsed.data.rating;
  if (parsed.data.feedback !== undefined) {
    updateSet.feedback = parsed.data.feedback;
    updateSet.feedbackAt = new Date();
  }

  // Upsert attendance / rating / feedback
  await db
    .insert(sessionStudents)
    .values({
      sessionId,
      studentId: parsed.data.studentId,
      attended: parsed.data.attended ?? null,
      rating: parsed.data.rating ?? null,
      feedback: parsed.data.feedback ?? null,
      feedbackAt: parsed.data.feedback !== undefined ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [sessionStudents.sessionId, sessionStudents.studentId],
      set: updateSet,
    });

  return NextResponse.json({ ok: true });
}
