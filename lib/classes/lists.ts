import { and, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { classLists, classes, clubs, users } from "@/db/schema";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";

/**
 * "Mis listas" de clases — cada lista pertenece a un espacio:
 *
 * - Espacio particular (`clubId` null): solo la ve y la edita su autor.
 * - Espacio de un club (`clubId` = club): la ven y la usan todos los
 *   miembros activos del club (dueño y monitores invitados) mientras
 *   trabajan en el modo de ese club. Cualquiera de ellos puede añadir o
 *   quitar clases; renombrarla o borrarla solo su autor o el dueño del club.
 *
 * El espacio activo es el "modo de trabajo" del usuario (ver lib/clubs.ts).
 */
export async function getListSpace(userId: string) {
  const activeClubId = await getActiveWorkClubId(userId);
  return {
    activeClubId,
    condition: classListSpaceCondition(userId, activeClubId),
  };
}

export function classListSpaceCondition(
  userId: string,
  activeClubId: string | null
): SQL {
  return sharedWithClubCondition(
    classLists.userId,
    classLists.clubId,
    userId,
    activeClubId
  );
}

/**
 * Crea la lista por defecto ("Favoritos") del espacio activo si aún no
 * existe — se usa la primera vez que el monitor pulsa el corazón de una
 * clase sin elegir explícitamente otra lista.
 */
export async function ensureDefaultList(
  userId: string,
  activeClubId: string | null
) {
  const [existing] = await db
    .select({ id: classLists.id })
    .from(classLists)
    .where(
      and(
        classListSpaceCondition(userId, activeClubId),
        eq(classLists.isDefault, true)
      )
    )
    .limit(1);
  if (existing) return;
  await db.insert(classLists).values({
    userId,
    clubId: activeClubId,
    name: "Favoritos",
    emoji: "⭐",
    isDefault: true,
  });
}

/** Una lista del espacio activo del usuario (o undefined si no la ve). */
export async function getListInActiveSpace(listId: string, userId: string) {
  const { activeClubId, condition } = await getListSpace(userId);
  const [list] = await db
    .select({
      id: classLists.id,
      userId: classLists.userId,
      clubId: classLists.clubId,
      isPublic: classLists.isPublic,
    })
    .from(classLists)
    .where(and(eq(classLists.id, listId), condition))
    .limit(1);
  return list ? { ...list, activeClubId } : undefined;
}

/** Autor de la lista o dueño del club al que pertenece. */
export async function canManageList(
  list: { userId: string; clubId: string | null },
  userId: string
) {
  if (list.userId === userId) return true;
  if (!list.clubId) return false;
  const [club] = await db
    .select({ ownerId: clubs.ownerId })
    .from(clubs)
    .where(eq(clubs.id, list.clubId))
    .limit(1);
  return club?.ownerId === userId;
}

export async function isUserAdmin(userId: string) {
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row?.isAdmin;
}

/**
 * Clases que puede contener una lista pública (y que se copian con ella):
 * solo clases publicadas de la biblioteca, nunca contenido privado de quien
 * creó la lista.
 */
export function publicListClassCondition(): SQL {
  return and(eq(classes.isLibrary, true), eq(classes.status, "published"))!;
}

/** Etiqueta del espacio activo para la cabecera de "Mis listas". */
export async function getSpaceLabel(activeClubId: string | null) {
  if (!activeClubId) return "Espacio particular";
  const [club] = await db
    .select({ name: clubs.name })
    .from(clubs)
    .where(eq(clubs.id, activeClubId))
    .limit(1);
  return club ? `Club ${club.name}` : "Espacio del club";
}
