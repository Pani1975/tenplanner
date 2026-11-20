import { NextResponse } from "next/server";
import { z } from "zod";
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
  guestEditUrl,
  setGuestCookie,
} from "@/lib/tournaments/guest-server";
import {
  importGuestSchema,
  importGuestTournament,
} from "@/lib/tournaments/import-guest";
import { createTournamentSchema } from "@/lib/tournaments/schemas";
import { createTournament, TournamentError } from "@/lib/tournaments/server";

const bodySchema = z.object({
  organizerName: z.string().trim().max(120).optional().nullable(),
  // Aceptación de las condiciones del modo prueba.
  accept: z.literal(true),
  // Uno nuevo (tournament) o uno de la versión anterior del navegador (legacy).
  tournament: z.unknown().optional(),
  legacy: z.unknown().optional(),
});

// Crear un torneo de prueba sin cuenta. Devuelve el enlace de edición (queda
// también en este navegador) y el público de inscripción. Sin correos.
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
  const { organizerName, tournament, legacy } = parsed.data;

  const token = newGuestToken();
  const o = await guestOrganizer({
    name: organizerName || null,
    tokenHash: hashGuestToken(token),
  });
  try {
    let id: string;
    let slug: string;
    if (legacy) {
      const input = importGuestSchema.parse(legacy);
      id = (await importGuestTournament(o, input)).id;
      slug = "";
    } else {
      const input = createTournamentSchema.parse(tournament);
      const row = await createTournament(o, input);
      id = row.id;
      slug = row.slug;
    }
    await setGuestCookie(id, token);
    const base = getSiteUrl(request.url);
    return NextResponse.json(
      {
        data: {
          id,
          editUrl: guestEditUrl(base, id, token),
          publicUrl: slug ? `${base}/t/${slug}` : null,
        },
      },
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
