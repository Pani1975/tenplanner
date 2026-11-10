import { createClient } from "@/lib/supabase/server";
import { redirectIfClubMonitorSpace } from "@/lib/work-mode";

/**
 * Layout de los apartados que solo existen en el modo del club (alumnos,
 * grupos, objetivos, reservas): en el Modo monitor de un monitor de club se
 * vuelve al inicio. Ver getClubMonitorSpaceClubIds.
 */
export async function ClubMonitorSpaceGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await redirectIfClubMonitorSpace(user.id);
  return <>{children}</>;
}
