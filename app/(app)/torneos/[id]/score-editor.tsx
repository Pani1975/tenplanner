"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { dmSans } from "@/app/fonts/dm-sans";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  evaluateResult,
  type MatchScore,
  type ResultType,
  type ScoringRules,
} from "@/lib/tournaments/score";
import {
  needsTiebreak,
  rowsToScore,
  scoreLayout,
  scoreToRows,
  type PointsRow,
  type SetRow,
} from "@/lib/tournaments/score-form";
import { useApiError } from "../use-api-error";
import { useTournamentApi } from "../tournament-api";

export type EditableMatch = {
  id: string;
  aName: string;
  bName: string;
  status: string;
  resultType: string | null;
  score: MatchScore | null;
  winner: "a" | "b" | null;
  courtLabel: string | null;
};

/**
 * Marcador de tenis: sets (con tie-break si acaba 7-6), super tie-break si
 * el torneo lo usa, no presentado (walkover) o retirada. Se valida antes
 * de guardar con las mismas reglas que el servidor.
 */
export function ScoreEditor({
  tournamentId,
  match,
  rules,
  onClose,
  onSaved,
}: {
  tournamentId: string;
  match: EditableMatch;
  rules: ScoringRules;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useTournamentApi();
  const t = useTranslations("tournaments.score");
  const te = useTranslations("tournaments.errors");
  const apiError = useApiError();
  const layout = scoreLayout(rules);
  const initial = scoreToRows(match.score, rules);
  const [type, setType] = useState<ResultType>(
    (match.resultType as ResultType) ?? "normal"
  );
  const [rows, setRows] = useState<SetRow[]>(initial.rows);
  const [superRow, setSuperRow] = useState<PointsRow>(initial.superRow);
  const [winner, setWinner] = useState<"a" | "b" | null>(match.winner);
  const [court, setCourt] = useState(match.courtLabel ?? "");
  const [saving, setSaving] = useState(false);

  // Validación en vivo.
  const parsed = rowsToScore(
    rows,
    layout.superTiebreak ? superRow : null,
    rules.gamesPerSet
  );
  const result =
    type === "walkover"
      ? evaluateResult(
          { resultType: "walkover", winner: winner ?? undefined },
          rules
        )
      : parsed.ok
        ? evaluateResult(
            {
              resultType: type,
              score: parsed.score,
              winner: winner ?? undefined,
            },
            rules
          )
        : ({ ok: false, error: parsed.error } as const);
  const touched =
    type === "walkover" ||
    rows.some((r) => r.a || r.b) ||
    !!superRow.a ||
    !!superRow.b;
  const name = (s: "a" | "b") => (s === "a" ? match.aName : match.bName);

  async function save() {
    if (!result.ok) return;
    setSaving(true);
    const res = await api.fetch(
      `/api/tournaments/${tournamentId}/matches/${match.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultType: type,
          score: type === "walkover" ? null : parsed.ok ? parsed.score : null,
          winner: type === "normal" ? undefined : winner,
          courtLabel: court.trim() || null,
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    toast.success(t("saved"));
    onSaved();
  }

  async function clear() {
    setSaving(true);
    const res = await api.fetch(
      `/api/tournaments/${tournamentId}/matches/${match.id}`,
      { method: "DELETE" }
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    toast.success(t("cleared"));
    onSaved();
  }

  const cell =
    "tp-field h-12 w-14 px-0 text-center text-lg font-semibold tabular-nums";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`${dmSans.variable} tp-torneos max-h-[92vh] overflow-y-auto sm:max-w-md`}
      >
        <DialogHeader>
          <DialogTitle className="tp-title text-xl">{t("title")}</DialogTitle>
          <DialogDescription>
            {match.aName} — {match.bName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-1 rounded-full bg-foreground/5 p-1">
          {(["normal", "walkover", "retired"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => setType(k)}
              className={cn(
                "min-h-10 rounded-full px-2 text-xs font-bold",
                type === k ? "bg-[#d6f04a] text-black" : "text-foreground/70"
              )}
            >
              {t(`type.${k}`)}
            </button>
          ))}
        </div>

        {type !== "walkover" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase text-foreground/55">
                <th className="text-left font-bold">{t("player")}</th>
                {rows.map((_, i) => (
                  <th key={i} className="w-14 font-bold">
                    {t("set", { n: i + 1 })}
                  </th>
                ))}
                {layout.superTiebreak && (
                  <th className="w-14 font-bold" title={t("superTiebreak")}>
                    {t("stb")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(["a", "b"] as const).map((side) => (
                <tr key={side}>
                  <td className="max-w-0 truncate py-1 pr-2 font-semibold">
                    {name(side)}
                  </td>
                  {rows.map((r, i) => (
                    <td key={i} className="py-1 text-center">
                      <input
                        inputMode="numeric"
                        maxLength={2}
                        aria-label={t("gamesOf", {
                          n: i + 1,
                          name: name(side),
                        })}
                        value={r[side]}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    [side]: e.target.value.replace(/\D/g, ""),
                                  }
                                : x
                            )
                          )
                        }
                        className={cell}
                      />
                    </td>
                  ))}
                  {layout.superTiebreak && (
                    <td className="py-1 text-center">
                      <input
                        inputMode="numeric"
                        maxLength={2}
                        aria-label={t("stbOf", { name: name(side) })}
                        value={superRow[side]}
                        onChange={(e) =>
                          setSuperRow((prev) => ({
                            ...prev,
                            [side]: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className={cell}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {type !== "walkover" &&
          rows.map(
            (r, i) =>
              needsTiebreak(r, rules.gamesPerSet) && (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 font-semibold">
                    {t("tiebreakOfSet", { n: i + 1 })}
                  </span>
                  {(["tbA", "tbB"] as const).map((k) => (
                    <input
                      key={k}
                      inputMode="numeric"
                      maxLength={2}
                      aria-label={t("tiebreakPoints", {
                        n: i + 1,
                        name: name(k === "tbA" ? "a" : "b"),
                      })}
                      value={r[k]}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x, j) =>
                            j === i
                              ? { ...x, [k]: e.target.value.replace(/\D/g, "") }
                              : x
                          )
                        )
                      }
                      className="tp-field h-11 w-14 text-center"
                    />
                  ))}
                </div>
              )
          )}

        {type !== "normal" && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-bold uppercase text-foreground/60">
              {type === "walkover" ? t("whoWins") : t("whoWinsRetired")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(["a", "b"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={winner === s}
                  onClick={() => setWinner(s)}
                  className={cn(
                    "min-h-11 truncate rounded-xl px-3 text-sm font-semibold",
                    winner === s ? "bg-[#d6f04a] text-black" : "bg-foreground/5"
                  )}
                >
                  {name(s)}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase text-foreground/60">
            {t("court")}
          </span>
          <input
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            maxLength={60}
            placeholder={t("courtPlaceholder")}
            className="tp-field h-11 w-full px-4 text-base"
          />
        </label>

        <p
          role="status"
          className={cn(
            "min-h-5 text-sm font-semibold",
            result.ok
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600"
          )}
        >
          {!touched
            ? ""
            : result.ok
              ? t("winnerIs", { name: name(result.winner) })
              : te.has(result.error)
                ? te(result.error)
                : te("generic")}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {match.status === "played" ? (
            <button
              type="button"
              onClick={clear}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-red-600 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              {t("clear")}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={save}
            disabled={!result.ok || saving}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-6 text-sm font-bold text-black disabled:opacity-40"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
