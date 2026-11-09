"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import {
  hideAllWorkspaceObjectives,
  restoreAllBaseWorkspaceObjectives,
} from "./actions";

type Pending = "hide" | "restore" | null;

/**
 * Acciones de golpe sobre los objetivos del club o del espacio particular:
 * quitarlos todos o volver a los de Ten Planner tal y como están ahora.
 */
export function BulkObjectivesActions({ inClub }: { inClub: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(kind: "hide" | "restore") {
    setMessage(null);
    startTransition(async () => {
      const res =
        kind === "hide"
          ? await hideAllWorkspaceObjectives()
          : await restoreAllBaseWorkspaceObjectives();
      setConfirm(null);
      if (!res.ok) {
        setMessage("No se pudo completar. Inténtalo de nuevo.");
        return;
      }
      setMessage(
        kind === "hide"
          ? "Objetivos quitados. Puedes restaurar los de Ten Planner cuando quieras."
          : "Objetivos de Ten Planner restaurados."
      );
      router.refresh();
    });
  }

  const who = inClub ? "los alumnos del club" : "tus alumnos particulares";

  return (
    <div className="space-y-2">
      {confirm ? (
        <div
          role="alertdialog"
          aria-labelledby="bulk-objectives-title"
          className={
            confirm === "hide"
              ? "rounded-2xl border border-destructive/40 bg-destructive/5 p-4"
              : "rounded-2xl border border-brand/40 bg-brand/10 p-4"
          }
        >
          <p
            id="bulk-objectives-title"
            className="text-sm font-black text-foreground"
          >
            {confirm === "hide"
              ? "¿Borrar todos los objetivos?"
              : "¿Restaurar todos los objetivos de Ten Planner?"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {confirm === "hide"
              ? `Se quitan todos: los de Ten Planner y los que habéis creado. ${who[0].toUpperCase()}${who.slice(1)} dejarán de verlos en su ficha. Los de Ten Planner se pueden restaurar después; los creados por vosotros, no.`
              : `Vuelven todos los objetivos vigentes de Ten Planner con su texto y orden originales. Se pierden los cambios que hayáis hecho sobre ellos (textos, orden, ocultos). Los objetivos creados por vosotros se mantienen.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              disabled={isPending}
              className="rounded-full border border-border px-4 py-2 text-xs font-black text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => run(confirm)}
              disabled={isPending}
              className={
                confirm === "hide"
                  ? "inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                  : "inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-black text-brand-foreground disabled:opacity-60"
              }
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {confirm === "hide" ? "Sí, borrar todos" : "Sí, restaurar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirm("restore")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-black uppercase text-foreground hover:bg-muted"
          >
            <RotateCcw className="size-3.5" />
            Restaurar objetivos de Ten Planner
          </button>
          <button
            type="button"
            onClick={() => setConfirm("hide")}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-card px-4 py-2 text-xs font-black uppercase text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
            Borrar todos los objetivos
          </button>
        </div>
      )}
      {message && (
        <p className="text-xs font-semibold text-muted-foreground">{message}</p>
      )}
    </div>
  );
}
