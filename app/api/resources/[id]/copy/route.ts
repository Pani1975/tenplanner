import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { canTagWithClub, getClubAccountClubId } from "@/lib/clubs";
import { isDrawingUrl } from "@/lib/court-board";
import { copyDrawingFiles } from "@/lib/drawing-storage";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

/** Copia un recurso del club al espacio particular de quien lo pide. */
export async function POST(_req: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const [source] = await db
    .select()
    .from(resources)
    .where(eq(resources.id, id))
    .limit(1);
  if (!source)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isMember = source.clubId
    ? await canTagWithClub(user.id, source.clubId)
    : false;
  if (source.userId !== user.id && !isMember)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // La cuenta de un club no tiene espacio particular.
  if (await getClubAccountClubId(user.id))
    return NextResponse.json(
      { error: "Una cuenta de club no tiene espacio particular." },
      { status: 400 }
    );

  let imageUrl = source.imageUrl;
  if (isDrawingUrl(imageUrl)) {
    const copied = await copyDrawingFiles(imageUrl, user.id);
    if (!copied)
      return NextResponse.json(
        { error: "No se pudo copiar el dibujo." },
        { status: 500 }
      );
    imageUrl = copied;
  }

  const [created] = await db
    .insert(resources)
    .values({
      userId: user.id,
      clubId: null,
      title: source.title,
      description: source.description,
      url: source.url,
      documentUrl: source.documentUrl,
      documentName: source.documentName,
      imageUrl,
    })
    .returning();

  return NextResponse.json({ data: created }, { status: 201 });
}
