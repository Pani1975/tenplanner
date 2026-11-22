import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * «Ver como» (solo administradores): permite a un administrador con club
 * propio ver la app como monitor de su club o como jugador, sin crear
 * cuentas ficticias. Se guarda en una cookie del navegador; el servidor solo
 * la tiene en cuenta si la cuenta es administradora (users.is_admin).
 * - "monitor": su cuenta deja de comportarse como cuenta de club (sin Modo
 *   gestión, con Modo particular y el modo de su club como cualquier
 *   monitor miembro). Ver getClubAccountClubId en lib/clubs.ts.
 * - "jugador": menú y pantallas de jugador (lib/players/view.ts).
 * Sin cookie: la vista normal (club).
 */
export type ViewAs = "club" | "monitor" | "jugador";

export const VIEW_AS_COOKIE = "tp_view_as";

/** Valor de la cookie, sin comprobar si es administrador. */
export async function readViewAsCookie(): Promise<"monitor" | "jugador" | null> {
  try {
    const value = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    return value === "monitor" || value === "jugador" ? value : null;
  } catch {
    // Fuera de una petición (p. ej. tareas programadas): vista normal.
    return null;
  }
}

/** «Ver como» efectivo: solo para administradores. */
export async function adminViewAs(userId: string): Promise<ViewAs> {
  const value = await readViewAsCookie();
  if (!value) return "club";
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.isAdmin ? value : "club";
}
