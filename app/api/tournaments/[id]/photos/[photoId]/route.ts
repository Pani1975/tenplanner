import { z } from "zod";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { deletePhoto, updatePhoto } from "@/lib/tournaments/media";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

const updateSchema = z.object({
  caption: z.string().trim().max(200).nullable().optional(),
  tags: z
    .array(
      z.object({
        entryId: z.string().uuid(),
        side: z.enum(["player", "partner"]),
      })
    )
    .max(40)
    .optional(),
  published: z.boolean().optional(),
  acknowledged: z.boolean().optional(),
});

// Pie, etiquetas y publicación. Publicar con etiquetados sin autorización
// devuelve 409 image_consent_missing (aviso); se repite con acknowledged.
export async function PATCH(request: Request, ctx: Ctx) {
  const { id, photoId } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id, photoId);
    const input = await parseBody(request, updateSchema);
    await updatePhoto(o, id, photoId, {
      ...input,
      caption: input.caption === "" ? null : input.caption,
    });
    return json({ ok: true });
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id, photoId } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id, photoId);
    await deletePhoto(o, id, photoId);
    return json({ ok: true });
  });
}
