import { z } from "zod";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { setArchived } from "@/lib/tournaments/schedule-server";

type Ctx = { params: Promise<{ id: string }> };

// Archivar (solo si ya ha terminado) o recuperar un torneo.
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const { archived } = await parseBody(
      request,
      z.object({ archived: z.boolean() })
    );
    await setArchived(o, id, archived);
    return json({ ok: true });
  });
}
