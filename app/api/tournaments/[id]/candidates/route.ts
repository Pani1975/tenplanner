import { checkIds, json, withAccountOrganizer } from "@/lib/tournaments/api";
import { listCandidates } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

// Alumnos y grupos de la escuela del torneo para el selector (sin contacto).
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withAccountOrganizer(async (o) => {
    checkIds(id);
    return json(await listCandidates(o, id));
  });
}
