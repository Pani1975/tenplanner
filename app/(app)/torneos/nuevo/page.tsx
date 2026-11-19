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
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { asTimeZone } from "@/lib/tournaments/schedule";

export default async function NuevoTorneoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizer = await getOrganizer(user.id);
  const [levels, places, circuits, club] = await Promise.all([
    loadSkillLevels().catch(() => []),
    listPlaces(organizer).catch(() => []),
    listCircuits(organizer).catch(() => []),
    // Torneo de club: se propone la hora del club («Mi club»).
    organizer.clubId
      ? db
          .select({ timeZone: clubs.timeZone })
          .from(clubs)
          .where(eq(clubs.id, organizer.clubId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : null,
  ]);

  return (
    <TournamentWizard
      levels={levelOptions(levels, organizer.sport)}
      places={places}
      circuits={circuits}
      clubTimeZone={club ? asTimeZone(club.timeZone) : null}
    />
  );
}
