import { createAdminClient } from "@/lib/supabase/admin";
import {
  DRAWINGS_FOLDER,
  drawingDataUrl,
  isDrawingUrl,
} from "@/lib/court-board";

const RESOURCES_BUCKET = "resources";

/** Ruta dentro del bucket a partir de la URL pública de un archivo. */
export function resourcePathFromUrl(url: string): string | null {
  const marker = `/${RESOURCES_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** Borra la imagen y los trazos de un dibujo ("best effort"). */
export async function removeDrawingFiles(imageUrl: string | null) {
  if (!isDrawingUrl(imageUrl)) return;
  const png = resourcePathFromUrl(imageUrl);
  const json = resourcePathFromUrl(drawingDataUrl(imageUrl));
  const paths = [png, json].filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try {
    await createAdminClient().storage.from(RESOURCES_BUCKET).remove(paths);
  } catch (error) {
    console.error("No se pudo borrar el dibujo del almacenamiento", error);
  }
}

/**
 * Copia los archivos de un dibujo a la carpeta del usuario y devuelve la URL
 * pública de la nueva imagen (la copia es independiente del original).
 */
export async function copyDrawingFiles(
  imageUrl: string,
  userId: string
): Promise<string | null> {
  const fromPng = resourcePathFromUrl(imageUrl);
  const fromJson = resourcePathFromUrl(drawingDataUrl(imageUrl));
  if (!fromPng) return null;
  const base = `${userId}/${DRAWINGS_FOLDER}/${Date.now()}`;
  const storage = createAdminClient().storage.from(RESOURCES_BUCKET);
  const { error } = await storage.copy(fromPng, `${base}.png`);
  if (error) return null;
  // Los trazos son un extra: si no se pueden copiar, la imagen sirve igual.
  if (fromJson) await storage.copy(fromJson, `${base}.json`);
  return storage.getPublicUrl(`${base}.png`).data.publicUrl;
}
