import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSkillLevels } from "@/lib/skill-levels-repo";
import { levelOptions } from "@/lib/tournaments/levels";
import {
  getOrganizer,
  listCircuits,
  listPlaces,
} from "@/lib/tournaments/server";
import { TournamentWizard } from "./tournament-wizard";

export default async function NuevoTorneoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizer = await getOrganizer(user.id);
  const [levels, places, circuits] = await Promise.all([
    loadSkillLevels().catch(() => []),
    listPlaces(organizer).catch(() => []),
    listCircuits(organizer).catch(() => []),
  ]);

  return (
    <TournamentWizard
      levels={levelOptions(levels, organizer.sport)}
      places={places}
      circuits={circuits}
    />
  );
}
