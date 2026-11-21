import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMatch, listMatches } from "@/lib/matches/server";
import {
  isMatchType,
  todayInSpain,
  validateMatch,
} from "@/lib/matches/validation";

// Mis partidos: solo los del usuario que ha iniciado sesión.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("tipo");
  const year = Number(searchParams.get("anio"));
  const rows = await listMatches(user.id, {
    type: isMatchType(type) ? type : null,
    year: Number.isInteger(year) && year > 1900 ? year : null,
  });
  return NextResponse.json({ matches: rows });
}

export async function POST(request: Request) {
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
  const result = validateMatch((body ?? {}) as object, todayInSpain());
  if (!result.ok)
    return NextResponse.json({ errors: result.errors }, { status: 422 });

  const row = await createMatch(user.id, result.data);
  return NextResponse.json({ match: row }, { status: 201 });
}
