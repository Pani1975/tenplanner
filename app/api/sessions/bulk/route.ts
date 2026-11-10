import { and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { editableSessionCondition } from "@/lib/sessions/permissions";

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

// Elimina varias sesiones del monitor de una vez. Solo borra las que son suyas.
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  try {
    const deleted = await db
      .delete(sessions)
      .where(
        and(
          await editableSessionCondition(user.id),
          inArray(sessions.id, Array.from(new Set(parsed.data.ids)))
        )
      )
      .returning({ id: sessions.id });
    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
