import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { sessions, sessionExercises } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  dates: z
    .array(z.string().datetime("Fecha ISO inválida"))
    .min(1, "Debes indicar al menos una fecha")
    .max(60, "Máximo 60 repeticiones"),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const [original] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .limit(1);
  if (!original)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const originalExercises = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, id))
    .orderBy(asc(sessionExercises.orderIndex));

  const createdIds: string[] = [];
  await db.transaction(async (tx) => {
    for (const dateStr of parsed.data.dates) {
      const [created] = await tx
        .insert(sessions)
        .values({
          title: original.title,
          description: original.description,
          scheduledAt: new Date(dateStr),
          durationMinutes: original.durationMinutes,
          userId: user.id,
          objective: original.objective,
          material: original.material,
          observations: original.observations,
          intensity: original.intensity,
          tags: original.tags,
          location: original.location,
          placeId: original.placeId,
          status: "scheduled",
        })
        .returning({ id: sessions.id });

      if (originalExercises.length > 0) {
        await tx.insert(sessionExercises).values(
          originalExercises.map((e) => ({
            sessionId: created.id,
            exerciseId: e.exerciseId,
            orderIndex: e.orderIndex,
            durationMinutes: e.durationMinutes,
            notes: e.notes,
            phase: e.phase,
            intensity: e.intensity,
          }))
        );
      }
      createdIds.push(created.id);
    }
  });

  return NextResponse.json({ ok: true, createdCount: createdIds.length });
}
