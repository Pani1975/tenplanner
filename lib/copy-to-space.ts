import { z } from "zod";
import { getActiveWorkClubId } from "@/lib/clubs";

/**
 * Destino de "Copiar a mi espacio" para ejercicios y clases:
 *
 * - "active": desde la Biblioteca (contenido público) al espacio en el que
 *   el monitor trabaja ahora — particular, o el club de su modo de trabajo
 *   (allí la copia la ven todos los miembros del club).
 * - "particular": una ficha que el propio monitor creó en el espacio de un
 *   club, a su espacio particular (solo él la verá).
 */
export const copyTargetSchema = z.object({
  target: z.enum(["active", "particular"]).default("active"),
});

export type CopyTargetValue = z.infer<typeof copyTargetSchema>["target"];

export type CopySource = {
  isPublic: boolean;
  createdBy: string | null;
  clubId: string | null;
};

/**
 * Comprueba si `userId` puede copiar `source` al destino pedido y devuelve
 * el clubId que tendrá la copia (null = espacio particular), o un error.
 */
export async function resolveCopyDestination(
  source: CopySource,
  target: CopyTargetValue,
  userId: string
): Promise<{ ok: true; clubId: string | null } | { ok: false; error: string }> {
  if (target === "particular") {
    if (!source.clubId || source.createdBy !== userId) {
      return {
        ok: false,
        error:
          "Solo puedes copiar a tu espacio particular lo que creaste en un club.",
      };
    }
    return { ok: true, clubId: null };
  }
  if (!source.isPublic) {
    return {
      ok: false,
      error: "Solo se puede copiar contenido de la Biblioteca.",
    };
  }
  return { ok: true, clubId: await getActiveWorkClubId(userId) };
}

/** Copia superficial de `obj` sin las claves indicadas (ids, fechas…). */
export function omitKeys<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> {
  const out = { ...obj };
  for (const key of keys) delete out[key];
  return out;
}
