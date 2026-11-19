import { checkIds, json, withOrganizer } from "@/lib/tournaments/api";
import {
  posterImageUrl,
  removePosterImage,
  setPosterImage,
} from "@/lib/tournaments/poster";
import { TournamentError } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

// URL firmada de la imagen del cartel (o null).
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    return json({ url: await posterImageUrl(o, id) });
  });
}

// Subida (multipart "file", JPG o PNG ya reducida en el móvil). Cambia la
// plantilla a «Con tu imagen».
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    let file: FormDataEntryValue | null;
    try {
      file = (await request.formData()).get("file");
    } catch {
      throw new TournamentError("invalid_input", 400);
    }
    if (!(file instanceof File))
      throw new TournamentError("invalid_input", 400);
    await setPosterImage(o, id, {
      bytes: await file.arrayBuffer(),
      type: file.type,
    });
    return json({ url: await posterImageUrl(o, id) }, 201);
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    await removePosterImage(o, id);
    return json({ ok: true });
  });
}
