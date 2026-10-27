import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessionBlockItems, sessionBlocks, sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });

const commentsSchema = z
  .object({
    /** Comentario general de la sesión. null/"" lo borra. */
    sessionComment: z.string().trim().max(4000).nullable().optional(),
    /** Comentario de un ejercicio/actividad concreto de los bloques. */
    itemId: z.string().uuid().optional(),
    itemComment: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.sessionComment !== undefined ||
      (v.itemId !== undefined && v.itemComment !== undefined),
    { message: "Nada que guardar" }
  );

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Comentarios del monitor sobre la sesión: uno general y uno por
 * ejercicio/actividad de los bloques. Se pueden escribir antes o después de
 * marcar la sesión como completada, así que no dependen de su estado.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  const sessionId = parsedParams.data.id;

  const parsedBody = commentsSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsedBody.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  const { sessionComment, itemId, itemComment } = parsedBody.data;

  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.userId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (sessionComment !== undefined) {
    await db
      .update(sessions)
      .set({ coachComment: sessionComment || null })
      .where(eq(sessions.id, sessionId));
  }

  if (itemId !== undefined && itemComment !== undefined) {
    // El item tiene que pertenecer a esta sesión.
    const [item] = await db
      .select({ id: sessionBlockItems.id })
      .from(sessionBlockItems)
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionBlockItems.blockId))
      .where(
        and(
          eq(sessionBlockItems.id, itemId),
          eq(sessionBlocks.sessionId, sessionId)
        )
      )
      .limit(1);
    if (!item)
      return NextResponse.json(
        { error: "El ejercicio no pertenece a esta sesión" },
        { status: 400 }
      );
    await db
      .update(sessionBlockItems)
      .set({ coachComment: itemComment || null })
      .where(eq(sessionBlockItems.id, itemId));
  }

  return NextResponse.json({ ok: true });
}
