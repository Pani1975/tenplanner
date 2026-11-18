"use client";

import { useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { cn } from "@/lib/utils";
import type { WizardState } from "./types";
import { sessionCode } from "./recurrence";
import { fetchSgNumbers } from "./sg-number";
import { hasPlanContent } from "./timeline";
import { useTranslations } from "next-intl";

interface StepBasicsProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Partial<Record<keyof WizardState, string>>;
  /** Id de la sesión que se edita (para no contarla al numerar SG). */
  sessionId?: string | null;
}

export function StepBasics({
  state,
  update,
  errors,
  allowCodeTitle = true,
  sessionId = null,
}: StepBasicsProps & { allowCodeTitle?: boolean }) {
  const tx = useTranslations("ui.s_sessionwizard_stepbasics");
  // El nombre automático se recalcula solo al cambiar el grupo o el día:
  // AAMMDD_Grupo, o AAMMDD_SG (SG2, SG3… si ese día ya hay clases sueltas).
  const day = state.scheduledAt.slice(0, 10);
  const group = (state.groupName ?? "").trim();
  useEffect(() => {
    if (!allowCodeTitle || !state.useCodeTitle) return;
    const date = new Date(state.scheduledAt);
    if (isNaN(date.getTime())) return;
    if (group) {
      const next = sessionCode(date, group);
      if (next !== state.title) update({ title: next });
      return;
    }
    let cancelled = false;
    void fetchSgNumbers([date], sessionId).then(([n]) => {
      if (cancelled) return;
      const next = sessionCode(date, "", n);
      if (next !== state.title) update({ title: next });
    });
    return () => {
      cancelled = true;
    };
    // Solo depende de lo que cambia el nombre; `title`/`update` no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowCodeTitle, state.useCodeTitle, group, state.scheduledAt, day]);

  function setCodeMode(on: boolean) {
    // Al activarlo, el efecto de arriba calcula el nombre.
    update({ useCodeTitle: on });
  }

  function bumpDuration(delta: number) {
    const next = Math.max(5, Math.min(600, state.durationMinutes + delta));
    update({ durationMinutes: next, durationManual: true });
  }

  return (
    <div className="space-y-6">
      {/* Fecha y hora: va antes del nombre, que sale de ella y del grupo */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {tx("fechaYHora")}{" "}
          <span className="text-[10px] text-destructive normal-case tracking-normal">
            {tx("oblig")}
          </span>
        </label>
        <DateTimePicker
          value={state.scheduledAt}
          onChange={(v) => update({ scheduledAt: v })}
          error={!!errors.scheduledAt}
        />
        {errors.scheduledAt && (
          <p className="text-xs text-destructive font-medium">
            {errors.scheduledAt}
          </p>
        )}
      </div>

      {/* Nombre */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <label
            htmlFor="title"
            className="block text-xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            {tx("nombreDeLaSesion")}
          </label>
          <span className="text-[10px] text-destructive font-semibold">
            {tx("obligatorio")}
          </span>
        </div>
        <input
          id="title"
          type="text"
          placeholder={tx("ejEntrenamientoDeTecnica")}
          autoComplete="off"
          value={state.title}
          onChange={(e) =>
            // Si se escribe a mano, deja de usarse el nombre automático.
            update({ title: e.target.value, useCodeTitle: false })
          }
          aria-invalid={!!errors.title}
          className={cn(
            "w-full h-12 px-4 text-base bg-background border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-all text-foreground placeholder:text-muted-foreground/50 font-medium",
            errors.title
              ? "border-destructive ring-2 ring-destructive/20"
              : "border-border"
          )}
        />
        {errors.title && (
          <p className="text-xs text-destructive font-medium">{errors.title}</p>
        )}

        {allowCodeTitle && (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={!!state.useCodeTitle}
                onChange={(e) => setCodeMode(e.target.checked)}
                className="mt-0.5 size-4 accent-[#D6FF38]"
              />
              <span className="text-sm">
                <span className="font-semibold text-foreground">
                  {tx("nombreAutomaticoDiaGrupo")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {tx("anoMesYDia")}
                </span>
              </span>
            </label>
            {state.useCodeTitle && (
              <input
                type="text"
                value={state.groupName ?? ""}
                onChange={(e) => update({ groupName: e.target.value })}
                placeholder={tx("grupoVacioSinGrupo")}
                maxLength={60}
                className="mt-2.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            )}
          </div>
        )}
      </div>

      {/* Duración */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {tx("duracion")}{" "}
          <span className="text-[10px] normal-case tracking-normal text-muted-foreground font-normal">
            {tx("min")}
          </span>
        </label>
        <div className="flex max-w-sm items-center gap-2">
          <button
            type="button"
            onClick={() => bumpDuration(-5)}
            className="size-11 shrink-0 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={tx("disminuirDuracion")}
          >
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            min={5}
            max={600}
            value={state.durationMinutes}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v))
                update({ durationMinutes: v, durationManual: true });
            }}
            className="w-full h-11 text-center text-base font-bold bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground"
          />
          <button
            type="button"
            onClick={() => bumpDuration(5)}
            className="size-11 shrink-0 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={tx("aumentarDuracion")}
          >
            <Plus className="size-4" />
          </button>
        </div>
        {errors.durationMinutes && (
          <p className="text-xs text-destructive font-medium">
            {errors.durationMinutes}
          </p>
        )}
        {hasPlanContent(state) && (
          <p className="text-[11px] text-muted-foreground">
            {tx("seRecalculaSolaA")}
          </p>
        )}
      </div>
    </div>
  );
}
