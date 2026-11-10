import { and, asc, desc, gte, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { editableSessionCondition } from "@/lib/sessions/permissions";

// Sesiones del monitor a las que se puede añadir un ejercicio: programadas
// desde hoy en adelante (o también pasadas con ?past=1), sin las canceladas.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includePast = new URL(request.url).searchParams.get("past") === "1";
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  // Margen para zonas horarias: incluye todo el día de hoy.
  startOfToday.setHours(startOfToday.getHours() - 12);

  const conditions = [
    await editableSessionCondition(user.id),
    ne(sessions.status, "cancelled"),
  ];
  if (!includePast) conditions.push(gte(sessions.scheduledAt, startOfToday));

  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      scheduledAt: sessions.scheduledAt,
      status: sessions.status,
    })
    .from(sessions)
    .where(and(...conditions))
    .orderBy(
      includePast ? desc(sessions.scheduledAt) : asc(sessions.scheduledAt)
    )
    .limit(includePast ? 200 : 60);

  return NextResponse.json({
    data: rows.map((row) => ({
      ...row,
      scheduledAt: row.scheduledAt.toISOString(),
    })),
  });
}
