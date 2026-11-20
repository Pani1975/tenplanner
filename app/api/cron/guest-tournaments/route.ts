import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/email";
import { expireGuestTournaments } from "@/lib/tournaments/guest-server";

// Torneos de prueba sin cuenta: aviso por correo una semana antes de
// borrarlos y borrado de los caducados (30 días tras el torneo) y de los que
// nunca confirmaron el correo (7 días).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await expireGuestTournaments(getSiteUrl(request.url));
  return NextResponse.json({ data: result });
}
