import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateProfile } from "@/lib/players/profile";
import { getPlayerProfile, savePlayerProfile } from "@/lib/players/server";
import { todayInSpain } from "@/lib/matches/validation";

// Perfil del jugador que ha iniciado sesión (solo el suyo).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ profile: await getPlayerProfile(user.id) });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = validateProfile((body ?? {}) as object, todayInSpain());
  if (!result.ok)
    return NextResponse.json({ errors: result.errors }, { status: 422 });

  const profile = await savePlayerProfile(user.id, result.data);
  return NextResponse.json({ profile });
}
