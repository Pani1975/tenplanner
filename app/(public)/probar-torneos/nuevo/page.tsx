import { loadSkillLevels } from "@/lib/skill-levels-repo";
import { levelOptions } from "@/lib/tournaments/levels";
import { TournamentWizard } from "@/app/(app)/torneos/nuevo/tournament-wizard";

// Nuevo torneo de prueba: el mismo asistente, sin pistas ni circuitos.
export default async function NuevoTorneoPruebaPage() {
  const levels = await loadSkillLevels().catch(() => []);
  return (
    <TournamentWizard
      levels={levelOptions(levels, "tenis")}
      places={[]}
      circuits={[]}
      clubTimeZone={null}
    />
  );
}
