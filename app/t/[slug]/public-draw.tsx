import { useTranslations } from "next-intl";
import { roundLabelKey } from "@/lib/tournaments/bracket";
import type { PublicMatch } from "@/lib/tournaments/public";
import { computeStandings } from "@/lib/tournaments/round-robin";
import { formatScore, type MatchScore } from "@/lib/tournaments/score";
import { cn } from "@/lib/utils";

/** Sets y juegos de un marcador, desde el lado de A. */
function totals(score: MatchScore | null) {
  const sets = { a: 0, b: 0 };
  const games = { a: 0, b: 0 };
  for (const s of score?.sets ?? []) {
    games.a += s.a;
    games.b += s.b;
    if (s.a > s.b) sets.a += 1;
    else if (s.b > s.a) sets.b += 1;
  }
  if (score?.superTiebreak) {
    const st = score.superTiebreak;
    if (st.a > st.b) {
      sets.a += 1;
      games.a += 1;
    } else {
      sets.b += 1;
      games.b += 1;
    }
  }
  return { sets, games };
}

// Cuadro (eliminatoria, por rondas) o clasificación y partidos (liguilla).
export function PublicDraw({
  format,
  matches,
}: {
  format: "knockout" | "round_robin";
  matches: PublicMatch[];
  entrants: string[];
}) {
  const t = useTranslations("tournaments");
  const rounds = [...new Set(matches.map((m) => m.round))].sort(
    (a, b) => a - b
  );
  const total = rounds.length ? Math.max(...rounds) : 0;

  const roundTitle = (r: number) => {
    if (format === "round_robin") return t("public.matchday", { n: r });
    const k = roundLabelKey(r, total);
    return k.key === "round_of"
      ? t("public.roundOf", { size: k.size ?? 0 })
      : t(`public.${k.key}`);
  };

  // Clasificación de la liguilla.
  let standings: {
    name: string;
    won: number;
    lost: number;
    position: number;
    sets: string;
  }[] = [];
  if (format === "round_robin") {
    const names = new Map<string, string>();
    for (const m of matches) {
      if (m.aId && m.a) names.set(m.aId, m.a);
      if (m.bId && m.b) names.set(m.bId, m.b);
    }
    const rows = computeStandings(
      [...names.keys()],
      matches
        .filter((m) => m.aId && m.bId)
        .map((m) => {
          const tt = totals(m.score);
          return {
            entryA: m.aId!,
            entryB: m.bId!,
            winner:
              m.status === "played" && m.winner
                ? m.winner === "a"
                  ? m.aId!
                  : m.bId!
                : null,
            setsWon: tt.sets,
            games: tt.games,
          };
        })
    );
    standings = rows.map((r) => ({
      name: names.get(r.entry) ?? "",
      won: r.won,
      lost: r.lost,
      position: r.position,
      sets: `${r.setsFor}-${r.setsAgainst}`,
    }));
  }

  return (
    <section className="space-y-4">
      <h2 className="tp-title text-2xl">
        {format === "knockout"
          ? t("public.drawTitle")
          : t("public.standingsTitle")}
      </h2>

      {format === "round_robin" && (
        <div className="tp-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-foreground/55">
                <th className="px-4 py-2">#</th>
                <th className="py-2">{t("public.player")}</th>
                <th className="px-2 py-2 text-center">{t("public.won")}</th>
                <th className="px-2 py-2 text-center">{t("public.lost")}</th>
                <th className="px-4 py-2 text-center">{t("public.sets")}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.name} className="border-t border-foreground/10">
                  <td className="px-4 py-2 font-bold">{r.position}</td>
                  <td className="py-2 font-semibold">{r.name}</td>
                  <td className="px-2 py-2 text-center">{r.won}</td>
                  <td className="px-2 py-2 text-center">{r.lost}</td>
                  <td className="px-4 py-2 text-center">{r.sets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className={cn(
          format === "knockout" &&
            "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2"
        )}
      >
        {rounds.map((r) => (
          <div
            key={r}
            className={cn(
              "space-y-2",
              format === "knockout" && "w-64 shrink-0 snap-start"
            )}
          >
            <h3 className="pt-1 text-xs font-bold uppercase text-foreground/60">
              {roundTitle(r)}
            </h3>
            {matches
              .filter((m) => m.round === r)
              .map((m) => (
                <div key={m.id} className="tp-card space-y-1 p-3 text-sm">
                  <Side
                    name={m.a}
                    won={m.winner === "a"}
                    bye={m.status === "bye" && !m.a}
                  />
                  <Side
                    name={m.b}
                    won={m.winner === "b"}
                    bye={m.status === "bye" && !m.b}
                  />
                  <p className="text-xs text-foreground/60">
                    {m.status === "bye"
                      ? t("public.byeMatch")
                      : m.resultType === "walkover"
                        ? t("public.walkover")
                        : m.score
                          ? `${formatScore(m.score)}${m.resultType === "retired" ? ` (${t("public.retired")})` : ""}`
                          : t("public.pending")}
                  </p>
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Side({
  name,
  won,
  bye,
}: {
  name: string | null;
  won: boolean;
  bye: boolean;
}) {
  const t = useTranslations("tournaments.public");
  return (
    <p
      className={cn(
        "truncate",
        won ? "font-bold text-[#1a6db5]" : "text-foreground/85",
        !name && "italic text-foreground/40"
      )}
    >
      {name ?? (bye ? t("bye") : t("tbd"))}
    </p>
  );
}
