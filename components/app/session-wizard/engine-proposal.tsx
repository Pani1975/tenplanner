"use client";

// "Que la diseñe Ten Planner" dentro del asistente de sesión: al pasar del
// Paso 1 (grupo, día, duración, objetivos…) al Paso 2, el motor (F1) rellena
// los ejercicios. En el Paso 2 se puede cambiar la propuesta entera o un
// ejercicio suelto; el resto es el asistente de siempre.

import { useRef, useState } from "react";
import { Info, Loader2, Shuffle, Sparkles } from "lucide-react";
import { MONTAR } from "@/lib/session-engine/messages";
import type { PlanItem } from "@/lib/session-engine/types";
import type { Proposal } from "@/lib/session-engine/today";
import type { AvailableExercise, WizardExercise, WizardState } from "./types";

export type EngineConfig = {
  groupId: string;
  /** Edición de una sesión con ejercicios: cuántos se sustituyen. */
  replacesCount?: number;
};

type EngineInfo = {
  key: string;
  variant: number;
  explanations: string[];
  /** exerciseId → hueco del motor (para "Cambiar"). */
  slotByExercise: Record<string, number>;
  input: Proposal["input"];
  trace: unknown;
};

function stepOneKey(state: WizardState): string {
  return [
    state.scheduledAt.slice(0, 10),
    state.durationMinutes,
    state.objective.trim(),
  ].join("|");
}

function minutesOf(ex: WizardExercise): number {
  return ex.overrideDuration ?? ex.durationMinutes;
}

export function useEngineProposal({
  engine,
  state,
  update,
  availableExercises,
}: {
  engine?: EngineConfig;
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  availableExercises: AvailableExercise[];
}) {
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [changingIdx, setChangingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triedRef = useRef<Record<number, string[]>>({});
  const byId = new Map(availableExercises.map((e) => [e.id, e]));

  function toWizard(it: PlanItem, minutes = it.minutes): WizardExercise {
    const ex = byId.get(it.exerciseId);
    return {
      exerciseId: it.exerciseId,
      kind: "exercise",
      name: it.name,
      category: ex?.category ?? "technique",
      durationMinutes: ex?.durationMinutes ?? it.minutes,
      overrideDuration: minutes,
      notes: "",
      phase: it.phase,
      intensity: null,
    };
  }

  async function call(body: Record<string, unknown>): Promise<Proposal | null> {
    if (!engine) return null;
    const res = await fetch("/api/sessions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: engine.groupId,
        date: state.scheduledAt.slice(0, 10),
        durationMinutes: state.durationMinutes,
        objectives: state.objective || null,
        attendeeIds: null,
        ...body,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    return ((await res.json()) as { data: Proposal }).data;
  }

  async function generate(variant: number, previousIds?: string[]) {
    setBusy(true);
    setError(null);
    try {
      const p = await call({ variant, previousIds });
      if (!p) return false;
      const slotByExercise: Record<string, number> = {};
      for (const it of p.plan.items)
        slotByExercise[it.exerciseId] = it.slotIndex;
      triedRef.current = {};
      setInfo({
        key: stepOneKey(state),
        variant,
        explanations: p.plan.explanations,
        slotByExercise,
        input: p.input,
        trace: { explanations: p.plan.explanations, slots: p.plan.trace },
      });
      // La duración la fija el calendario: no se recalcula con el plan.
      update({
        exercises: p.plan.items.map((it) => toWizard(it)),
        durationManual: true,
      });
      return true;
    } catch {
      setError("No se pudo preparar la propuesta. Inténtalo de nuevo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Al pasar al Paso 2: genera la propuesta la primera vez o si cambió el
   * día, la duración o los objetivos del Paso 1.
   */
  async function ensure(): Promise<boolean> {
    if (!engine) return true;
    if (info && info.key === stepOneKey(state)) return true;
    return generate(0);
  }

  /** "Cambiar la propuesta": otra propuesta entera. */
  function regenerate() {
    const previousIds = state.exercises
      .filter((e) => info && e.exerciseId in info.slotByExercise)
      .map((e) => e.exerciseId);
    void generate((info?.variant ?? 0) + 1, previousIds);
  }

  function canChange(ex: WizardExercise): boolean {
    return (
      !!info &&
      (ex.kind ?? "exercise") === "exercise" &&
      ex.exerciseId in info.slotByExercise
    );
  }

  /** "Cambiar": otro ejercicio adecuado para ese hueco; el resto se queda. */
  async function changeItem(flatIdx: number) {
    const current = state.exercises[flatIdx];
    if (!info || !current || !canChange(current)) return;
    const slotIndex = info.slotByExercise[current.exerciseId];
    const tried = (triedRef.current[slotIndex] ??= []);
    tried.push(current.exerciseId);
    const pinned = state.exercises
      .filter((e, i) => i !== flatIdx && e.exerciseId in info.slotByExercise)
      .map((e) => ({
        slotIndex: info.slotByExercise[e.exerciseId],
        exerciseId: e.exerciseId,
        minutes: minutesOf(e),
      }));
    setChangingIdx(flatIdx);
    setError(null);
    try {
      const p = await call({
        variant: info.variant,
        pinned,
        slotAdjust: { slotIndex, levelShift: 0, excludeIds: tried.slice(-50) },
      });
      const repl = p?.plan.items.find((it) => it.slotIndex === slotIndex);
      if (!repl) return;
      const next = [...state.exercises];
      next[flatIdx] = toWizard(repl, minutesOf(current));
      const slotByExercise = { ...info.slotByExercise };
      delete slotByExercise[current.exerciseId];
      slotByExercise[repl.exerciseId] = slotIndex;
      setInfo({ ...info, slotByExercise });
      update({ exercises: next });
    } catch {
      setError("No se pudo cambiar el ejercicio. Inténtalo de nuevo.");
    } finally {
      setChangingIdx(null);
    }
  }

  /** Para guardar: traza del motor (solo si hay propuesta). */
  function generation() {
    if (!info) return null;
    return { input: info.input as Record<string, unknown>, trace: info.trace };
  }

  return {
    info,
    busy,
    error,
    changingIdx,
    ensure,
    regenerate,
    canChange,
    changeItem,
    generation,
  };
}

export function EngineProposalBanner({
  explanations,
  busy,
  error,
  replacesCount,
  onRegenerate,
}: {
  explanations: string[];
  busy: boolean;
  error: string | null;
  replacesCount?: number;
  onRegenerate: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#D6FF38]/60 bg-[#D6FF38]/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/60">
            <Sparkles className="size-3.5 text-brand" />
            {MONTAR.kicker}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {explanations.map((t) => (
              <li key={t} className="flex gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {replacesCount ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {MONTAR.replacesNote(replacesCount)}
            </p>
          ) : null}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-foreground/15 bg-background px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Shuffle className="size-4" />
          )}
          {MONTAR.changeProposal}
        </button>
      </div>
    </section>
  );
}
