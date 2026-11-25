"use client";

import { cn } from "@/lib/utils";
import {
  isStationsItem,
  isTextItem,
  isWarmupItem,
  phaseToBlockOrder,
} from "./timeline";
import type { WizardExercise, WizardState } from "./types";

// Mismos colores que la barrita de cada tarjeta (CATEGORY_BAR en step-exercises).
const SEGMENT_COLOR: Record<string, string> = {
  text: "bg-foreground/30",
  technique: "bg-blue-400",
  tactics: "bg-purple-400",
  fitness: "bg-amber-400",
  "warm-up": "bg-brand",
  warmup: "bg-sky-400",
  stations: "bg-emerald-400",
};

const BLOCK_LABELS = ["Inicial", "Principal", "Final"] as const;

function minutesOf(e: WizardExercise) {
  return e.overrideDuration ?? e.durationMinutes;
}

function colorOf(e: WizardExercise) {
  if (isWarmupItem(e)) return SEGMENT_COLOR.warmup;
  if (isStationsItem(e)) return SEGMENT_COLOR.stations;
  if (isTextItem(e)) return SEGMENT_COLOR.text;
  return SEGMENT_COLOR[e.category] ?? "bg-muted-foreground/40";
}

function labelOf(e: WizardExercise) {
  if (isWarmupItem(e)) return "Descanso";
  if (isStationsItem(e)) return "Estaciones";
  return e.title?.trim() || e.name?.trim() || "Actividad";
}

/**
 * Forma de la sesión de un vistazo: una barra con los tres bloques y, dentro,
 * cada ejercicio con su color y un ancho proporcional a sus minutos. Avisa si
 * el plan no cuadra con la duración prevista. Con dos pistas solo se dibuja la
 * pista 1 (la que dirige el monitor), que es la que marca el ritmo.
 */
export function SessionTimelineBar({
  state,
  totalMinutes,
}: {
  state: Pick<WizardState, "exercises" | "courts" | "durationMinutes"> & {
    durationManual?: boolean;
  };
  totalMinutes: number;
}) {
  const items = state.exercises.filter(
    (e) => minutesOf(e) > 0 && (state.courts !== 2 || e.court !== 2)
  );
  if (items.length === 0) return null;

  const blocks = [1, 2, 3].map((order) =>
    items.filter((e) => phaseToBlockOrder(e.phase) === order)
  );
  const drawn = items.reduce((n, e) => n + minutesOf(e), 0);
  const planned = state.durationMinutes;
  const scale = Math.max(drawn, planned || 0, 1);
  const diff = planned > 0 ? totalMinutes - planned : 0;

  return (
    <div className="mt-2 w-full">
      <div className="flex h-7 w-full overflow-hidden rounded-md bg-muted/50">
        {blocks.map((blockItems, b) =>
          blockItems.length === 0 ? null : (
            <div
              key={b}
              className="flex h-full border-r-2 border-background last:border-r-0"
              style={{
                width: `${(blockItems.reduce((n, e) => n + minutesOf(e), 0) / scale) * 100}%`,
              }}
            >
              {blockItems.map((e, i) => (
                <div
                  key={`${e.exerciseId}-${i}`}
                  title={`${BLOCK_LABELS[b]} · ${labelOf(e)} · ${minutesOf(e)} min`}
                  className={cn(
                    "h-full min-w-[3px] border-r border-background/60 last:border-r-0",
                    colorOf(e)
                  )}
                  style={{ flexGrow: minutesOf(e), flexBasis: 0 }}
                />
              ))}
            </div>
          )
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex flex-wrap gap-x-3">
          {blocks.map((blockItems, b) =>
            blockItems.length === 0 ? null : (
              <span key={b}>
                {BLOCK_LABELS[b]}{" "}
                <strong className="font-semibold text-foreground">
                  {blockItems.reduce((n, e) => n + minutesOf(e), 0)} min
                </strong>
              </span>
            )
          )}
        </span>
        {diff !== 0 && (
          <span
            className={cn(
              "font-semibold",
              diff > 0 ? "text-amber-500" : "text-sky-500"
            )}
          >
            {diff > 0
              ? `Te pasas ${diff} min de los ${planned} previstos`
              : `Faltan ${-diff} min para los ${planned} previstos`}
          </span>
        )}
      </div>
    </div>
  );
}
