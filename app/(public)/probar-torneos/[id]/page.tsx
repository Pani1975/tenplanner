import { loadSkillLevels } from "@/lib/skill-levels-repo";
import { levelOptions } from "@/lib/tournaments/levels";
import { GuestTournamentDetail } from "../guest-client";

type Props = { params: Promise<{ id: string }> };

// Ficha de un torneo de prueba: los datos están en el navegador.
export default async function TorneoPruebaPage({ params }: Props) {
  const { id } = await params;
  const levels = await loadSkillLevels().catch(() => []);
  return (
    <GuestTournamentDetail
      id={id}
      levels={levelOptions(levels, "tenis")}
      baseUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenplanner.com"}
    />
  );
}
