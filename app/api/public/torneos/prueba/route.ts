import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { getSiteUrl } from "@/lib/email";
import {
  getClientIp,
  rateLimit,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import {
  guestOrganizer,
  hashGuestToken,
  newGuestToken,
  sendEditLink,
  setGuestCookie,
} from "@/lib/tournaments/guest-server";
import {
  importGuestSchema,
  importGuestTournament,
} from "@/lib/tournaments/import-guest";
import { createTournamentSchema } from "@/lib/tournaments/schemas";
import { createTournament, TournamentError } from "@/lib/tournaments/server";

/** Torneos de prueba activos por correo, como mucho. */
const MAX_PER_EMAIL = 5;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  organizerName: z.string().trim().max(120).optional().nullable(),
  // Aceptación de las condiciones del modo prueba.
  accept: z.literal(true),
  // Uno nuevo (tournament) o uno de la versión anterior del navegador (legacy).
  tournament: z.unknown().optional(),
  legacy: z.unknown().optional(),
});

// Crear un torneo de prueba sin cuenta. Queda en este navegador (cookie con
// el enlace de edición) y el enlace llega por correo; sin abrirlo no hay
// página de inscripción.
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = await rateLimit(`guest-tournament:${ip}`, 10, 24 * 3600_000);
  if (!limit.ok) return tooManyRequestsResponse(limit);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", detail: parsed.error.issues },
      { status: 400 }
    );
  }
  const { email, organizerName, tournament, legacy } = parsed.data;

  const [{ n }] = await db
    .select({ n: count() })
    .from(tournaments)
    .where(
      and(eq(tournaments.ownerType, "guest"), eq(tournaments.guestEmail, email))
    );
  if (n >= MAX_PER_EMAIL) {
    return NextResponse.json({ error: "guest_limit" }, { status: 409 });
  }

  const token = newGuestToken();
  const o = await guestOrganizer({
    email,
    name: organizerName || null,
    tokenHash: hashGuestToken(token),
  });
  try {
    let id: string;
    let name: string;
    if (legacy) {
      const input = importGuestSchema.parse(legacy);
      id = (await importGuestTournament(o, input)).id;
      name = input.tournament.name;
    } else {
      const input = createTournamentSchema.parse(tournament);
      const row = await createTournament(o, input);
      id = row.id;
      name = row.name;
    }
    await setGuestCookie(id, token);
    const mail = await sendEditLink({
      baseUrl: getSiteUrl(request.url),
      email,
      tournaments: [{ id, name, token }],
    });
    return NextResponse.json(
      { data: { id, emailSent: mail.sent } },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof TournamentError) {
      return NextResponse.json(
        { error: e.code, detail: e.detail ?? null },
        { status: e.status }
      );
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_input", detail: e.issues },
        { status: 400 }
      );
    }
    console.error("[torneos de prueba] crear", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
