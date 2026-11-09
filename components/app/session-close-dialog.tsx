"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, PencilLine, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLAN_CHANGE_REASONS,
  type PlanChangeReason,
} from "@/lib/sessions/plan-change";

export type SessionCloseRating = {
  planFollowed: true;
  sessionRating: number;
  note: string | null;
};

export type SessionClosePlanChanged = {
  planFollowed: false;
  planChangeReason: PlanChangeReason | null;
};

type Step = "plan" | "reason" | "rating";

/**
 * Cierre de una sesión, igual en los tres caminos (paso a paso, "Sesión
 * completada" en el modo clase y "Sesión completada" en la ficha):
 *
 * 1. ¿Se ha completado tal y como estaba planificada?
 * 2a. Sí → valoración final (estrellas obligatorias, comentario opcional).
 * 2b. No → motivo opcional → `onPlanChanged` (quien lo usa guarda lo hecho y
 *     lleva a editar la sesión; la valoración se pide al volver).
 *
 * Con `initialStep="rating"` se abre directamente en la valoración (al volver
 * de editar la sesión).
 */
export function SessionCloseDialog({
  open,
  onClose,
  onRate,
  onPlanChanged,
  initialStep = "plan",
  summary,
  initialNote = "",
}: {
  open: boolean;
  onClose: () => void;
  /** Guarda la sesión como completada con su valoración. true = ok. */
  onRate: (data: SessionCloseRating | RatingAfterEdit) => Promise<boolean>;
  /** Guarda lo hecho y lleva a editar la sesión. true = ok. */
  onPlanChanged: (data: SessionClosePlanChanged) => Promise<boolean>;
  initialStep?: Step;
  /** Texto pequeño bajo la pregunta, p. ej. "5 de 6 elementos realizados". */
  summary?: string;
  initialNote?: string;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [reason, setReason] = useState<PlanChangeReason | null>(null);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    if (saving) return;
    setError(null);
    onClose();
  };

  async function run(action: () => Promise<boolean>) {
    setSaving(true);
    setError(null);
    const ok = await action().catch(() => false);
    if (!ok) {
      setSaving(false);
      setError("No se pudo guardar. Revisa la conexión e inténtalo de nuevo.");
    }
    // Si va bien, quien usa el diálogo navega o lo cierra.
    else setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-close-title"
        className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-[28px] border border-border bg-card p-6 text-foreground shadow-2xl"
      >
        {step === "plan" && (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <CheckCircle2 className="size-7" />
              </div>
              <h2
                id="session-close-title"
                className="mb-1 text-xl font-black leading-tight"
              >
                ¿Se ha completado la sesión tal y como estaba planificada?
              </h2>
              {summary && (
                <p className="text-sm text-muted-foreground">{summary}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep("reason")}
                className="rounded-full border border-border px-4 py-3 text-sm font-black transition-colors hover:bg-muted"
              >
                No, cambió
              </button>
              <button
                type="button"
                onClick={() => setStep("rating")}
                className="rounded-full bg-brand px-4 py-3 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95"
              >
                Sí, tal cual
              </button>
            </div>
            <button
              type="button"
              onClick={close}
              className="mt-4 w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Volver a la sesión
            </button>
          </>
        )}

        {step === "reason" && (
          <>
            <h2
              id="session-close-title"
              className="mb-1 text-xl font-black leading-tight"
            >
              ¿Por qué cambió?
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Opcional. Después podrás editar la sesión para que quede lo que se
              hizo de verdad.
            </p>
            <div className="mb-5 flex flex-wrap gap-2">
              {PLAN_CHANGE_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={reason === r.id}
                  onClick={() => setReason(reason === r.id ? null : r.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    reason === r.id
                      ? "border-brand bg-brand/15 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {error && (
              <p className="mb-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("plan")}
                disabled={saving}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-black text-muted-foreground transition-colors hover:bg-muted"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  run(() =>
                    onPlanChanged({
                      planFollowed: false,
                      planChangeReason: reason,
                    })
                  )
                }
                className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PencilLine className="size-4" />
                )}
                Editar la sesión
              </button>
            </div>
          </>
        )}

        {step === "rating" && (
          <>
            <h2
              id="session-close-title"
              className="mb-1 text-xl font-black leading-tight"
            >
              Valoración de la sesión
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              ¿Cómo ha ido la clase?
            </p>
            <div
              className="mb-4 flex justify-center gap-2"
              role="radiogroup"
              aria-label="Valoración de 1 a 5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} de 5`}
                  onClick={() => setRating(n)}
                  className={cn(
                    "rounded-full p-1.5 transition-transform active:scale-90",
                    rating >= n ? "text-amber-400" : "text-foreground/20"
                  )}
                >
                  <Star className="size-9 fill-current" />
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Comentario (opcional): buen ritmo, costó el saque…"
              className="mb-4 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
            {error && (
              <p className="mb-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  initialStep === "rating" ? close() : setStep("plan")
                }
                disabled={saving}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-black text-muted-foreground transition-colors hover:bg-muted"
              >
                {initialStep === "rating" ? "Luego" : "Atrás"}
              </button>
              <button
                type="button"
                disabled={saving || rating === 0}
                onClick={() =>
                  run(() =>
                    onRate(
                      initialStep === "rating"
                        ? {
                            afterEdit: true,
                            sessionRating: rating,
                            note: note.trim() || null,
                          }
                        : {
                            planFollowed: true,
                            sessionRating: rating,
                            note: note.trim() || null,
                          }
                    )
                  )
                }
                className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Guardar
              </button>
            </div>
            {rating === 0 && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Marca de 1 a 5 estrellas para guardar.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Valoración que se pide al volver de editar una sesión que cambió. */
export type RatingAfterEdit = {
  afterEdit: true;
  planFollowed?: undefined;
  sessionRating: number;
  note: string | null;
};
