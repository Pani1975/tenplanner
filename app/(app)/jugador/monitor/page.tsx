import { redirect } from "next/navigation";
import { Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { listPlayerCoaches } from "@/lib/players/club";

export const metadata = { title: "Mi monitor" };

/** Monitores (sin club) que te tienen como alumno. Se vinculan por invitación del monitor. */
export default async function JugadorMonitorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const coaches = await listPlayerCoaches(user.id).catch(() => []);

  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-3xl space-y-6">
        <FamilyHeader
          icon={UserRound}
          kicker="Jugador"
          title="Mi monitor"
          description="El monitor que te ha vinculado como alumno. Sus sesiones aparecen en Mis sesiones."
        />
        {coaches.length === 0 ? (
          <p className="text-sm text-foreground/55">
            Todavía no tienes monitor vinculado. Cuando te envíe una invitación
            y la aceptes con tu correo, aparecerá aquí.
          </p>
        ) : (
          <ul className="space-y-3">
            {coaches.map((c) => (
              <li key={c.id} className="tp-panel space-y-2 p-4 sm:p-6">
                <h2 className="text-lg font-black">{c.name}</h2>
                {c.email && (
                  <p className="flex items-center gap-2 text-sm text-foreground/75">
                    <Mail className="size-4 shrink-0" />
                    {c.email}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
