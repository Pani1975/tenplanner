import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { updateEntrySchema } from "@/lib/tournaments/schemas";
import { updateEntry } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

// Declarar el consentimiento, cancelar (sube el primero de la lista de
// espera) o fijar cabeza de serie. No se borran inscripciones.
export async function PATCH(request: Request, ctx: Ctx) {
  const { id, entryId } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id, entryId);
    const action = await parseBody(request, updateEntrySchema);
    return json(await updateEntry(o, id, entryId, action));
  });
}
