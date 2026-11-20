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
import { cancelConflictingSessions } from "@/lib/tournaments/court-conflicts";
import {
  deleteTournament,
  getTournamentDetail,
  updateTournament,
} from "@/lib/tournaments/server";
import { clearGuestCookie } from "@/lib/tournaments/guest-server";

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
    const sessionsCancelled = await cancelConflictingSessions(
      result.tournament,
      input.cancelSessionIds ?? [],
      result.tournament.name,
      o.userId
    ).catch((e) => {
      console.error("[torneos] cancelar sesiones", e);
      return { cancelled: 0, notified: 0 };
    });
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
    return json({ ...result, familiesNotified, sessionsCancelled });
  });
}

// Borrar un torneo: modo prueba (con su enlace) o, con cuenta, el monitor
// en particular y, en club, el administrador o quien lo creó.
export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    await deleteTournament(o, id);
    if (o.guest) await clearGuestCookie(id);
    return json({ ok: true });
  });
}
