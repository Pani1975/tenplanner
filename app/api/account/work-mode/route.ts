import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkClubId,
  getClubOptionsForUser,
  setActiveWorkClub,
} from "@/lib/clubs";
import { enterTenPlannerMode, isTenPlannerMode } from "@/lib/work-mode";

// { clubId: "…" } = club, { clubId: null } = particular,
// { mode: "tenplanner" } = Modo Ten Planner (solo administradores).
const bodySchema = z.union([
  z.object({ mode: z.literal("tenplanner") }),
  z.object({ clubId: z.string().uuid().nullable() }),
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeClubId, options, tenPlannerMode] = await Promise.all([
    getActiveWorkClubId(user.id),
    getClubOptionsForUser(user.id),
    isTenPlannerMode(user.id),
  ]);

  return NextResponse.json({
    data: { activeClubId, options, tenPlannerMode },
  });
}

export async function PATCH(request: Request) {
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
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  if ("mode" in parsed.data) {
    try {
      await enterTenPlannerMode(user.id);
    } catch {
      return NextResponse.json(
        { error: "Solo los administradores pueden usar el Modo Ten Planner." },
        { status: 403 }
      );
    }
    return NextResponse.json({
      ok: true,
      data: { activeClubId: null, tenPlannerMode: true },
    });
  }

  try {
    await setActiveWorkClub(user.id, parsed.data.clubId);
  } catch {
    return NextResponse.json(
      { error: "No perteneces a ese club." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: { activeClubId: parsed.data.clubId, tenPlannerMode: false },
  });
}
