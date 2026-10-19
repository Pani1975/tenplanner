"use client";

import { useState } from "react";
import { ArrowLeft, Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestExercisePick, usePickParams } from "@/lib/exercise-pick-bridge";

/**
 * Se muestra solo cuando la ficha se abrió desde una sesión o clase que se
 * está creando (`?pick=...&para=sesion|clase`): añade el ejercicio
 * directamente a ese editor, sin salir de la ficha.
 */
export function AddToOpenEditorButton({ exerciseId }: { exerciseId: string }) {
  const pick = usePickParams();
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  if (!pick) return null;
  const { pickerId, kind } = pick;
  const target = kind === "clase" ? "la clase" : "la sesión";

  async function handleClick() {
    if (status === "sending") return;
    setStatus("sending");
    setMessage(null);
    const result = await requestExercisePick(pickerId, exerciseId);
    setStatus(result.ok ? "done" : "error");
    setMessage(result.message);
  }

  function continueEditing() {
    // En el móvil la ficha suele abrirse en la misma ventana: volver atrás
    // recupera el editor (la sesión se restaura desde el borrador).
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    // Ficha abierta en una pestaña nueva: se intenta cerrarla y, si el
    // navegador no deja, se vuelve al editor correspondiente.
    window.close();
    window.setTimeout(() => {
      window.location.href =
        kind === "clase" ? "/classes/new" : "/sessions/new";
    }, 200);
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:items-end">
      <button
        type="button"
        onClick={continueEditing}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand/40 bg-background px-5 py-2.5 text-sm font-semibold text-brand shadow-sm transition-colors hover:bg-brand/10 sm:w-auto"
      >
        <ArrowLeft className="size-4" />
        {kind === "clase"
          ? "Seguir editando la clase"
          : "Seguir editando la sesión"}
      </button>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "sending" || status === "done"}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors sm:w-auto",
          status === "done"
            ? "bg-emerald-600 text-white"
            : "bg-brand text-brand-foreground hover:bg-brand/90 disabled:opacity-70"
        )}
      >
        {status === "sending" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : status === "done" ? (
          <Check className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
        {status === "done"
          ? `Añadido a ${target}`
          : `Añadir a ${target} que estás creando`}
      </button>
      {message && (
        <p
          className={cn(
            "text-xs sm:text-right",
            status === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
