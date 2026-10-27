import { createAdminClient } from "@/lib/supabase/admin";

/** Bucket privado: contiene voces de monitores y alumnos. */
export const SESSION_AUDIO_BUCKET = "session-audio";
/** Duración máxima de una nota de voz. */
export const SESSION_AUDIO_MAX_SECONDS = 120;
/** Tamaño máximo (límite de cuerpo de las funciones de Vercel ≈ 4,5 MB). */
export const SESSION_AUDIO_MAX_BYTES = 3 * 1024 * 1024;
/** Vida de las URLs firmadas con las que se reproduce el audio. */
const SIGNED_URL_SECONDS = 4 * 60 * 60;

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** Tipo base sin parámetros ("audio/webm;codecs=opus" → "audio/webm"). */
export function baseAudioMime(mime: string): string {
  return mime.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function audioExtension(mime: string): string | null {
  return EXTENSION_BY_MIME[baseAudioMime(mime)] ?? null;
}

/** URLs firmadas para reproducir; las que fallen se omiten. */
export async function signSessionAudioUrls(
  paths: string[]
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return urls;
  try {
    const { data } = await createAdminClient()
      .storage.from(SESSION_AUDIO_BUCKET)
      .createSignedUrls(unique, SIGNED_URL_SECONDS);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
    }
  } catch (error) {
    console.error("No se pudieron firmar las URLs de audio", error);
  }
  return urls;
}

/** Borra archivos de audio; el borrado es "best effort". */
export async function removeSessionAudio(paths: Array<string | null>) {
  const toRemove = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (toRemove.length === 0) return;
  try {
    await createAdminClient()
      .storage.from(SESSION_AUDIO_BUCKET)
      .remove(toRemove);
  } catch (error) {
    console.error("No se pudo borrar el audio", error);
  }
}
