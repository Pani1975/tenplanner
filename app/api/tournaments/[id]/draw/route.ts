import { z } from "zod";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { generateDraw } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  // Generar aunque haya inscripciones sin consentimiento (quedan fuera).
  excludePending: z.boolean().default(false),
});

// Genera (o rehace, si no hay resultados) el cuadro o la liguilla con las
// inscripciones confirmadas. El torneo pasa a "en curso".
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const body = await parseBody(request, bodySchema);
    return json(await generateDraw(o, id, body), 201);
  });
}
