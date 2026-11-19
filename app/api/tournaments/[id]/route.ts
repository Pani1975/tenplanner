import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { updateTournamentSchema } from "@/lib/tournaments/schemas";
import {
  getTournamentDetail,
  updateTournament,
} from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

// Detalle para el organizador: incluye los datos de contacto.
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    return json(await getTournamentDetail(o, id));
  });
}

// Datos, plazas y estado (abrir, cerrar, finalizar…).
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const input = await parseBody(request, updateTournamentSchema);
    return json(await updateTournament(o, id, input));
  });
}
