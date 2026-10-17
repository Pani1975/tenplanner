import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubInvites } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ token: z.string().min(10) });

/** El monitor invitado rechaza la invitación (solo la suya, por email). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Token inválido." }, { status: 422 });
  }

  const [updated] = await db
    .update(clubInvites)
    .set({ status: "revoked" })
    .where(
      and(
        eq(clubInvites.token, parsed.data.token),
        eq(clubInvites.status, "pending"),
        sql`lower(${clubInvites.email}) = ${user.email.toLowerCase()}`
      )
    )
    .returning({ id: clubInvites.id });

  if (!updated) {
    return NextResponse.json(
      { error: "Invitación no encontrada." },
      { status: 404 }
    );
  }
  return NextResponse.json({ data: updated });
}
