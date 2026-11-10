import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { editableSessionCondition } from "@/lib/sessions/permissions";

const schema = z.object({
  scheduledAt: z.string().datetime(),
  title: z.string().trim().min(1).max(255).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

// Cambia la fecha/hora de una sesión (arrastrar en el calendario, "Mover").
export async function PATCH(request: Request, ctx: Ctx) {
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
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const [updated] = await db
    .update(sessions)
    .set({
      scheduledAt: new Date(parsed.data.scheduledAt),
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
    })
    .where(and(eq(sessions.id, id), await editableSessionCondition(user.id)))
    .returning({
      id: sessions.id,
      title: sessions.title,
      scheduledAt: sessions.scheduledAt,
    });
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    data: { ...updated, scheduledAt: updated.scheduledAt.toISOString() },
  });
}
