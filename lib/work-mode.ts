import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, users } from "@/db/schema";
import { canTagWithClub } from "@/lib/clubs";
import type { WorkMode } from "@/lib/work-mode-labels";

export * from "@/lib/work-mode-labels";

/**
 * Modo de trabajo actual del usuario, con el nombre del dueño del espacio:
 * - "tenplanner": solo administradores; lo que se crea o edita es de la
 *   plataforma (Biblioteca pública, catálogo base de objetivos).
 * - "club": trabaja como un club del que es miembro activo.
 * - "particular": su espacio personal.
 */
export async function getWorkMode(userId: string): Promise<WorkMode> {
  const [row] = await db
    .select({
      name: users.name,
      isAdmin: users.isAdmin,
      activeClubId: users.activeClubId,
      tenPlannerMode: users.tenPlannerMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return { kind: "particular", ownerName: "" };
  if (row.isAdmin && row.tenPlannerMode)
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

/** ¿Está el usuario en "Modo Ten Planner"? (exige ser administrador). */
export async function isTenPlannerMode(userId: string): Promise<boolean> {
  return (await getWorkMode(userId)).kind === "tenplanner";
}

/** Entra en "Modo Ten Planner". Lanza un error si no es administrador. */
export async function enterTenPlannerMode(userId: string) {
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row?.isAdmin) throw new Error("not_admin");
  await db
    .update(users)
    .set({ tenPlannerMode: true, activeClubId: null })
    .where(eq(users.id, userId));
}
