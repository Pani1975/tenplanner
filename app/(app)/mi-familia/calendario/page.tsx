import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getFamilyPlayers,
  getPlayerCalendar,
  pickPlayer,
} from "@/lib/family-data";
import {
  FamilyHeader,
  NoPlayers,
  PlayerSwitcher,
} from "@/components/family/family-header";
import { FamilyCalendarClient } from "./family-calendar-client";

const DAY = 24 * 60 * 60 * 1000;

export default async function FamilyCalendarPage({
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

  const now = new Date();
  const calendar = player
    ? await getPlayerCalendar(
        player,
        new Date(now.getTime() - 120 * DAY),
        new Date(now.getTime() + 365 * DAY)
      )
    : null;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={CalendarDays}
          kicker="Panel de familias"
          title="Calendario"
          description={
            player
              ? `Clases de ${player.name}, festivos del club y cambios de agenda.`
              : "Las clases de tu jugador y los festivos del club."
          }
        />
        {!player || !calendar ? (
          <NoPlayers />
        ) : (
          <>
            <PlayerSwitcher
              players={players}
              current={player.studentId}
              basePath="/mi-familia/calendario"
            />
            <FamilyCalendarClient
              sessions={calendar.sessions.map((s) => ({
                ...s,
                scheduledAt: s.scheduledAt.toISOString(),
              }))}
              holidays={calendar.holidays}
              groupNames={Object.fromEntries(
                player.groups.map((g) => [g.id, g.name])
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
