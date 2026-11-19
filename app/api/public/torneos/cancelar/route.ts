import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteUrl, sendEmail } from "@/lib/email";
import {
  getClientIp,
  rateLimit,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import { promotedEmail } from "@/lib/tournaments/emails";
import { cancelByToken } from "@/lib/tournaments/public";
import { TournamentError } from "@/lib/tournaments/server";

const bodySchema = z.object({ token: z.string().min(20).max(64) });

// Cancelar una inscripción con el enlace del correo. Si entra alguien de la
// lista de espera, se le avisa por correo.
export async function POST(request: Request) {
  const limit = await rateLimit(
    `torneo-cancelar:${getClientIp(request.headers)}`,
    10,
    10 * 60_000
  );
  if (!limit.ok) return tooManyRequestsResponse(limit);
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const r = await cancelByToken(parsed.data.token);
    const site = getSiteUrl(request.url);
    for (const p of r.promoted) {
      const mail = promotedEmail({
        tournamentName: r.tournament.name,
        playerName: p.playerName,
        publicUrl: `${site}/t/${r.tournament.slug}`,
        cancelUrl: `${site}/t/${r.tournament.slug}/cancelar?token=${p.cancelToken}`,
      });
      await sendEmail({ to: p.email, ...mail });
    }
    return NextResponse.json(
      { data: { alreadyCancelled: r.alreadyCancelled } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    if (e instanceof TournamentError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    console.error("[torneos públicos]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
