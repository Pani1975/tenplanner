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
  sendEditLinkEmail,
  setGuestCookie,
} from "@/lib/tournaments/guest-server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tournamentCircuits } from "@/db/schema";
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
  // Circuito: sus torneos (nombre y fecha). Los demás datos, los de
  // `tournament`, iguales para todos; cada uno se edita después.
  circuit: z
    .object({
      name: z.string().trim().min(2).max(160),
      season: z.string().trim().max(20).optional().nullable(),
      tournaments: z
        .array(
          z.object({
            name: z.string().trim().min(3).max(160),
            startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          })
        )
        .min(1)
        .max(12),
    })
    .optional()
    .nullable(),
  // Opcional: enviar el enlace de edición a este correo (no se guarda).
  emailTo: z.string().trim().email().max(255).optional().nullable(),
});

// Crear un torneo de prueba sin cuenta (independiente o un circuito con sus
// torneos). Devuelve el enlace de edición (queda también en este navegador;
// opcionalmente se envía por correo) y el público de inscripción.
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
  const { organizerName, tournament, legacy, circuit, emailTo } = parsed.data;

  const token = newGuestToken();
  const o = await guestOrganizer({
    name: organizerName || null,
    tokenHash: hashGuestToken(token),
  });
  try {
    // Torneos creados (todos comparten el enlace de edición).
    const created: { id: string; slug: string; name: string }[] = [];
    let circuitSlug: string | null = null;
    if (legacy) {
      const input = importGuestSchema.parse(legacy);
      const id = (await importGuestTournament(o, input)).id;
      created.push({ id, slug: "", name: input.tournament.name });
    } else if (circuit) {
      const base = createTournamentSchema.parse(tournament);
      let circuitId: string | null = null;
      for (const item of circuit.tournaments) {
        const row = await createTournament(o, {
          ...base,
          name: item.name,
          startDate: item.startDate,
          endDate: null,
          registrationDeadline: null,
          ...(circuitId
            ? { circuitId, newCircuit: null }
            : {
                circuitId: null,
                newCircuit: {
                  name: circuit.name,
                  season: circuit.season ?? null,
                },
              }),
        });
        circuitId = row.circuitId;
        // El circuito ya es suyo: los siguientes torneos lo usan.
        o.guest!.tournamentIds.push(row.id);
        created.push({ id: row.id, slug: row.slug, name: row.name });
      }
      if (circuitId) {
        const [c] = await db
          .select({ slug: tournamentCircuits.slug })
          .from(tournamentCircuits)
          .where(eq(tournamentCircuits.id, circuitId))
          .limit(1);
        circuitSlug = c?.slug ?? null;
      }
    } else {
      const input = createTournamentSchema.parse(tournament);
      const row = await createTournament(o, input);
      created.push({ id: row.id, slug: row.slug, name: row.name });
    }
    for (const c of created) await setGuestCookie(c.id, token);
    const base = getSiteUrl(request.url);
    const first = created[0];
    const editUrl = guestEditUrl(base, first.id, token);
    const publicUrl = first.slug ? `${base}/t/${first.slug}` : null;
    const circuitUrl = circuitSlug ? `${base}/t/c/${circuitSlug}` : null;
    // Correo opcional con el enlace de edición (no se guarda la dirección).
    const emailSent = emailTo
      ? await sendEditLinkEmail({
          to: emailTo,
          name: circuit ? circuit.name : first.name,
          editUrl,
          publicUrl: circuit ? null : publicUrl,
          circuitUrl,
        }).catch((e) => {
          console.error("[torneos de prueba] correo", e);
          return false;
        })
      : null;
    return NextResponse.json(
      {
        data: {
          id: first.id,
          ids: created.map((c) => c.id),
          editUrl,
          publicUrl,
          circuitUrl,
          emailSent,
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
