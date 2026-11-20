"use client";

// Puntuación del circuito: puntos que suma cada jugador según hasta dónde
// llega en cada torneo (los define el organizador). Vale para todos los
// torneos del circuito; la clasificación está en /t/c/<slug>.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, Loader2, Trophy } from "lucide-react";
import {
  DEFAULT_POINTS,
  type KnockoutStage,
  type PointsTable,
} from "@/lib/tournaments/circuit";
import { useApiError } from "../use-api-error";
import { useTournamentApi } from "../tournament-api";

const STAGES: KnockoutStage[] = [
  "winner",
  "final",
  "semifinal",
  "quarterfinal",
  "round_of_16",
  "earlier",
];

export function CircuitPointsPanel({
  circuit,
  format,
}: {
  circuit: {
    id: string;
    name: string;
    season: string | null;
    slug: string;
    points: PointsTable | null;
  };
  format: "knockout" | "round_robin";
}) {
  const t = useTranslations("tournaments.circuitPoints");
  const apiError = useApiError();
  const api = useTournamentApi();
  const initial = circuit.points ?? DEFAULT_POINTS;
  const [ko, setKo] = useState<Record<KnockoutStage, string>>(
    Object.fromEntries(
      STAGES.map((s) => [s, String(initial.knockout[s])])
    ) as Record<KnockoutStage, string>
  );
  const [rr, setRr] = useState(initial.roundRobin.join(", "));
  const [participation, setParticipation] = useState(
    String(initial.participation)
  );
  const [saving, setSaving] = useState(false);

  const num = (v: string) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 10000 ? n : null;
  };
  const rrList = rr
    .split(/[,\s;]+/)
    .filter(Boolean)
    .map(num);
  const valid =
    STAGES.every((s) => num(ko[s]) !== null) &&
    rrList.every((n) => n !== null) &&
    rrList.length <= 32 &&
    num(participation) !== null;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const points: PointsTable = {
      knockout: Object.fromEntries(
        STAGES.map((s) => [s, num(ko[s])!])
      ) as Record<KnockoutStage, number>,
      roundRobin: rrList as number[],
      participation: num(participation)!,
    };
    const res = await api.fetch(`/api/tournaments/circuits/${circuit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });
    setSaving(false);
    if (!res.ok) return toast.error(await apiError(res));
    toast.success(t("saved"));
    api.refresh();
  }

  const field = "tp-field h-11 w-full px-3 text-base tabular-nums";
  return (
    <section className="tp-card-soft space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase text-foreground/60">
            <Trophy className="size-4" />
            {t("title")}
          </p>
          <p className="text-sm font-semibold">
            {circuit.season
              ? `${circuit.name} · ${circuit.season}`
              : circuit.name}
          </p>
          <p className="text-xs text-foreground/65">{t("help")}</p>
        </div>
        <a
          href={`/t/c/${circuit.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold"
        >
          <ExternalLink className="size-4" />
          {t("standings")}
        </a>
      </div>

      {format === "knockout" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAGES.map((s) => (
            <label key={s} className="block space-y-1">
              <span className="text-xs font-bold text-foreground/70">
                {t(`stage.${s}`)}
              </span>
              <input
                inputMode="numeric"
                value={ko[s]}
                onChange={(e) => setKo((p) => ({ ...p, [s]: e.target.value }))}
                className={field}
              />
            </label>
          ))}
        </div>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-bold text-foreground/70">
            {t("roundRobin")}
          </span>
          <input
            value={rr}
            onChange={(e) => setRr(e.target.value)}
            placeholder="100, 70, 50, 40"
            className={field}
          />
        </label>
      )}
      <label className="block max-w-[12rem] space-y-1">
        <span className="text-xs font-bold text-foreground/70">
          {t("participation")}
        </span>
        <input
          inputMode="numeric"
          value={participation}
          onChange={(e) => setParticipation(e.target.value)}
          className={field}
        />
      </label>
      {!valid && (
        <p className="text-sm font-semibold text-red-600">{t("invalid")}</p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!valid || saving}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </button>
      </div>
    </section>
  );
}
