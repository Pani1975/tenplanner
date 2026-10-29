"use client";

import { Minus, Plus } from "lucide-react";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { cn } from "@/lib/utils";
import type { WizardState } from "./types";
import { sessionCode } from "./recurrence";
import { hasPlanContent } from "./timeline";

interface StepBasicsProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Partial<Record<keyof WizardState, string>>;
}

export function StepBasics({
  state,
  update,
  errors,
  allowCodeTitle = true,
}: StepBasicsProps & { allowCodeTitle?: boolean }) {
  const codeFor = (scheduledAt: string, groupName: string) => {
    const d = new Date(scheduledAt);
    return isNaN(d.getTime()) ? "" : sessionCode(d, groupName);
  };

  function setCodeMode(on: boolean) {
    update(
      on
        ? {
            useCodeTitle: true,
            title: codeFor(state.scheduledAt, state.groupName ?? ""),
          }
        : { useCodeTitle: false }
    );
  }

  function setGroupName(groupName: string) {
    update(
      state.useCodeTitle
        ? { groupName, title: codeFor(state.scheduledAt, groupName) }
        : { groupName }
    );
  }

  function bumpDuration(delta: number) {
    const next = Math.max(5, Math.min(600, state.durationMinutes + delta));
    update({ durationMinutes: next, durationManual: true });
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <label
            htmlFor="title"
            className="block text-xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            Título
          </label>
          <span className="text-[10px] text-destructive font-semibold">
            Obligatorio
          </span>
        </div>
        <input
          id="title"
          type="text"
          placeholder="Ej: Entrenamiento de técnica ofensiva"
          autoComplete="off"
          value={state.title}
          onChange={(e) =>
            // Si se escribe a mano, deja de usarse el código automático.
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
                  Nombre automático: fecha + grupo
                </span>
                <span className="block text-xs text-muted-foreground">
                  Ej.: 260930_Galácticas. Si repites la sesión, cada una lleva
                  su fecha. Luego puedes cambiar el nombre de cualquiera.
                </span>
              </span>
            </label>
            {state.useCodeTitle && (
              <input
                type="text"
                value={state.groupName ?? ""}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nombre del grupo (ej.: Galácticas)"
                maxLength={60}
                className="mt-2.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            )}
          </div>
        )}
      </div>

      {/* Date + Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Fecha y hora{" "}
            <span className="text-[10px] text-destructive normal-case tracking-normal">
              Oblig.
            </span>
          </label>
          <DateTimePicker
            value={state.scheduledAt}
            onChange={(v) =>
              update(
                state.useCodeTitle
                  ? {
                      scheduledAt: v,
                      title: codeFor(v, state.groupName ?? ""),
                    }
                  : { scheduledAt: v }
              )
            }
            error={!!errors.scheduledAt}
          />
          {errors.scheduledAt && (
            <p className="text-xs text-destructive font-medium">
              {errors.scheduledAt}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Duración{" "}
            <span className="text-[10px] normal-case tracking-normal text-muted-foreground font-normal">
              min
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bumpDuration(-5)}
              className="size-11 shrink-0 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Disminuir duración"
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
              aria-label="Aumentar duración"
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
              Se recalcula sola a partir de los ejercicios y textos del plan.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
