import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { addEntriesSchema } from "@/lib/tournaments/schemas";
import { addManualEntry, addSchoolEntries } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

// Añadir participantes: alumnos de la escuela (lista) o un jugador externo.
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const input = await parseBody(request, addEntriesSchema);
    const result =
      input.kind === "school"
        ? await addSchoolEntries(o, id, input)
        : await addManualEntry(o, id, input);
    return json(result, 201);
  });
}
