import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { familyRespond } from "@/lib/tournaments/family";
import { TournamentError } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ entryId: string }> };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  side: z.enum(["player", "partner"]),
  action: z.enum(["consent", "decline"]),
});

// La familia (o el jugador adulto) da su consentimiento o dice que no
// participa. Solo un tutor activo del alumno de ese lado.
export async function POST(request: Request, ctx: Ctx) {
  const { entryId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!UUID.test(entryId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  try {
    const r = await familyRespond(
      user.id,
      entryId,
      parsed.data.side,
      parsed.data.action
    );
    return NextResponse.json(
      { data: { status: r.status } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof TournamentError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    console.error("[torneos familia]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
