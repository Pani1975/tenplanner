"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLAN_CHANGE_REASONS,
  type PlanChangeReason,
} from "@/lib/sessions/plan-change";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

export type SessionCloseRating = {
  planFollowed: boolean;
  planChangeReason: PlanChangeReason | null;
  /** Texto libre cuando el motivo es "Otro motivo". */
  planChangeNote: string | null;
  sessionRating: number;
  note: string | null;
};

/** @deprecated El cierre ya no lleva a editar; se mantiene el tipo. */
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
 * 2. Si no: motivo opcional (con texto si es "Otro motivo").
 * 3. Valoración final (estrellas obligatorias, comentario opcional) y se
 *    cierra la sesión. Para cambiar el plan se usa "Editar" en la ficha.
 *
 * Con `initialStep="rating"` se abre directamente en la valoración (al volver
 * de editar la sesión).
 */
export function SessionCloseDialog({
  open,
  onClose,
  onRate,
  initialStep = "plan",
  summary,
  initialNote = "",
}: {
  open: boolean;
  onClose: () => void;
  /** Guarda la sesión como completada con su valoración. true = ok. */
  onRate: (data: SessionCloseRating | RatingAfterEdit) => Promise<boolean>;
  initialStep?: Step;
  /** Texto pequeño bajo la pregunta, p. ej. "5 de 6 elementos realizados". */
  summary?: string;
  initialNote?: string;
}) {
  const term = useTerm();
  const tx = useTranslations("ui.s_app_sessionclosedialog");
  const [step, setStep] = useState<Step>(initialStep);
  const [reason, setReason] = useState<PlanChangeReason | null>(null);
  const [planFollowed, setPlanFollowed] = useState<boolean | null>(null);
  const [reasonNote, setReasonNote] = useState("");
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
      setError(tx("noSePudoGuardar"));
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
                {tx("seHaCompletadoLa")}
              </h2>
              {summary && (
                <p className="text-sm text-muted-foreground">{summary}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPlanFollowed(false);
                  setStep("reason");
                }}
                className="rounded-full border border-border px-4 py-3 text-sm font-black transition-colors hover:bg-muted"
              >
                {tx("noCambio")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlanFollowed(true);
                  setStep("rating");
                }}
                className="rounded-full bg-brand px-4 py-3 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95"
              >
                {tx("siTalCual")}
              </button>
            </div>
            <button
              type="button"
              onClick={close}
              className="mt-4 w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {tx("volverALaSesion")}
            </button>
          </>
        )}

        {step === "reason" && (
          <>
            <h2
              id="session-close-title"
              className="mb-1 text-xl font-black leading-tight"
            >
              {tx("porQueCambio")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {tx("opcionalDespuesPodrasEditar")}
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
                  {term(r.label)}
                </button>
              ))}
            </div>
            {reason === "otro" && (
              <textarea
                autoFocus
                rows={2}
                maxLength={300}
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder={tx("cuentaBrevementeQuePaso")}
                className="-mt-2 mb-5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            )}
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
                {tx("atras")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setStep("rating")}
                className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95 disabled:opacity-60"
              >
                {tx("siguiente")}
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
              {tx("valoracionDeLaSesion")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {tx("comoHaIdoLa")}
            </p>
            <div
              className="mb-4 flex justify-center gap-2"
              role="radiogroup"
              aria-label={tx("valoracionDe1A")}
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
              placeholder={tx("comentarioOpcionalBuenRitmo")}
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
                  initialStep === "rating"
                    ? close()
                    : setStep(planFollowed === false ? "reason" : "plan")
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
                            planFollowed: planFollowed !== false,
                            planChangeReason:
                              planFollowed === false ? reason : null,
                            planChangeNote:
                              planFollowed === false && reason === "otro"
                                ? reasonNote.trim() || null
                                : null,
                            sessionRating: rating,
                            note: note.trim() || null,
                          }
                    )
                  )
                }
                className="inline-flex flex-[1.6] items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {tx("guardar")}
              </button>
            </div>
            {rating === 0 && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {tx("marcaDe1A")}
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
