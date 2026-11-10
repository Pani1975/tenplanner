import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clubs, users } from "@/db/schema";
import {
  canTagWithClub,
  getClubAccountClubId,
  getCoachMemberships,
} from "@/lib/clubs";
import type { WorkMode } from "@/lib/work-mode-labels";

export * from "@/lib/work-mode-labels";

/**
 * Modo de trabajo actual del usuario, con el nombre del dueño del espacio:
 * - "tenplanner" ("Modo administrador"): la cuenta de la plataforma
 *   (users.is_platform_account) siempre, o un administrador que lo elige en
 *   el selector de modo (users.admin_mode). Lo que crea o edita es público:
 *   Biblioteca de ejercicios y clases, catálogo base de objetivos.
 * - "club": trabaja como un club del que es miembro activo. Con
 *   `management`, en el Modo gestión de la cuenta de ese club.
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
      managementMode: users.managementMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return { kind: "particular", ownerName: "" };
  if (row.isPlatformAccount || (row.isAdmin && row.adminMode))
    return { kind: "tenplanner", ownerName: row.name };

  // La cuenta de un club no tiene Modo particular: sin club activo, su club.
  const accountClubId = await getClubAccountClubId(userId);
  const clubId =
    row.activeClubId && (await canTagWithClub(userId, row.activeClubId))
      ? row.activeClubId
      : accountClubId;
  if (clubId) {
    const [club] = await db
      .select({ name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1);
    if (club)
      return {
        kind: "club",
        clubId,
        clubName: club.name,
        management: row.managementMode && clubId === accountClubId,
      };
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
    .set({ adminMode: true, managementMode: false, activeClubId: null })
    .where(eq(users.id, userId));
}

/**
 * ¿Está la cuenta de un club en "Modo gestión"? Devuelve el id de su club o
 * null. Solo la cuenta del club (su dueño) puede usarlo.
 */
export async function getManagementClubId(
  userId: string
): Promise<string | null> {
  const [[row], clubId] = await Promise.all([
    db
      .select({ managementMode: users.managementMode })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    getClubAccountClubId(userId),
  ]);
  return row?.managementMode && clubId ? clubId : null;
}

/** Entra en "Modo gestión". Lanza un error si no es la cuenta de un club. */
export async function enterManagementMode(userId: string): Promise<string> {
  const clubId = await getClubAccountClubId(userId);
  if (!clubId) throw new Error("not_club_account");
  await db
    .update(users)
    .set({ managementMode: true, adminMode: false, activeClubId: clubId })
    .where(eq(users.id, userId));
  return clubId;
}

/**
 * Modo con el que se empieza al entrar: Modo administrador si es
 * administrador, el modo de su club si es la cuenta de un club y Modo
 * particular si es monitor. Se aplica en cada inicio de sesión.
 */
export async function resetToDefaultWorkMode(userId: string) {
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return;
  const clubId = row.isAdmin ? null : await getClubAccountClubId(userId);
  await db
    .update(users)
    .set({
      adminMode: row.isAdmin,
      managementMode: false,
      activeClubId: clubId,
    })
    .where(eq(users.id, userId));
}

/**
 * Modo monitor de alguien que pertenece a uno o más clubes: su espacio
 * propio y privado (el club no entra). Ahí prepara ejercicios, clases y
 * sesiones y los envía al club, pero no lleva alumnos, grupos, objetivos ni
 * reservas de pistas: eso está en el modo del club. Devuelve los ids de sus
 * clubes, o null si no está en ese espacio.
 */
export async function getClubMonitorSpaceClubIds(
  userId: string
): Promise<string[] | null> {
  const clubs = await getClubMonitorSpaceClubs(userId);
  return clubs ? clubs.map((c) => c.id) : null;
}

/** Como getClubMonitorSpaceClubIds, con el nombre de cada club. */
export async function getClubMonitorSpaceClubs(
  userId: string
): Promise<{ id: string; name: string }[] | null> {
  const mode = await getWorkMode(userId);
  if (mode.kind !== "particular") return null;
  const memberships = await getCoachMemberships(userId);
  return memberships.length > 0
    ? memberships.map((m) => ({ id: m.club.id, name: m.club.name }))
    : null;
}

/**
 * En el Modo monitor de un monitor de club, los apartados del club (alumnos,
 * grupos, objetivos, reservas) no existen: se vuelve al inicio.
 */
export async function redirectIfClubMonitorSpace(userId: string) {
  if (await getClubMonitorSpaceClubIds(userId)) redirect("/dashboard");
}
