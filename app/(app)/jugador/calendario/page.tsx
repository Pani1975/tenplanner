import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamilyPlayers, getPlayerCalendar } from "@/lib/family-data";
import { getPlayerCalendarItems } from "@/lib/players/club";
import { FamilyHeader } from "@/components/family/family-header";
import { FamilyCalendarClient } from "../../mi-familia/calendario/family-calendar-client";

export const metadata = { title: "Calendario" };

const DAY = 24 * 60 * 60 * 1000;

/**
 * Calendario del jugador: sus sesiones, festivos y eventos de su club (si
 * está vinculado) y los torneos del club y aquellos en los que está inscrito.
 */
export default async function JugadorCalendarioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const from = new Date(now.getTime() - 120 * DAY);
  const to = new Date(now.getTime() + 365 * DAY);

  const [players, items] = await Promise.all([
    getFamilyPlayers(user.id).catch(() => []),
    getPlayerCalendarItems(user.id, user.email, from, to).catch(() => []),
  ]);
  const linked = players.filter((p) => p.clubId);
  const calendars = await Promise.all(
    linked.map((p) =>
      getPlayerCalendar(p, from, to).catch(() => ({ sessions: [], holidays: [] }))
    )
  );
  const sessions = [
    ...new Map(
      calendars.flatMap((c) => c.sessions).map((s) => [s.id, s])
    ).values(),
  ];
  const holidays = [
    ...new Map(
      calendars.flatMap((c) => c.holidays).map((h) => [h.id, h])
    ).values(),
  ];

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={CalendarDays}
          kicker="Jugador"
          title="Calendario"
          description={
            linked.length
              ? "Tus sesiones, los eventos y torneos de tu club y los torneos en los que estás inscrito."
              : "Los torneos de Ten Planner en los que estás inscrito. Cuando tu club te vincule, verás también tus sesiones y los eventos del club."
          }
        />
        <FamilyCalendarClient
          sessions={sessions.map((s) => ({
            ...s,
            scheduledAt: s.scheduledAt.toISOString(),
          }))}
          holidays={holidays}
          groupNames={Object.fromEntries(
            linked.flatMap((p) => p.groups.map((g) => [g.id, g.name]))
          )}
          items={items}
        />
      </div>
    </div>
  );
}
