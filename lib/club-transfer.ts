import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import type { StationItemJson } from "@/lib/block-items";
import { omitKeys } from "@/lib/copy-to-space";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * "Enviar al club" de una clase o sesión: los ejercicios privados del
 * monitor que usa (los de su espacio propio) no los vería nadie del club, así
 * que se envían también como copias del club. Devuelve el mapa
 * id original → id de la copia; los demás ejercicios (Biblioteca, del club)
 * no se tocan.
 */
export async function sendPrivateExercisesToClub(
  tx: Tx,
  exerciseIds: (string | null | undefined)[],
  userId: string,
  clubId: string
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(exerciseIds.filter((id): id is string => !!id))
  );
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const privateRows = await tx
    .select()
    .from(exercises)
    .where(
      and(
        inArray(exercises.id, ids),
        eq(exercises.createdBy, userId),
        isNull(exercises.clubId),
        eq(exercises.isGlobal, false)
      )
    );
  for (const row of privateRows) {
    const [copy] = await tx
      .insert(exercises)
      .values({
        ...omitKeys(row, ["id", "createdAt", "updatedAt"]),
        createdBy: userId,
        clubId,
      })
      .returning({ id: exercises.id });
    map.set(row.id, copy.id);
  }
  return map;
}

/** Ids de ejercicio referenciados en estaciones. */
export function stationExerciseIds(
  stations: StationItemJson[] | null | undefined
): string[] {
  return (stations ?? [])
    .map((s) => s.exerciseId)
    .filter((id): id is string => !!id);
}

/** Cambia los ids de ejercicio de las estaciones según el mapa. */
export function remapStations(
  stations: StationItemJson[] | null | undefined,
  map: Map<string, string>
): StationItemJson[] | null {
  if (!stations) return null;
  return stations.map((s) =>
    s.exerciseId && map.has(s.exerciseId)
      ? { ...s, exerciseId: map.get(s.exerciseId)! }
      : s
  );
}

/** Cambia un id de ejercicio según el mapa (o lo deja igual). */
export function remapExerciseId<T extends string | null>(
  id: T,
  map: Map<string, string>
): T {
  return (id && map.has(id) ? map.get(id)! : id) as T;
}
