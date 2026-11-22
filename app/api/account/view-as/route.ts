import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

// «Ver como» club / monitor / jugador. Solo administradores (lib/view-as.ts).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
  const mode = body.mode;
  if (mode !== "club" && mode !== "monitor" && mode !== "jugador")
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });

  // Ver como monitor o jugador sale del Modo administrador y del Modo
  // gestión; al volver a «club» se queda en el modo de su club.
  if (mode !== "club") {
    await db
      .update(users)
      .set({ adminMode: false, managementMode: false })
      .where(eq(users.id, user.id));
  }

  const res = NextResponse.json({ ok: true, mode });
  if (mode === "club") {
    res.cookies.delete(VIEW_AS_COOKIE);
  } else {
    res.cookies.set(VIEW_AS_COOKIE, mode, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
