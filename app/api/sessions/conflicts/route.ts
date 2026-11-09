import { and, eq, gte, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { places, sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { findOverlaps, slotEnd } from "@/lib/sessions/overlap";

const schema = z.object({
  placeId: z.string().uuid(),
  excludeSessionId: z.string().uuid().nullable().optional(),
  slots: z
    .array(
      z.object({
        start: z.string().datetime(),
        durationMinutes: z.number().int().min(1).max(600),
      })
    )
    .min(1)
    .max(60),
});

// Avisa si una sesión (o sus repeticiones) coincide en hora con otra en la
// misma pista. Solo aviso: quien crea la sesión decide si la guarda igual.
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
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  // La pista tiene que ser del usuario.
  const [place] = await db
    .select({ id: places.id, name: places.name })
    .from(places)
    .where(and(eq(places.id, parsed.data.placeId), eq(places.coachId, user.id)))
    .limit(1);
  if (!place) return NextResponse.json({ data: { conflicts: [] } });

  const slots = parsed.data.slots.map((s) => ({
    start: new Date(s.start),
    durationMinutes: s.durationMinutes,
  }));
  // Ventana de búsqueda: desde 10 h antes de la primera franja (por si una
  // sesión larga empezó antes) hasta el final de la última.
  const from = new Date(
    Math.min(...slots.map((s) => s.start.getTime())) - 10 * 3600_000
  );
  const to = new Date(Math.max(...slots.map((s) => slotEnd(s).getTime())));

  const rows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      scheduledAt: sessions.scheduledAt,
      durationMinutes: sessions.durationMinutes,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.placeId, place.id),
        ne(sessions.status, "cancelled"),
        gte(sessions.scheduledAt, from),
        lt(sessions.scheduledAt, to)
      )
    );

  const conflicts = findOverlaps(
    slots,
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      start: r.scheduledAt,
      durationMinutes: r.durationMinutes,
    })),
    parsed.data.excludeSessionId
  );

  return NextResponse.json({
    data: {
      placeName: place.name,
      conflicts: conflicts.map((c) => ({
        id: c.id,
        title: c.title,
        scheduledAt: c.start.toISOString(),
        durationMinutes: c.durationMinutes,
      })),
    },
  });
}
