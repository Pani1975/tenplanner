import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { PLAN_CHANGE_REASON_IDS } from "@/lib/sessions/plan-change";

// Cierre de la clase: valoración de 1 a 5 estrellas y comentario opcional, y
// si se dio tal y como estaba planificada (con el motivo si cambió). Si la
// sesión cambió, primero se guarda el plan y la valoración llega después de
// editarla, por eso cada campo es opcional (pero hace falta alguno).
const patchSchema = z
  .object({
    coachRating: z.number().int().min(1).max(5).optional(),
    coachComment: z.string().trim().max(2000).nullable().optional(),
    planFollowed: z.boolean().optional(),
    planChangeReason: z.enum(PLAN_CHANGE_REASON_IDS).nullable().optional(),
    // Texto libre cuando el motivo es "Otro motivo" (se guarda en status_note).
    planChangeNote: z.string().trim().max(300).nullable().optional(),
  })
  .refine((v) => v.coachRating !== undefined || v.planFollowed !== undefined, {
    message: "Falta la valoración o la respuesta sobre el plan.",
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

  const setValues: Record<string, unknown> = {};
  if (parsed.data.coachRating !== undefined) {
    setValues.coachRating = parsed.data.coachRating;
  }
  if (parsed.data.planFollowed !== undefined) {
    setValues.planFollowed = parsed.data.planFollowed;
    setValues.planChangeReason = parsed.data.planFollowed
      ? null
      : (parsed.data.planChangeReason ?? null);
    setValues.statusNote =
      !parsed.data.planFollowed && parsed.data.planChangeReason === "otro"
        ? parsed.data.planChangeNote || null
        : null;
  }
  if (parsed.data.coachComment !== undefined) {
    setValues.coachComment = parsed.data.coachComment || null;
  }

  await db
    .update(sessions)
    .set(setValues)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));

  return NextResponse.json({ ok: true });
}
