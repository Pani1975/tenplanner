import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { markMessagesRead } from "@/lib/messages";

const bodySchema = z.object({ ids: z.array(z.string().uuid()).max(100) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }
  await markMessagesRead(user.id, parsed.data.ids);
  return NextResponse.json({ data: { ok: true } });
}
