import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countUnreadMessages } from "@/lib/messages";

/** Contador de mensajes nuevos para el menú (se consulta periódicamente). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await countUnreadMessages(user.id).catch(() => 0);
  return NextResponse.json(
    { data: { count } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
