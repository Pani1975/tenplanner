import { isFamilyOnlyUser } from "@/lib/family";
import { isFamilyAccountType, isPlayerAccountType } from "@/lib/family-account";
import { playerClubIds } from "@/lib/players/club";
import { adminViewAs } from "@/lib/view-as";

/**
 * ¿Ve esta cuenta la app como jugador? Una cuenta registrada «Como jugador»
 * que no trabaja como monitor, o un administrador con «Ver como: jugador».
 */
export async function isPlayerView(
  user: { id: string; user_metadata?: Record<string, unknown> | null },
  familyOnly?: boolean
): Promise<boolean> {
  if ((await adminViewAs(user.id)) === "jugador") return true;
  if (!isPlayerAccountType(user.user_metadata)) return false;
  return familyOnly ?? (await isFamilyOnlyUser(user.id, true).catch(() => false));
}

/**
 * Estado del menú para cuentas sin trabajo de monitor, común a las
 * plantillas de la app y de las páginas públicas (Clases, Ejercicios…):
 * familia, jugador y si el jugador está vinculado a un club.
 */
export async function getFamilyNavState(user: {
  id: string;
  user_metadata?: Record<string, unknown> | null;
}): Promise<{ familyOnly: boolean; playerView: boolean; playerLinked: boolean }> {
  const familyOnly = await isFamilyOnlyUser(
    user.id,
    isFamilyAccountType(user.user_metadata)
  ).catch(() => false);
  const playerView = await isPlayerView(user, familyOnly);
  const playerLinked = playerView
    ? (await playerClubIds(user.id).catch(() => [])).length > 0
    : false;
  return { familyOnly: familyOnly || playerView, playerView, playerLinked };
}
