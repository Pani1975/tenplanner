import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { places, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { localToUtc } from "@/lib/bookings/availability";
import { timeZoneForOwner, usablePlaceOwners } from "@/lib/bookings/places";
import { createClubBooking } from "@/lib/bookings/server";

const schema = z.object({
  placeId: z.string().uuid(),
  /** Fecha local "YYYY-MM-DD" y minutos desde medianoche (hora de Canarias). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(15).max(720),
  purpose: z.string().trim().min(2).max(120),
});

// El club (dueño de las pistas) o un monitor del club reserva una pista para
// lo que indique.
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

  // Pistas que puede reservar: las suyas; en el entorno de un club, como
  // monitor, solo las del club (igual que en Reservas de pistas).
  const owners = await usablePlaceOwners(user.id);
  const ownerIds =
    owners.clubOwnerId && owners.clubOwnerId !== user.id
      ? [owners.clubOwnerId]
      : owners.ownerIds;
  const [place] = await db
    .select({ ownerId: places.coachId })
    .from(places)
    .where(and(eq(places.id, v.placeId), inArray(places.coachId, ownerIds)))
    .limit(1);
  if (!place)
    return NextResponse.json({ error: "Esa pista no existe." }, { status: 422 });

  // Un monitor reserva en una pista del club: su nombre va con el motivo,
  // para que el club sepa quién la ha reservado.
  let purpose = v.purpose;
  if (place.ownerId !== user.id) {
    const [me] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (me?.name) purpose = `${v.purpose} · ${me.name}`.slice(0, 120);
  }

  const result = await createClubBooking({
    ownerId: place.ownerId,
    createdBy: user.id,
    placeId: v.placeId,
    start: localToUtc(
      v.date,
      v.startMinute,
      await timeZoneForOwner(place.ownerId)
    ),
    durationMinutes: v.durationMinutes,
    purpose,
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
