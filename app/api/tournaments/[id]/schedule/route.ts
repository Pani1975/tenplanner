import { z } from "zod";
import { checkIds, json, parseBody, withOrganizer } from "@/lib/tournaments/api";
import {
  saveSchedule,
  setSchedulePublished,
} from "@/lib/tournaments/schedule-server";

type Ctx = { params: Promise<{ id: string }> };

const putSchema = z.object({
  items: z
    .array(
      z.object({
        matchId: z.string().uuid(),
        scheduledAt: z.string().datetime({ offset: true }).nullable(),
        courtLabel: z.string().trim().max(60).nullable(),
      })
    )
    .max(300),
});

// Guarda el orden de juego (día y hora, pista) de varios partidos.
export async function PUT(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const { items } = await parseBody(request, putSchema);
    await saveSchedule(o, id, items);
    return json({ ok: true });
  });
}

// Publicar o retirar el orden de juego.
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const { published } = await parseBody(
      request,
      z.object({ published: z.boolean() })
    );
    await setSchedulePublished(o, id, published);
    return json({ ok: true });
  });
}
