import { checkIds, json, withOrganizer } from "@/lib/tournaments/api";
import { listPhotos, uploadPhoto } from "@/lib/tournaments/media";
import { TournamentError } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

// Fotos (con etiquetas y estado de autorización de imagen) y personas
// etiquetables, para el organizador.
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    return json(await listPhotos(o, id));
  });
}

// Subida: multipart con "file" (ya comprimida en el móvil), y opcionalmente
// "caption", "width" y "height".
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new TournamentError("invalid_input", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File))
      throw new TournamentError("invalid_input", 400);
    const num = (k: string) => {
      const n = Number(form.get(k));
      return Number.isInteger(n) && n > 0 && n < 20000 ? n : undefined;
    };
    const caption = String(form.get("caption") ?? "")
      .trim()
      .slice(0, 200);
    const row = await uploadPhoto(
      o,
      id,
      {
        bytes: await file.arrayBuffer(),
        type: file.type,
        width: num("width"),
        height: num("height"),
      },
      caption || null
    );
    return json(row, 201);
  });
}
