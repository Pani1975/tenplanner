import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { courtBookings } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

// El dueño de la pista cancela una reserva (queda registrada como cancelada).
export async function DELETE(_request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(courtBookings)
    .set({ cancelledAt: new Date() })
    .where(
      and(
        eq(courtBookings.id, id),
        eq(courtBookings.ownerId, user.id),
        isNull(courtBookings.cancelledAt)
      )
    )
    .returning({ id: courtBookings.id });
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: { id: updated.id } });
}
