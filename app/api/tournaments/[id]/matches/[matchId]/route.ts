import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { matchResultSchema } from "@/lib/tournaments/schemas";
import { clearMatchResult, recordResult } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string; matchId: string }> };

// Resultado de un partido (marcador de tenis); el ganador avanza solo.
export async function PATCH(request: Request, ctx: Ctx) {
  const { id, matchId } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id, matchId);
    const body = await parseBody(request, matchResultSchema);
    return json(await recordResult(o, id, matchId, body));
  });
}

// Borrar el resultado (si el partido siguiente aún no se ha jugado).
export async function DELETE(_request: Request, ctx: Ctx) {
  const { id, matchId } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id, matchId);
    await clearMatchResult(o, id, matchId);
    return json({ ok: true });
  });
}
