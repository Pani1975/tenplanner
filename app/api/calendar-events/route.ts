import { and, asc, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId } from "@/lib/clubs";
import {
  calendarEventsVisibility,
  isManagementWorkMode,
} from "@/lib/calendar-events";

const createSchema = z
  .object({
    title: z.string().trim().min(1, "Título obligatorio").max(255),
    description: z.string().trim().max(4000).optional().nullable(),
    startAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
    endAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  })
  .refine((v) => new Date(v.endAt) >= new Date(v.startAt), {
    message: "La fecha de finalización debe ser posterior a la de inicio",
    path: ["endAt"],
  });

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const [activeClubId, management] = await Promise.all([
    getActiveWorkClubId(user.id),
    isManagementWorkMode(user.id),
  ]);
  const conditions = [
    calendarEventsVisibility(user.id, activeClubId, management),
  ];
  if (from) conditions.push(gte(calendarEvents.startAt, new Date(from)));
  if (to) conditions.push(lte(calendarEvents.startAt, new Date(to)));

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(asc(calendarEvents.startAt));

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const [clubId, management] = await Promise.all([
    getActiveWorkClubId(user.id),
    isManagementWorkMode(user.id),
  ]);

  const [created] = await db
    .insert(calendarEvents)
    .values({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      clubId,
      // Desde el Espacio gestión, solo lo ve el gestor.
      management,
    })
    .returning();

  return NextResponse.json({ data: created }, { status: 201 });
}
