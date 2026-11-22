import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { listPlayerTournaments, type PlayerTournament } from "@/lib/players/club";
import { formatMatchDate } from "@/lib/matches/format";

export const metadata = { title: "Torneos" };

function dates(t: PlayerTournament) {
  return t.endDate && t.endDate !== t.startDate
    ? `${formatMatchDate(t.startDate)} – ${formatMatchDate(t.endDate)}`
    : formatMatchDate(t.startDate);
}

function TournamentList({
  items,
  hrefFor,
}: {
  items: PlayerTournament[];
  hrefFor: (t: PlayerTournament) => string;
}) {
  return (
    <ul className="tp-panel divide-y divide-[#050505]/8 overflow-hidden p-0 dark:divide-white/10">
      {items.map((t) => (
        <li key={t.id}>
          <Link
            href={hrefFor(t)}
            className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
              <p className="text-xs text-foreground/55">
                {dates(t)}
                {t.category ? ` · ${t.category}` : ""}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-foreground/35" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Torneos del jugador: los de Ten Planner en los que está inscrito y, si
 * está vinculado a un club, los del club abiertos a su categoría. Un jugador
 * no crea torneos (solo clubes y monitores).
 */
export default async function JugadorTorneosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await listPlayerTournaments(user.id, user.email);
  const view = (t: PlayerTournament) =>
    t.visibility === "public" ? `/t/${t.slug}` : `/mi-familia/torneos/${t.slug}`;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={Trophy}
          kicker="Jugador"
          title="Torneos"
          description="Los torneos organizados con Ten Planner en los que participas."
        />

        <section className="space-y-3">
          <h2 className="text-lg font-black">Mis torneos</h2>
          {data.registered.length === 0 ? (
            <div className="tp-panel flex flex-col items-center gap-3 border-dashed py-12 text-center">
              <Trophy className="size-8 text-foreground/30" />
              <p className="max-w-sm text-sm leading-6 text-foreground/60">
                No has sido inscrito en ningún torneo organizado con la
                plataforma Ten Planner.
              </p>
            </div>
          ) : (
            <TournamentList items={data.registered} hrefFor={view} />
          )}
        </section>

        {data.linked && (
          <section className="space-y-3">
            <h2 className="text-lg font-black">Puedes inscribirte</h2>
            <p className="text-sm text-foreground/60">
              {data.category
                ? `Torneos de tu club con inscripción abierta para tu categoría (${data.category}) o sin categoría.`
                : "Torneos de tu club con inscripción abierta. Indica tu fecha de nacimiento en tu perfil para ver solo los de tu categoría."}
            </p>
            {data.open.length === 0 ? (
              <p className="text-sm text-foreground/55">
                Ahora mismo no hay torneos abiertos en tu club.
              </p>
            ) : (
              <TournamentList items={data.open} hrefFor={(t) => `/t/${t.slug}`} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}
