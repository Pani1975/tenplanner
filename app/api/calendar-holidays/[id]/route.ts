import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { calendarHolidays } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId, getOwnedClub } from "@/lib/clubs";
import { groupIsInSpace } from "@/lib/calendar/holidays-server";
import { holidaySchema } from "@/lib/calendar/holiday-schema";

type Ctx = { params: Promise<{ id: string }> };

/** Editable por quien lo creó o por el dueño del club al que pertenece. */
async function loadEditable(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(calendarHolidays)
    .where(eq(calendarHolidays.id, id))
    .limit(1);
  if (!row) return null;
  if (row.userId === userId) return row;
  if (row.clubId) {
    const owned = await getOwnedClub(userId);
    if (owned?.id === row.clubId) return row;
  }
  return null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = holidaySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const existing = await loadEditable(id, user.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.groupId && parsed.data.groupId !== existing.groupId) {
    const activeClubId = await getActiveWorkClubId(user.id);
    if (!(await groupIsInSpace(parsed.data.groupId, user.id, activeClubId)))
      return NextResponse.json({ error: "Grupo no válido" }, { status: 422 });
  }

  const [updated] = await db
    .update(calendarHolidays)
    .set({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      groupId: parsed.data.groupId ?? null,
    })
    .where(eq(calendarHolidays.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const existing = await loadEditable(id, user.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(calendarHolidays).where(eq(calendarHolidays.id, id));
  return NextResponse.json({ ok: true });
}
