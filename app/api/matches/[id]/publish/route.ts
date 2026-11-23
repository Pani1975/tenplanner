import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/matches/server";

type Ctx = { params: Promise<{ id: string }> };

// Publicar o retirar un partido del palmarés público (solo el dueño).
export async function POST(request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { publish?: unknown };
  if (typeof body.publish !== "boolean" || !isUuid(id))
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const rows = await db
    .update(matches)
    .set({ showOnProfile: body.publish })
    .where(and(eq(matches.id, id), eq(matches.userId, user.id)))
    .returning({ id: matches.id });
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, publish: body.publish });
}
