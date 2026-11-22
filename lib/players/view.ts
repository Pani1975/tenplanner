import { isFamilyOnlyUser } from "@/lib/family";
import { isPlayerAccountType } from "@/lib/family-account";
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
