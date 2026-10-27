import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessionBlockItems, sessionBlocks, sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SESSION_AUDIO_BUCKET,
  SESSION_AUDIO_MAX_BYTES,
  SESSION_AUDIO_MAX_SECONDS,
  audioExtension,
  baseAudioMime,
  removeSessionAudio,
  signSessionAudioUrls,
} from "@/lib/session-audio";

type RouteContext = { params: Promise<{ id: string }> };

const paramsSchema = z.object({ id: z.string().uuid() });
const targetSchema = z.object({ itemId: z.string().uuid().optional() });

type Auth =
  | { ok: true; userId: string; sessionId: string }
  | { ok: false; response: NextResponse };

async function authorize(context: RouteContext): Promise<Auth> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid session id" },
        { status: 400 }
      ),
    };

  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, parsed.data.id))
    .limit(1);
  if (!session)
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  if (session.userId !== user.id)
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };

  return { ok: true, userId: user.id, sessionId: parsed.data.id };
}

/** Ruta y duración actuales de la nota de voz del destino (sesión o item). */
async function currentAudio(sessionId: string, itemId?: string) {
  if (!itemId) {
    const [row] = await db
      .select({ path: sessions.coachAudioPath })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return { found: !!row, path: row?.path ?? null };
  }
  const [row] = await db
    .select({ path: sessionBlockItems.coachAudioPath })
    .from(sessionBlockItems)
    .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionBlockItems.blockId))
    .where(
      and(
        eq(sessionBlockItems.id, itemId),
        eq(sessionBlocks.sessionId, sessionId)
      )
    )
    .limit(1);
  return { found: !!row, path: row?.path ?? null };
}

async function saveAudioColumns(
  sessionId: string,
  itemId: string | undefined,
  path: string | null,
  seconds: number | null
) {
  if (!itemId) {
    await db
      .update(sessions)
      .set({ coachAudioPath: path, coachAudioSeconds: seconds })
      .where(eq(sessions.id, sessionId));
    return;
  }
  await db
    .update(sessionBlockItems)
    .set({ coachAudioPath: path, coachAudioSeconds: seconds })
    .where(eq(sessionBlockItems.id, itemId));
}

/**
 * Sube (o sustituye) la nota de voz de la sesión o de un ejercicio concreto.
 * multipart/form-data: file, seconds y, opcionalmente, itemId.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await authorize(context);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Falta el audio" }, { status: 400 });
  if (file.size > SESSION_AUDIO_MAX_BYTES)
    return NextResponse.json(
      { error: "El audio es demasiado grande (máx. 3 MB)" },
      { status: 413 }
    );

  const extension = audioExtension(file.type);
  if (!extension)
    return NextResponse.json(
      { error: "Formato de audio no admitido" },
      { status: 415 }
    );

  const seconds = Math.round(Number(form.get("seconds")));
  if (
    !Number.isFinite(seconds) ||
    seconds < 1 ||
    seconds > SESSION_AUDIO_MAX_SECONDS + 5
  )
    return NextResponse.json(
      { error: "Duración no válida (máx. 2 minutos)" },
      { status: 400 }
    );

  const target = targetSchema.safeParse({
    itemId: (form.get("itemId") as string | null) || undefined,
  });
  if (!target.success)
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  const itemId = target.data.itemId;

  const previous = await currentAudio(auth.sessionId, itemId);
  if (!previous.found)
    return NextResponse.json(
      { error: "El ejercicio no pertenece a esta sesión" },
      { status: 400 }
    );

  const path = `${auth.userId}/${auth.sessionId}/${itemId ?? "sesion"}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await createAdminClient()
    .storage.from(SESSION_AUDIO_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: baseAudioMime(file.type),
      upsert: false,
    });
  if (uploadError) {
    console.error("Error subiendo nota de voz", uploadError);
    return NextResponse.json(
      { error: "No se pudo guardar el audio" },
      { status: 500 }
    );
  }

  await saveAudioColumns(auth.sessionId, itemId, path, seconds);
  await removeSessionAudio([previous.path]);

  const urls = await signSessionAudioUrls([path]);
  return NextResponse.json({ ok: true, url: urls.get(path) ?? null, seconds });
}

/** Elimina la nota de voz de la sesión o de un ejercicio. Body: { itemId? } */
export async function DELETE(request: Request, context: RouteContext) {
  const auth = await authorize(context);
  if (!auth.ok) return auth.response;

  const target = targetSchema.safeParse(await request.json().catch(() => ({})));
  if (!target.success)
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  const itemId = target.data.itemId;

  const previous = await currentAudio(auth.sessionId, itemId);
  if (!previous.found)
    return NextResponse.json(
      { error: "El ejercicio no pertenece a esta sesión" },
      { status: 400 }
    );

  await saveAudioColumns(auth.sessionId, itemId, null, null);
  await removeSessionAudio([previous.path]);
  return NextResponse.json({ ok: true });
}
