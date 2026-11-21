import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteMatch, getMatch, updateMatch } from "@/lib/matches/server";
import { todayInSpain, validateMatch } from "@/lib/matches/validation";

type Ctx = { params: Promise<{ id: string }> };

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Un partido ajeno responde 404, igual que uno que no existe.
export async function GET(_request: Request, ctx: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await getMatch(userId, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ match: row });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = validateMatch((body ?? {}) as object, todayInSpain());
  if (!result.ok)
    return NextResponse.json({ errors: result.errors }, { status: 422 });

  const row = await updateMatch(userId, id, result.data);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ match: row });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const deleted = await deleteMatch(userId, id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
