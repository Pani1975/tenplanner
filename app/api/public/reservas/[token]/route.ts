import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BOOKING_DURATIONS,
  bookingDays,
  isValidFullName,
  localToUtc,
} from "@/lib/bookings/availability";
import {
  createCourtBooking,
  getBookingOwner,
  loadBookablePlaces,
} from "@/lib/bookings/server";
import {
  getClientIp,
  rateLimit,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";

type Ctx = { params: Promise<{ token: string }> };

// Disponibilidad de un día: pistas reservables y sus huecos ocupados (solo
// horas, nunca quién ha reservado).
export async function GET(request: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const owner = await getBookingOwner(token);
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!bookingDays(new Date()).includes(date)) {
    return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
  }
  const from = localToUtc(date, 0);
  const to = localToUtc(date, 24 * 60);
  const placesForDay = await loadBookablePlaces(owner.id, from, to);

  return NextResponse.json(
    {
      data: {
        date,
        places: placesForDay.map((p) => ({
          id: p.id,
          name: p.name,
          openMinute: p.openMinute,
          closeMinute: p.closeMinute,
          busy: p.busy.map((b) => ({
            start: b.start.toISOString(),
            end: b.end.toISOString(),
          })),
        })),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

const bookingSchema = z.object({
  placeId: z.string().uuid(),
  start: z.string().datetime(),
  durationMinutes: z
    .number()
    .int()
    .refine((n) => (BOOKING_DURATIONS as readonly number[]).includes(n)),
  fullName: z.string().max(120),
  // Campo trampa para robots: una persona nunca lo rellena.
  website: z.string().max(200).optional(),
});

export async function POST(request: Request, ctx: Ctx) {
  const ip = getClientIp(request.headers);
  const limit = await rateLimit(`court-booking:${ip}`, 8, 60 * 60_000);
  if (!limit.ok) return tooManyRequestsResponse(limit);

  const { token } = await ctx.params;
  const owner = await getBookingOwner(token);
  if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Datos no válidos" }, { status: 422 });
  if (parsed.data.website) {
    // Robot: se responde como si fuera bien, sin guardar nada.
    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  }
  if (!isValidFullName(parsed.data.fullName)) {
    return NextResponse.json(
      { error: "Escribe tu nombre y apellidos." },
      { status: 422 }
    );
  }

  const result = await createCourtBooking({
    ownerId: owner.id,
    placeId: parsed.data.placeId,
    start: new Date(parsed.data.start),
    durationMinutes: parsed.data.durationMinutes,
    fullName: parsed.data.fullName,
  });
  if (!result.ok) {
    const message =
      result.error === "taken"
        ? "Esa pista acaba de ocuparse. Elige otra hora o pista."
        : result.error === "not_found"
          ? "Esa pista ya no se puede reservar."
          : "Hora no válida.";
    return NextResponse.json(
      { error: message },
      { status: result.error === "taken" ? 409 : 422 }
    );
  }
  return NextResponse.json({ data: { id: result.id } }, { status: 201 });
}
