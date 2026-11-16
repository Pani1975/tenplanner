"use client";

import type { ReactNode } from "react";
import { ArrowRightLeft, Clock, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PHASE_LABELS,
  type LedBy,
  type TrainingPhase,
  type WizardExercise,
  type WizardState,
} from "./types";

const PHASES: TrainingPhase[] = ["activation", "main", "cooldown"];

const LED_BY_OPTIONS: Array<{ value: LedBy; label: string }> = [
  { value: "coach", label: "Con monitor" },
  { value: "auto", label: "Autónomo" },
];

/** Un elemento del plan tal como lo pinta el tablero (sesión o clase). */
export interface LaneItem {
  id: string;
  phase: TrainingPhase;
  label: string;
  /** Minutos del elemento; null = sin duración conocida (cuenta 0). */
  minutes: number | null;
  court: 1 | 2;
  ledBy: LedBy | null;
}

interface CourtsBoardViewProps {
  twoCourts: boolean;
  onSetTwoCourts: (value: boolean) => void;
  items: LaneItem[];
  onPatchItem: (id: string, patch: { court?: 1 | 2; ledBy?: LedBy | null }) => void;
  /** Contenido extra bajo la cabecera (p. ej. los lugares de cada pista). */
  extra?: ReactNode;
}

/**
 * Tablero de pistas. Con una sola pista es solo el interruptor «Usar dos
 * pistas». Con dos, cada bloque muestra dos carriles en paralelo: en uno se
 * hace un trabajo y en el otro otro (p. ej. cesta con el monitor y peloteo
 * autónomo). Cada elemento se pasa de una pista a otra y se marca si lo
 * dirige el monitor o es autónomo. Lo de cada pista ocurre a la vez, así que
 * un bloque dura lo que dure su pista más larga. Lo usan las sesiones y las
 * plantillas de clase.
 */
export function CourtsBoardView({
  twoCourts,
  onSetTwoCourts,
  items: allItems,
  onPatchItem,
  extra,
}: CourtsBoardViewProps) {
  if (!twoCourts) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-foreground/15 bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            ¿Usas dos pistas?
          </p>
          <p className="text-xs text-muted-foreground">
            En una pista un trabajo y en otra otro, a la vez.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSetTwoCourts(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <Columns2 className="size-4" />
          Usar dos pistas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-brand/30 bg-brand/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Columns2 className="size-4 text-brand" />
            Tablero de pistas
          </p>
          <p className="text-xs text-muted-foreground">
            Lo de cada pista pasa a la vez: cada bloque dura lo que dure su
            pista más larga.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSetTwoCourts(false)}
          className="rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Volver a una pista
        </button>
      </div>

      {extra}

      {PHASES.map((phase) => {
        const items = allItems.filter((it) => it.phase === phase);
        const lane = (court: 1 | 2) => items.filter((it) => it.court === court);
        const total = (court: 1 | 2) =>
          lane(court).reduce((sum, it) => sum + (it.minutes ?? 0), 0);
        const blockMax = Math.max(total(1), total(2));

        return (
          <div
            key={phase}
            className="rounded-lg border border-foreground/10 bg-card p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="font-heading text-sm text-foreground">
                {PHASE_LABELS[phase]}
              </span>
              {blockMax > 0 && (
                <span className="ml-auto flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                  <Clock className="size-3" />
                  {blockMax} min
                </span>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {([1, 2] as const).map((court) => {
                const entries = lane(court);
                const laneMinutes = total(court);
                const other = court === 1 ? 2 : 1;
                return (
                  <div
                    key={court}
                    className="rounded-md border border-foreground/10 bg-background/60 p-2"
                  >
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-foreground/70">
                        Pista {court}
                      </span>
                      <span className="text-muted-foreground">
                        {laneMinutes} min
                      </span>
                    </div>
                    {blockMax > 0 && (
                      <div className="mb-2 h-1 overflow-hidden rounded-full bg-foreground/10">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${Math.round((laneMinutes / blockMax) * 100)}%`,
                          }}
                        />
                      </div>
                    )}

                    {entries.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        Nada en esta pista
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {entries.map((it) => (
                          <li
                            key={it.id}
                            className="rounded-md border border-foreground/10 bg-card p-2"
                          >
                            <div className="flex items-start gap-2">
                              <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                                {it.label}
                              </span>
                              {it.minutes !== null && (
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {it.minutes} min
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <div
                                role="group"
                                aria-label="Quién lo dirige"
                                className="inline-flex overflow-hidden rounded-md border border-foreground/15 text-[11px] font-semibold"
                              >
                                {LED_BY_OPTIONS.map((opt) => {
                                  const active = it.ledBy === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      aria-pressed={active}
                                      onClick={() =>
                                        onPatchItem(it.id, {
                                          ledBy: active ? null : opt.value,
                                        })
                                      }
                                      className={cn(
                                        "px-2 py-1 transition-colors",
                                        active
                                          ? "bg-brand text-brand-foreground"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  onPatchItem(it.id, { court: other })
                                }
                                className="ml-auto inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                              >
                                <ArrowRightLeft className="size-3" />
                                Pasar a pista {other}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function itemLabel(ex: WizardExercise) {
  return (
    ex.title?.trim() ||
    ex.name?.trim() ||
    ex.freeText?.trim().slice(0, 40) ||
    "Actividad"
  );
}

interface CourtsBoardProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  /** Mis lugares: cada pista puede estar en un lugar distinto. */
  places?: { id: string; name: string }[];
}

/** Tablero de pistas del Paso 2 del asistente de sesiones. */
export function CourtsBoard({ state, update, places = [] }: CourtsBoardProps) {
  const items: LaneItem[] = state.exercises.map((ex, i) => ({
    id: String(i),
    phase: ex.phase ?? "main",
    label: itemLabel(ex),
    minutes: ex.overrideDuration ?? ex.durationMinutes,
    court: ex.court === 2 ? 2 : 1,
    ledBy: ex.ledBy ?? null,
  }));

  return (
    <CourtsBoardView
      twoCourts={state.courts === 2}
      onSetTwoCourts={(on) => update({ courts: on ? 2 : 1 })}
      items={items}
      onPatchItem={(id, patch) =>
        update({
          exercises: state.exercises.map((ex, i) =>
            String(i) === id ? { ...ex, ...patch } : ex
          ),
        })
      }
      extra={
        places.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { court: 1, key: "placeId", value: state.placeId },
                { court: 2, key: "secondPlaceId", value: state.secondPlaceId },
              ] as const
            ).map(({ court, key, value }) => (
              <label
                key={court}
                className="flex flex-col gap-1 text-xs font-semibold text-foreground/70"
              >
                Lugar de la pista {court}
                <select
                  value={value ?? ""}
                  onChange={(e) => update({ [key]: e.target.value || null })}
                  className="h-9 rounded-md border border-foreground/15 bg-background px-2 text-sm font-normal text-foreground"
                >
                  <option value="">Sin lugar asignado</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null
      }
    />
  );
}
