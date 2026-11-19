import { z } from "zod";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { deleteNews, updateNews } from "@/lib/tournaments/media";

type Ctx = { params: Promise<{ id: string; newsId: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  published: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const { id, newsId } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id, newsId);
    const input = await parseBody(request, updateSchema);
    return json(await updateNews(o, id, newsId, input));
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id, newsId } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id, newsId);
    await deleteNews(o, id, newsId);
    return json({ ok: true });
  });
}
