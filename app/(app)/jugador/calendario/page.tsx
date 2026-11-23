import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamilyPlayers, getPlayerCalendar } from "@/lib/family-data";
import { getPlayerCalendarItems } from "@/lib/players/club";
import { FamilyHeader } from "@/components/family/family-header";
import { FamilyCalendarClient } from "../../mi-familia/calendario/family-calendar-client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendario" };

const DAY = 24 * 60 * 60 * 1000;

/**
 * Calendario del jugador: sus sesiones, festivos y eventos de su club (si
 * está vinculado) y los torneos del club y aquellos en los que está inscrito.
 */
export default async function JugadorCalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const requested = (await searchParams).vista;
  const now = new Date();
  const from = new Date(now.getTime() - 120 * DAY);
  const to = new Date(now.getTime() + 365 * DAY);

  const [players, items] = await Promise.all([
    getFamilyPlayers(user.id).catch(() => []),
    getPlayerCalendarItems(user.id, user.email, from, to).catch(() => []),
  ]);
  const linked = players.filter((p) => p.clubId);
  // «Mi calendario»: sus sesiones, festivos y torneos en los que está
  // inscrito. «Calendario club» (solo con club): eventos y torneos del club.
  const vista = requested === "club" && linked.length > 0 ? "club" : "mio";
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
            vista === "club"
              ? "Eventos y torneos de tu club."
              : linked.length
                ? "Tus sesiones del club, los festivos y los torneos en los que estás inscrito."
                : "Los torneos de Ten Planner en los que estás inscrito. Cuando tu club te vincule, verás también tus sesiones."
          }
        />
        {linked.length > 0 && (
          <nav
            className="grid grid-cols-2 gap-1 rounded-full bg-foreground/5 p-1"
            aria-label="Calendario"
          >
            {(
              [
                ["mio", "Mi calendario", "/jugador/calendario"],
                ["club", "Calendario club", "/jugador/calendario?vista=club"],
              ] as const
            ).map(([id, label, href]) => (
              <Link
                key={id}
                href={href}
                aria-current={vista === id ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-full px-3 text-sm font-bold",
                  vista === id ? "bg-brand text-brand-foreground" : "text-foreground/70"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        <FamilyCalendarClient
          sessions={(vista === "club" ? [] : sessions).map((s) => ({
            ...s,
            scheduledAt: s.scheduledAt.toISOString(),
          }))}
          holidays={vista === "club" ? [] : holidays}
          groupNames={Object.fromEntries(
            linked.flatMap((p) => p.groups.map((g) => [g.id, g.name]))
          )}
          items={items.filter((i) =>
            vista === "club" ? i.fromClub : i.kind === "torneo" && i.registered
          )}
        />
      </div>
    </div>
  );
}
