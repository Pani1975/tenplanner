"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ObjectivesPicker } from "@/components/objectives/objectives-picker";
import type { BallId } from "@/lib/objectives-taxonomy";
import { ANTES } from "@/lib/session-engine/messages";
import {
  objectiveLabels,
  parseObjectiveLines,
} from "@/lib/session-engine/objectives";

const DURATIONS = [45, 60, 75, 90];

/**
 * "Antes de la propuesta": cuánto dura la clase, qué se quiere trabajar
 * (objetivos del catálogo del club o escritos) y dónde. Con eso se abre el
 * asistente directamente en el Paso 2 con la propuesta de Ten Planner.
 */
export function BeforeProposalForm({
  baseHref,
  defaultDuration,
  defaultObjectives,
  suggestions,
  places,
  defaultPlaceId,
  defaultBall,
}: {
  /** URL del asistente sin los parámetros de esta pantalla. */
  baseHref: string;
  defaultDuration: number;
  defaultObjectives: string;
  /** Objetivos del grupo que aún no están en el campo. */
  suggestions: string[];
  places: { id: string; name: string }[];
  defaultPlaceId: string | null;
  defaultBall: BallId | null;
}) {
  const router = useRouter();
  const [duration, setDuration] = useState(defaultDuration);
  const [custom, setCustom] = useState(!DURATIONS.includes(defaultDuration));
  const [objectives, setObjectives] = useState(defaultObjectives);
  const [placeId, setPlaceId] = useState(defaultPlaceId ?? "");
  const [showError, setShowError] = useState(false);
  const [going, setGoing] = useState(false);

  const lines = useMemo(() => parseObjectiveLines(objectives), [objectives]);
  const pending = suggestions.filter(
    (s) => !lines.some((l) => l.text.toLowerCase() === s.toLowerCase())
  );

  function addLines(newLines: string[]) {
    const current = objectives.trim();
    const add = newLines.filter(
      (t) => !lines.some((l) => l.text.toLowerCase() === t.toLowerCase())
    );
    if (add.length === 0) return;
    setObjectives([current, ...add].filter(Boolean).join("\n"));
    setShowError(false);
  }

  function submit() {
    if (lines.length === 0) {
      setShowError(true);
      return;
    }
    setGoing(true);
    const sep = baseHref.includes("?") ? "&" : "?";
    const qs = new URLSearchParams({
      disenar: "1",
      step: "2",
      dur: String(duration),
      obj: lines.map((l) => l.text).join("\n"),
      ...(placeId ? { lugar: placeId } : {}),
    });
    router.push(`${baseHref}${sep}${qs.toString()}`);
  }

  const label =
    "text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground";
  const chip = (active: boolean) =>
    cn(
      "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
      active
        ? "border-[#050505] bg-[#050505] text-white dark:border-[#D6FF38] dark:bg-[#D6FF38] dark:text-[#050505]"
        : "border-foreground/15 text-foreground hover:bg-muted"
    );

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Duración */}
      <section className="space-y-2">
        <h3 className={label}>1. {ANTES.durationQ}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={!custom && duration === d}
              onClick={() => {
                setCustom(false);
                setDuration(d);
              }}
              className={chip(!custom && duration === d)}
            >
              {d} {ANTES.minutes}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={custom}
            onClick={() => setCustom(true)}
            className={chip(custom)}
          >
            {ANTES.otherDuration}
          </button>
          {custom && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="number"
                min={10}
                max={240}
                step={5}
                value={duration}
                onChange={(e) =>
                  setDuration(
                    Math.max(10, Math.min(240, Number(e.target.value) || 60))
                  )
                }
                className="h-11 w-24 rounded-md border border-foreground/15 bg-background px-3 text-sm"
                aria-label={ANTES.durationQ}
              />
              {ANTES.minutes}
            </label>
          )}
        </div>
      </section>

      {/* 2. Objetivos */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={label}>2. {ANTES.objectivesQ}</h3>
          <ObjectivesPicker
            onAdd={addLines}
            currentText={objectives}
            defaultBall={defaultBall}
            infinitive
          />
        </div>
        <p className="text-xs text-muted-foreground">{ANTES.objectivesHint}</p>
        {pending.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {ANTES.suggested}
            </span>
            {pending.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addLines([s])}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-foreground/15 px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Plus className="size-3" />
                {s}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={objectives}
          onChange={(e) => {
            setObjectives(e.target.value);
            setShowError(false);
          }}
          rows={4}
          placeholder={ANTES.objectivesPlaceholder}
          aria-invalid={showError}
          className={cn(
            "w-full rounded-lg border bg-background px-4 py-3 text-sm text-foreground",
            showError ? "border-destructive" : "border-foreground/15"
          )}
        />
        {showError && (
          <p className="text-sm text-destructive">{ANTES.required}</p>
        )}
        {lines.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-muted/60 p-3">
            <p className="text-xs font-bold text-muted-foreground">
              {ANTES.understood}
            </p>
            {lines.map((l, i) => (
              <div key={`${i}-${l.text}`} className="text-sm">
                <span className="text-foreground">{l.text}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {l.recognized ? (
                    objectiveLabels(l).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[#D6FF38]/40 px-2 py-0.5 text-[11px] font-semibold text-foreground"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {ANTES.notUnderstood}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Lugar */}
      <section className="space-y-2">
        <h3 className={label}>
          3. {ANTES.placeQ}{" "}
          <span className="normal-case tracking-normal">{ANTES.optional}</span>
        </h3>
        <select
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          className="h-11 w-full max-w-sm rounded-lg border border-foreground/15 bg-background px-3 text-sm text-foreground"
          aria-label={ANTES.placeQ}
        >
          <option value="">{ANTES.noPlace}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </section>

      <button
        type="button"
        onClick={submit}
        disabled={going}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-bold text-[#050505] hover:bg-[#c8ef2f] disabled:opacity-60"
      >
        {going ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {ANTES.submit}
      </button>
    </div>
  );
}
