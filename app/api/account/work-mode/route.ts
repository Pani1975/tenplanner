import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkClubId,
  getClubOptionsForUser,
  setActiveWorkClub,
} from "@/lib/clubs";
import {
  enterAdminMode,
  enterManagementMode,
  getManagementClubId,
  isTenPlannerMode,
  resetToDefaultWorkMode,
} from "@/lib/work-mode";

// { clubId: "…" } = club, { clubId: null } = particular,
// { mode: "tenplanner" } = Modo administrador (solo administradores),
// { mode: "gestion" } = Modo gestión (solo la cuenta de un club),
// { mode: "default" } = el modo por defecto de la cuenta (al iniciar sesión).
const bodySchema = z.union([
  z.object({ mode: z.enum(["tenplanner", "gestion", "default"]) }),
  z.object({ clubId: z.string().uuid().nullable() }),
]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeClubId, options, tenPlannerMode, managementClubId] =
    await Promise.all([
      getActiveWorkClubId(user.id),
      getClubOptionsForUser(user.id),
      isTenPlannerMode(user.id),
      getManagementClubId(user.id),
    ]);

  return NextResponse.json({
    data: {
      activeClubId,
      options,
      tenPlannerMode,
      managementMode: !!managementClubId,
    },
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

  if ("mode" in parsed.data && parsed.data.mode === "default") {
    await resetToDefaultWorkMode(user.id);
    return NextResponse.json({ ok: true });
  }

  if ("mode" in parsed.data && parsed.data.mode === "gestion") {
    try {
      const clubId = await enterManagementMode(user.id);
      return NextResponse.json({
        ok: true,
        data: {
          activeClubId: clubId,
          tenPlannerMode: false,
          managementMode: true,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Solo la cuenta del club puede usar el Modo gestión." },
        { status: 403 }
      );
    }
  }

  if ("mode" in parsed.data) {
    try {
      await enterAdminMode(user.id);
    } catch {
      return NextResponse.json(
        {
          error: "Solo los administradores pueden usar el Modo administrador.",
        },
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
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message === "club_account"
            ? "La cuenta de un club trabaja siempre en su club."
            : "No perteneces a ese club.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: { activeClubId: parsed.data.clubId, tenPlannerMode: false },
  });
}
