"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { roundLabelKey } from "@/lib/tournaments/bracket";
import { computeStandings } from "@/lib/tournaments/round-robin";
import {
  evaluateResult,
  formatScore,
  type MatchScore,
  type ResultType,
  type ScoringRules,
} from "@/lib/tournaments/score";
import { ScoreEditor, type EditableMatch } from "./score-editor";

export type ManagerMatch = {
  id: string;
  round: number;
  position: number;
  entryAId: string | null;
  entryBId: string | null;
  status: string;
  winnerEntryId: string | null;
  score: MatchScore | null;
  resultType: string | null;
  courtLabel: string | null;
};

/** Cuadro (eliminatoria) o clasificación y jornadas (liguilla) del organizador. */
export function DrawPanel({
  tournamentId,
  format,
  matches,
  names,
  rules,
  canEdit,
}: {
  tournamentId: string;
  format: "knockout" | "round_robin";
  matches: ManagerMatch[];
  names: Record<string, string>;
  rules: ScoringRules;
  canEdit: boolean;
}) {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const [editing, setEditing] = useState<EditableMatch | null>(null);

  const rounds = [...new Set(matches.map((m) => m.round))].sort(
    (a, b) => a - b
  );
  const total = rounds.length ? Math.max(...rounds) : 0;
  const final =
    format === "knockout" ? matches.find((m) => m.round === total) : null;
  const champion =
    final?.status === "played" && final.winnerEntryId
      ? names[final.winnerEntryId]
      : null;
  const played = matches.filter((m) => m.status === "played").length;
  const playable = matches.filter((m) => m.status !== "bye").length;

  const standings = useMemo(() => {
    if (format !== "round_robin") return [];
    const ids = [
      ...new Set(
        matches.flatMap((m) => [m.entryAId, m.entryBId]).filter(Boolean)
      ),
    ] as string[];
    return computeStandings(
      ids,
      matches
        .filter((m) => m.entryAId && m.entryBId)
        .map((m) => {
          const side =
            m.winnerEntryId === m.entryAId
              ? "a"
              : m.winnerEntryId === m.entryBId
                ? "b"
                : undefined;
          const r =
            m.status === "played"
              ? evaluateResult(
                  {
                    resultType: (m.resultType ?? "normal") as ResultType,
                    score: m.score,
                    winner: side,
                  },
                  rules
                )
              : null;
          return {
            entryA: m.entryAId!,
            entryB: m.entryBId!,
            winner: m.status === "played" ? m.winnerEntryId : null,
            setsWon: r?.ok ? r.setsWon : undefined,
            games: r?.ok ? r.games : undefined,
          };
        })
    );
  }, [format, matches, rules]);

  const roundTitle = (r: number) => {
    if (format === "round_robin") return t("public.matchday", { n: r });
    const k = roundLabelKey(r, total);
    return k.key === "round_of"
      ? t("public.roundOf", { size: k.size ?? 0 })
      : t(`public.${k.key}`);
  };

  function open(m: ManagerMatch) {
    if (!canEdit || m.status === "bye" || !m.entryAId || !m.entryBId) return;
    setEditing({
      id: m.id,
      aName: names[m.entryAId] ?? "",
      bName: names[m.entryBId] ?? "",
      status: m.status,
      resultType: m.resultType,
      score: m.score,
      winner:
        m.winnerEntryId === m.entryAId
          ? "a"
          : m.winnerEntryId === m.entryBId
            ? "b"
            : null,
      courtLabel: m.courtLabel,
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="tp-title text-2xl">
          {format === "knockout"
            ? t("public.drawTitle")
            : t("public.standingsTitle")}
        </h2>
        <p className="text-sm text-foreground/65">
          {t("draw.progress", { played, total: playable })}
        </p>
      </div>
      {canEdit && played < playable && (
        <p className="text-sm text-foreground/70">{t("draw.tapToScore")}</p>
      )}

      {champion && (
        <p className="tp-card-blue flex items-center gap-3 p-4">
          <Trophy className="size-6 shrink-0" />
          <span>
            <span className="block text-xs font-bold uppercase text-white/80">
              {t("draw.champion")}
            </span>
            <span className="tp-title text-xl">{champion}</span>
          </span>
        </p>
      )}

      {format === "round_robin" && (
        <div className="tp-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-foreground/55">
                <th className="px-4 py-2">#</th>
                <th className="py-2">{t("public.player")}</th>
                <th className="px-2 py-2 text-center">{t("public.won")}</th>
                <th className="px-2 py-2 text-center">{t("public.lost")}</th>
                <th className="px-2 py-2 text-center">{t("public.sets")}</th>
                <th className="px-4 py-2 text-center">{t("draw.games")}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r) => (
                <tr key={r.entry} className="border-t border-foreground/10">
                  <td className="px-4 py-2 font-bold">{r.position}</td>
                  <td className="py-2 font-semibold">{names[r.entry]}</td>
                  <td className="px-2 py-2 text-center">{r.won}</td>
                  <td className="px-2 py-2 text-center">{r.lost}</td>
                  <td className="px-2 py-2 text-center">
                    {r.setsFor}-{r.setsAgainst}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {r.gamesFor}-{r.gamesAgainst}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className={cn(
          format === "knockout" &&
            "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        )}
      >
        {rounds.map((r) => (
          <div
            key={r}
            className={cn(
              "space-y-2",
              format === "knockout" ? "w-64 shrink-0 snap-start" : "pt-2"
            )}
          >
            <h3 className="text-xs font-bold uppercase text-foreground/60">
              {roundTitle(r)}
            </h3>
            <div
              className={cn(
                format === "round_robin" && "grid gap-2 sm:grid-cols-2"
              )}
            >
              {matches
                .filter((m) => m.round === r)
                .map((m) => {
                  const editable =
                    canEdit &&
                    m.status !== "bye" &&
                    !!m.entryAId &&
                    !!m.entryBId;
                  const label = (id: string | null) =>
                    id ? (names[id] ?? "") : null;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!editable}
                      onClick={() => open(m)}
                      aria-label={
                        editable
                          ? t("draw.editMatch", {
                              a: label(m.entryAId) ?? "",
                              b: label(m.entryBId) ?? "",
                            })
                          : undefined
                      }
                      className={cn(
                        "tp-card mb-2 block w-full space-y-1 p-3 text-left text-sm",
                        editable && "hover:border-[#1a6db5]",
                        editable &&
                          m.status !== "played" &&
                          "border-[#1a6db5]/50"
                      )}
                    >
                      {(["a", "b"] as const).map((s) => {
                        const id = s === "a" ? m.entryAId : m.entryBId;
                        const won = !!id && id === m.winnerEntryId;
                        return (
                          <p
                            key={s}
                            className={cn(
                              "truncate",
                              won
                                ? "font-bold text-[#1a6db5]"
                                : "text-foreground/85",
                              !id && "italic text-foreground/40"
                            )}
                          >
                            {label(id) ??
                              (m.status === "bye"
                                ? t("public.bye")
                                : t("public.tbd"))}
                          </p>
                        );
                      })}
                      <p className="flex items-center justify-between gap-2 text-xs text-foreground/60">
                        <span>
                          {m.status === "bye"
                            ? t("public.byeMatch")
                            : m.resultType === "walkover"
                              ? t("public.walkover")
                              : m.score
                                ? `${formatScore(m.score)}${m.resultType === "retired" ? ` (${t("public.retired")})` : ""}`
                                : t("public.pending")}
                          {m.courtLabel && ` · ${m.courtLabel}`}
                        </span>
                        {editable && <Pencil className="size-3.5 shrink-0" />}
                      </p>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ScoreEditor
          tournamentId={tournamentId}
          match={editing}
          rules={rules}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
