import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSiteUrl, sendEmail } from "@/lib/email";
import {
  getClientIp,
  rateLimit,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import { registrationEmail } from "@/lib/tournaments/emails";
import { registerPublic } from "@/lib/tournaments/public";
import { publicRegistrationSchema } from "@/lib/tournaments/schemas";
import { TournamentError } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ slug: string }> };

const SLUG = /^[a-z0-9-]{3,80}$/;

// Inscripción pública por enlace (sin cuenta). Límite de envíos por IP.
export async function POST(request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const limit = await rateLimit(
    `torneo-inscripcion:${getClientIp(request.headers)}`,
    8,
    10 * 60_000
  );
  if (!limit.ok) return tooManyRequestsResponse(limit);

  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new TournamentError("invalid_json", 400);
    }
    const input = publicRegistrationSchema.parse(raw);
    const r = await registerPublic(slug, input);

    let emailSent = false;
    if (r.notifyEmail) {
      const site = getSiteUrl(request.url);
      const mail = registrationEmail({
        tournamentName: r.tournament.name,
        playerName: r.playerName,
        status: r.status,
        waitlistPosition: r.waitlistPosition,
        publicUrl: `${site}/t/${r.tournament.slug}`,
        cancelUrl: `${site}/t/${r.tournament.slug}/cancelar?token=${r.cancelToken}`,
      });
      const sent = await sendEmail({ to: r.notifyEmail, ...mail });
      emailSent = sent.sent;
    }
    return NextResponse.json(
      {
        data: {
          status: r.status,
          waitlistPosition: r.waitlistPosition,
          emailSent,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof TournamentError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    console.error("[torneos públicos]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
