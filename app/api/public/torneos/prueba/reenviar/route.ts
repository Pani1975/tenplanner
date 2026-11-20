import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteUrl } from "@/lib/email";
import {
  getClientIp,
  rateLimit,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import { resendEditLinks } from "@/lib/tournaments/guest-server";

// «¿Has perdido el enlace?»: reenvía al correo los enlaces de edición de sus
// torneos de prueba. Responde siempre igual (no revela si el correo existe).
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = await rateLimit(`guest-resend:${ip}`, 5, 3600_000);
  if (!limit.ok) return tooManyRequestsResponse(limit);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email().max(255) })
    .safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const perEmail = await rateLimit(
    `guest-resend-email:${parsed.data.email}`,
    3,
    3600_000
  );
  if (perEmail.ok) {
    await resendEditLinks(parsed.data.email, getSiteUrl(request.url)).catch(
      (e) => console.error("[torneos de prueba] reenviar", e)
    );
  }
  return NextResponse.json({ data: { ok: true } });
}
