import { NextResponse } from "next/server";
import { expireGuestTournaments } from "@/lib/tournaments/guest-server";

// Torneos de prueba sin cuenta: borra los caducados (30 días tras el torneo).
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
  const result = await expireGuestTournaments();
  return NextResponse.json({ data: result });
}
