import { and, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { exerciseLists } from "@/db/schema";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";

/**
 * Listas de ejercicios favoritos — cada lista pertenece a un espacio:
 *
 * - Espacio particular (`clubId` null): "Favoritos", solo de su autor.
 * - Espacio de un club: "Favoritos club", un listado común de todos los
 *   miembros activos del club (dueño y monitores invitados). Cualquiera de
 *   ellos puede crear listas, añadir o quitar ejercicios, renombrarlas o
 *   borrarlas mientras trabaja en el modo de ese club.
 */
export function exerciseListSpaceCondition(
  userId: string,
  activeClubId: string | null
): SQL {
  return sharedWithClubCondition(
    exerciseLists.userId,
    exerciseLists.clubId,
    userId,
    activeClubId
  );
}

export async function getExerciseListSpace(userId: string) {
  const activeClubId = await getActiveWorkClubId(userId);
  return {
    activeClubId,
    condition: exerciseListSpaceCondition(userId, activeClubId),
  };
}

/** Una lista del espacio activo del usuario (o undefined si no la ve). */
export async function getExerciseListInActiveSpace(
  listId: string,
  userId: string
) {
  const { condition } = await getExerciseListSpace(userId);
  const [list] = await db
    .select({
      id: exerciseLists.id,
      isDefault: exerciseLists.isDefault,
    })
    .from(exerciseLists)
    .where(and(eq(exerciseLists.id, listId), condition))
    .limit(1);
  return list;
}
