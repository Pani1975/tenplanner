import { getSiteUrl } from "@/lib/email";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import {
  notifyGuardiansConsentNeeded,
  pendingConsentStudentIds,
} from "@/lib/tournaments/family-notify";
import { updateTournamentSchema } from "@/lib/tournaments/schemas";
import {
  getTournamentDetail,
  updateTournament,
} from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

// Detalle para el organizador (con contactos solo si puede verlos).
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    return json(await getTournamentDetail(o, id));
  });
}

// Datos, plazas, visibilidad y estado (abrir, cerrar, finalizar…). Al abrir
// un borrador se avisa a las familias con consentimientos pendientes.
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const input = await parseBody(request, updateTournamentSchema);
    const result = await updateTournament(o, id, input);
    let familiesNotified = 0;
    if (input.status === "open" && result.previousStatus === "draft") {
      familiesNotified = await pendingConsentStudentIds(id)
        .then((ids) =>
          notifyGuardiansConsentNeeded(id, ids, getSiteUrl(request.url))
        )
        .catch((e) => {
          console.error("[torneos] aviso a familias", e);
          return 0;
        });
    }
    return json({ ...result, familiesNotified });
  });
}
