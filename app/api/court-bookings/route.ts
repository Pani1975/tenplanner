import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { localToUtc } from "@/lib/bookings/availability";
import { createClubBooking } from "@/lib/bookings/server";

const schema = z.object({
  placeId: z.string().uuid(),
  /** Fecha local "YYYY-MM-DD" y minutos desde medianoche (hora de Canarias). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(15).max(720),
  purpose: z.string().trim().min(2).max(120),
});

// El club (dueño de las pistas) reserva una pista para lo que indique.
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
    return NextResponse.json(
      { error: "Revisa los datos: pista, hora y para qué es." },
      { status: 422 }
    );
  const v = parsed.data;

  const result = await createClubBooking({
    ownerId: user.id,
    placeId: v.placeId,
    start: localToUtc(v.date, v.startMinute),
    durationMinutes: v.durationMinutes,
    purpose: v.purpose,
  });
  if (!result.ok) {
    const error =
      result.error === "taken"
        ? `La pista está ocupada a esa hora${result.conflict ? ` (${result.conflict})` : ""}.`
        : result.error === "not_found"
          ? "Esa pista no existe."
          : "Hora no válida.";
    return NextResponse.json(
      { error },
      { status: result.error === "taken" ? 409 : 422 }
    );
  }
  return NextResponse.json({ data: { id: result.id } }, { status: 201 });
}
