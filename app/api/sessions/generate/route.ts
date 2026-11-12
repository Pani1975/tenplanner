import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId } from "@/lib/clubs";
import { GOLPES } from "@/lib/session-engine/types";
import { buildProposal } from "@/lib/session-engine/today";

// Propuesta del motor "Monta la clase" (no guarda nada). El guardado va por
// POST /api/sessions con createdVia = "engine".

const bodySchema = z.object({
  groupId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.union([
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90),
  ]),
  intensity: z.enum(["suave", "media", "alta"]),
  focus: z.enum(["auto", "tactica", "fisico", ...GOLPES]),
  attendeeIds: z.array(z.string().uuid()).max(100).nullable(),
  pinned: z
    .array(
      z.object({
        slotIndex: z.number().int().min(0).max(20),
        exerciseId: z.string().uuid(),
        minutes: z.number().int().min(1).max(120).optional(),
      })
    )
    .max(20)
    .optional(),
  previousIds: z.array(z.string().uuid()).max(20).optional(),
  slotAdjust: z
    .object({
      slotIndex: z.number().int().min(0).max(20),
      levelShift: z
        .union([z.literal(-1), z.literal(0), z.literal(1)])
        .optional(),
      excludeIds: z.array(z.string().uuid()).max(50).optional(),
    })
    .optional(),
  variant: z.number().int().min(0).max(10_000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const activeClubId = await getActiveWorkClubId(user.id);
    const proposal = await buildProposal(user.id, activeClubId, parsed.data);
    if (!proposal) {
      return NextResponse.json(
        { error: "Grupo no encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json({ data: proposal });
  } catch (error) {
    console.error("[sessions/generate]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
