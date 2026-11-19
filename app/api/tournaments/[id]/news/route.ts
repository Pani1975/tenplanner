import { z } from "zod";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { createNews, listNews } from "@/lib/tournaments/media";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  publish: z.boolean().default(false),
});

// Noticias del torneo (todas, también borradores) para el organizador.
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    return json(await listNews(o, id));
  });
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const input = await parseBody(request, createSchema);
    return json(await createNews(o, id, input), 201);
  });
}
