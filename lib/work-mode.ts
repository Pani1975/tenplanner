import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, users } from "@/db/schema";
import { canTagWithClub } from "@/lib/clubs";
import type { WorkMode } from "@/lib/work-mode-labels";

export * from "@/lib/work-mode-labels";

/**
 * Modo de trabajo actual del usuario, con el nombre del dueño del espacio:
 * - "tenplanner" ("Modo administrador"): la cuenta de la plataforma
 *   (users.is_platform_account) siempre, o un administrador que lo elige en
 *   el selector de modo (users.admin_mode). Lo que crea o edita es público:
 *   Biblioteca de ejercicios y clases, catálogo base de objetivos.
 * - "club": trabaja como un club del que es miembro activo.
 * - "particular": su espacio personal.
 */
export async function getWorkMode(userId: string): Promise<WorkMode> {
  const [row] = await db
    .select({
      name: users.name,
      activeClubId: users.activeClubId,
      isPlatformAccount: users.isPlatformAccount,
      isAdmin: users.isAdmin,
      adminMode: users.adminMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return { kind: "particular", ownerName: "" };
  if (row.isPlatformAccount || (row.isAdmin && row.adminMode))
    return { kind: "tenplanner", ownerName: row.name };

  if (row.activeClubId && (await canTagWithClub(userId, row.activeClubId))) {
    const [club] = await db
      .select({ name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, row.activeClubId))
      .limit(1);
    if (club)
      return { kind: "club", clubId: row.activeClubId, clubName: club.name };
  }
  return { kind: "particular", ownerName: row.name };
}

/**
 * ¿Trabaja ahora en "Modo administrador"? (cuenta de la plataforma, o
 * administrador con ese modo elegido): lo que crea o edita es público.
 */
export async function isTenPlannerMode(userId: string): Promise<boolean> {
  const [row] = await db
    .select({
      isPlatformAccount: users.isPlatformAccount,
      isAdmin: users.isAdmin,
      adminMode: users.adminMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row?.isPlatformAccount || (!!row?.isAdmin && !!row?.adminMode);
}

/** Entra en "Modo administrador". Lanza un error si no es administrador. */
export async function enterAdminMode(userId: string) {
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row?.isAdmin) throw new Error("not_admin");
  await db
    .update(users)
    .set({ adminMode: true, activeClubId: null })
    .where(eq(users.id, userId));
}
