import { and, asc, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calendarHolidays } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { groupIsInSpace } from "@/lib/calendar/holidays-server";
import { dateOnly, holidaySchema } from "@/lib/calendar/holiday-schema";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const activeClubId = await getActiveWorkClubId(user.id);
  const conditions = [
    sharedWithClubCondition(
      calendarHolidays.userId,
      calendarHolidays.clubId,
      user.id,
      activeClubId
    ),
  ];
  // Un festivo entra en la ventana si su rango se solapa con ella.
  if (from && dateOnly.safeParse(from).success)
    conditions.push(gte(calendarHolidays.endDate, from));
  if (to && dateOnly.safeParse(to).success)
    conditions.push(lte(calendarHolidays.startDate, to));

  const rows = await db
    .select()
    .from(calendarHolidays)
    .where(and(...conditions))
    .orderBy(asc(calendarHolidays.startDate));

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const clubId = await getActiveWorkClubId(user.id);

  if (
    parsed.data.groupId &&
    !(await groupIsInSpace(parsed.data.groupId, user.id, clubId))
  ) {
    return NextResponse.json({ error: "Grupo no válido" }, { status: 422 });
  }

  const [created] = await db
    .insert(calendarHolidays)
    .values({
      userId: user.id,
      clubId,
      groupId: parsed.data.groupId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    })
    .returning();

  return NextResponse.json({ data: created }, { status: 201 });
}
