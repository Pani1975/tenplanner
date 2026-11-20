import { z } from "zod";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { updateCircuitPoints } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

const pts = z.number().int().min(0).max(10000);
const pointsSchema = z.object({
  points: z.object({
    knockout: z.object({
      winner: pts,
      final: pts,
      semifinal: pts,
      quarterfinal: pts,
      round_of_16: pts,
      earlier: pts,
    }),
    roundRobin: z.array(pts).max(32),
    participation: pts,
  }),
});

// Puntos por ronda del circuito: los define el organizador (también en el
// modo prueba, para el circuito de sus torneos).
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const { points } = await parseBody(request, pointsSchema);
    return json(await updateCircuitPoints(o, id, points));
  });
}
