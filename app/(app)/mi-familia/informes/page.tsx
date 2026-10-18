import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamilyPlayers, pickPlayer } from "@/lib/family-data";
import {
  FamilyHeader,
  NoPlayers,
  PlayerSwitcher,
} from "@/components/family/family-header";

export default async function FamilyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { alumno } = await searchParams;
  const players = await getFamilyPlayers(user.id);
  const player = pickPlayer(players, alumno);

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={FileText}
          kicker="Panel de familias"
          title="Informes"
          description="Los informes de evolución que publiquen el monitor o el club sobre el jugador."
        />
        {!player ? (
          <NoPlayers />
        ) : (
          <>
            <PlayerSwitcher
              players={players}
              current={player.studentId}
              basePath="/mi-familia/informes"
            />
            <div className="tp-panel flex flex-col items-center gap-3 border-dashed py-16 text-center">
              <FileText className="size-8 text-foreground/30" />
              <p className="max-w-sm text-sm leading-6 text-foreground/60">
                Todavía no hay informes publicados de {player.name}. Cuando el
                monitor publique uno, lo verás aquí.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
