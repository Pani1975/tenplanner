import { NextResponse } from "next/server";
import { openEditLink } from "@/lib/tournaments/guest-server";

type Ctx = { params: Promise<{ id: string; token: string }> };

// Enlace de edición del correo: confirma el correo (activa la inscripción
// por enlace) y deja el torneo de prueba en este navegador.
export async function GET(request: Request, ctx: Ctx) {
  const { id, token } = await ctx.params;
  const ok = await openEditLink(id, token);
  const url = new URL(
    ok ? `/probar-torneos/${id}` : "/probar-torneos?enlace=caducado",
    request.url
  );
  return NextResponse.redirect(url, {
    headers: { "Cache-Control": "no-store" },
  });
}
