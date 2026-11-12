import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  exercises,
  sessionExercises,
  sessionTemplateAdoptions,
  sessionTemplateExercises,
  sessionTemplates,
  sessions,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getBooleanSetting } from "@/lib/app-settings";
import { z } from "zod";

const adoptTemplateSchema = z.object({
  scheduledAt: z
    .string()
    .trim()
    .max(40)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Invalid scheduledAt",
    })
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templatesEnabled = await getBooleanSetting(
    "feature.session_templates_enabled"
  );
  if (!templatesEnabled) {
    return NextResponse.json(
      { error: "Las plantillas de sesión están desactivadas." },
      { status: 403 }
    );
  }

  const { id: templateId } = await params;

  const [template] = await db
    .select()
    .from(sessionTemplates)
    .where(eq(sessionTemplates.id, templateId))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = adoptTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { scheduledAt } = parsed.data;

  // Ensure coach user row exists
  if (user.email) {
    const metadataName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user.email;
    await db
      .insert(users)
      .values({ id: user.id, name: metadataName, email: user.email })
      .onConflictDoNothing();
  }

  const templateExerciseRows = await db
    .select()
    .from(sessionTemplateExercises)
    .where(eq(sessionTemplateExercises.templateId, templateId))
    .orderBy(sessionTemplateExercises.orderIndex);

  // Resolve exercises: clone non-global exercises that don't belong to this coach
  const exerciseIdMap: Record<string, string> = {};

  for (const te of templateExerciseRows) {
    const [ex] = await db
      .select({
        id: exercises.id,
        isGlobal: exercises.isGlobal,
        createdBy: exercises.createdBy,
      })
      .from(exercises)
      .where(eq(exercises.id, te.exerciseId))
      .limit(1);

    if (!ex) continue;

    if (ex.isGlobal || ex.createdBy === user.id) {
      exerciseIdMap[te.exerciseId] = te.exerciseId;
    } else {
      // Clone the exercise for this coach
      const [original] = await db
        .select()
        .from(exercises)
        .where(eq(exercises.id, te.exerciseId))
        .limit(1);

      if (!original) continue;

      const {
        id: originalId,
        createdAt: originalCreatedAt,
        updatedAt: originalUpdatedAt,
        isGlobal: originalIsGlobal,
        createdBy: originalCreatedBy,
        ...rest
      } = original;
      void originalId;
      void originalCreatedAt;
      void originalUpdatedAt;
      void originalIsGlobal;
      void originalCreatedBy;
      const [cloned] = await db
        .insert(exercises)
        .values({ ...rest, isGlobal: false, createdBy: user.id })
        .returning({ id: exercises.id });

      exerciseIdMap[te.exerciseId] = cloned.id;
    }
  }

  const resolvedAt = scheduledAt ? new Date(scheduledAt) : new Date();

  const [newSession] = await db
    .insert(sessions)
    .values({
      createdVia: "template",
      userId: user.id,
      title: template.title,
      description: template.description,
      objective: template.objective,
      scheduledAt: resolvedAt,
      durationMinutes: template.durationMinutes,
      intensity: template.intensity,
      tags: template.tags,
      location: template.location,
      status: "scheduled",
    })
    .returning();

  if (templateExerciseRows.length > 0) {
    await db.insert(sessionExercises).values(
      templateExerciseRows
        .filter((te) => exerciseIdMap[te.exerciseId])
        .map((te) => ({
          sessionId: newSession.id,
          exerciseId: exerciseIdMap[te.exerciseId],
          orderIndex: te.orderIndex,
          durationMinutes: te.durationMinutes,
          notes: te.notes,
          phase: te.phase,
          intensity: te.intensity,
        }))
    );
  }

  await db.insert(sessionTemplateAdoptions).values({
    templateId,
    coachId: user.id,
    sessionId: newSession.id,
  });

  await db
    .update(sessionTemplates)
    .set({ adoptionsCount: sql`${sessionTemplates.adoptionsCount} + 1` })
    .where(eq(sessionTemplates.id, templateId));

  return NextResponse.json(
    { data: { sessionId: newSession.id } },
    { status: 201 }
  );
}
