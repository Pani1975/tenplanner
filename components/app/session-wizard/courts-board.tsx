"use client";

import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Clock,
  Columns2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  blockStudentMinutes,
  type LaneTimeItem,
} from "@/lib/sessions/lane-time";
import {
  createTextItem,
  createWarmupItem,
  isStationsItem,
  isTextItem,
  isWarmupItem,
} from "./timeline";
import {
  PHASE_LABELS,
  type LedBy,
  type TrainingPhase,
  type WizardExercise,
  type WizardState,
} from "./types";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

const PHASES: TrainingPhase[] = ["activation", "main", "cooldown"];

const LED_BY_OPTIONS: Array<{ value: LedBy; label: string }> = [
  { value: "coach", label: "Con monitor" },
  { value: "auto", label: "Autónomo" },
];

export type LaneItemKind = "exercise" | "text" | "warmup" | "stations";

/** Un elemento del plan tal como lo pinta el tablero (sesión o clase). */
export interface LaneItem {
  id: string;
  phase: TrainingPhase;
  label: string;
  /** Minutos del elemento; null = sin duración conocida (cuenta 0). */
  minutes: number | null;
  court: 1 | 2;
  ledBy: LedBy | null;
  kind?: LaneItemKind;
  /** Textos libres: título y texto (editables en la pista). */
  title?: string;
  text?: string;
  /** Por turnos: minutos de cada alumno y de cuántos en cuántos pasan. */
  turnMinutes?: number | null;
  turnSize?: number | null;
}

export type LanePatch = {
  court?: 1 | 2;
  ledBy?: LedBy | null;
  turnMinutes?: number | null;
  turnSize?: number | null;
};

/** Acciones para montar el contenido directamente en cada pista. */
export interface LaneEditor {
  onAdd: (
    phase: TrainingPhase,
    court: 1 | 2,
    kind: "exercise" | "text" | "warmup"
  ) => void;
  onRemove: (id: string) => void;
  onMinutes: (id: string, minutes: number) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onText: (id: string, patch: { title?: string; text?: string }) => void;
  /** Sustituir por otro ejercicio sin tener que quitar y volver a añadir. */
  onReplace?: (id: string) => void;
}

interface CourtsBoardViewProps {
  twoCourts: boolean;
  onSetTwoCourts: (value: boolean) => void;
  items: LaneItem[];
  onPatchItem: (id: string, patch: LanePatch) => void;
  /** Bloques con rotación (dos grupos que cambian de pista a mitad). */
  rotates?: Partial<Record<TrainingPhase, boolean>>;
  onToggleRotate?: (phase: TrainingPhase, on: boolean) => void;
  /** Con editor, el contenido se monta aquí, debajo de cada pista. */
  editor?: LaneEditor;
  /** Alumnos de la sesión (para comprobar los turnos). */
  studentCount?: number;
  /** Contenido bajo las pistas de un bloque (p. ej. el buscador de ejercicios). */
  phasePanel?: (phase: TrainingPhase) => ReactNode;
  /** Contenido extra bajo la cabecera (p. ej. los lugares de cada pista). */
  extra?: ReactNode;
}

const inputCls =
  "h-8 rounded-md border border-foreground/15 bg-background px-2 text-sm text-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30";

/**
 * Tablero de pistas. Con una sola pista es solo el interruptor «Usar dos
 * pistas». Con dos, cada bloque muestra dos carriles en paralelo: en uno se
 * hace un trabajo y en el otro otro (p. ej. cesta con el monitor y peloteo
 * autónomo). En cada pista puede haber varios ejercicios. Un elemento puede
 * hacerse por turnos (cada alumno X min): el tablero calcula cuántos minutos
 * hace cada alumno de cada cosa. Lo de cada pista ocurre a la vez, así que un
 * bloque dura lo que dure su pista más larga. Lo usan las sesiones y las
 * plantillas de clase.
 */
export function CourtsBoardView({
  twoCourts,
  onSetTwoCourts,
  items: allItems,
  onPatchItem,
  rotates = {},
  onToggleRotate,
  editor,
  studentCount = 0,
  phasePanel,
  extra,
}: CourtsBoardViewProps) {
  const term = useTerm();
  const tx = useTranslations("ui.s_sessionwizard_courtsboard");
  if (!twoCourts) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-foreground/15 bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {tx("usasDosPistas")}
          </p>
          <p className="text-xs text-muted-foreground">
            {tx("enUnaPistaUn")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSetTwoCourts(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <Columns2 className="size-4" />
          {tx("usarDosPistas")}
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
            {tx("tableroDePistas")}
          </p>
          <p className="text-xs text-muted-foreground">
            {tx("montaCadaPistaPor")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSetTwoCourts(false)}
          className="rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {tx("volverAUnaPista")}
        </button>
      </div>

      {extra}

      {PHASES.map((phase) => {
        const items = allItems.filter((it) => it.phase === phase);
        const lane = (court: 1 | 2) => items.filter((it) => it.court === court);
        const total = (court: 1 | 2) =>
          lane(court).reduce((sum, it) => sum + (it.minutes ?? 0), 0);
        const laneMax = Math.max(total(1), total(2));
        const rotating = !!rotates[phase];
        // Con rotación los minutos son por grupo: el bloque dura el doble.
        const blockMax = rotating ? laneMax * 2 : laneMax;
        const timeItems: LaneTimeItem[] = items.map((it) => ({
          label: it.label,
          court: it.court,
          minutes: it.minutes ?? 0,
          turnMinutes: it.turnMinutes,
          turnSize: it.turnSize,
        }));
        const perStudent = blockStudentMinutes(timeItems, studentCount);

        return (
          <div
            key={phase}
            className="rounded-lg border border-foreground/10 bg-card p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="font-heading text-sm text-foreground">
                {term(PHASE_LABELS[phase])}
              </span>
              {blockMax > 0 && (
                <span className="ml-auto flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                  <Clock className="size-3" />
                  {blockMax}{" "}{tx("min")}
                </span>
              )}
            </div>

            {onToggleRotate && laneMax > 0 && (
              <div className="mb-2 rounded-md border border-foreground/10 bg-background/60 px-3 py-2">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rotating}
                    onChange={(e) => onToggleRotate(phase, e.target.checked)}
                    className="mt-0.5 size-4 accent-[#D6FF38]"
                  />
                  <span>
                    <span className="font-semibold text-foreground">
                      {tx("losGruposRotan")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {tx("dosGruposCadaUno")}
                    </span>
                  </span>
                </label>
                {rotating && (
                  <ol className="mt-2 space-y-1 text-xs text-foreground">
                    <li>
                      <span className="font-bold">
                        {tx("ronda10V1", { v1: laneMax })}</span>{" "}
                      {tx("round1Desc")}
                    </li>
                    <li>
                      <span className="font-bold">
                        {tx("ronda2V1V2", { v1: laneMax, v2: laneMax * 2 })}</span>{" "}
                      {tx("round2Desc")}
                    </li>
                  </ol>
                )}
              </div>
            )}

            <div className="grid gap-2 xl:grid-cols-2">
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
                        {tx("pistaV1", { v1: court })}
                      </span>
                      <span className="text-muted-foreground">
                        {tx("v1MinV2", { v1: laneMinutes, v2: rotating ? tx("perGroupSuffix") : "" })}
                      </span>
                    </div>
                    {laneMax > 0 && (
                      <div className="mb-2 h-1 overflow-hidden rounded-full bg-foreground/10">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${Math.round((laneMinutes / (laneMax || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    )}

                    {entries.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        {tx("nadaEnEstaPista")}
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {entries.map((it, pos) => {
                          const turn = (it.turnMinutes ?? 0) > 0;
                          return (
                            <li
                              key={it.id}
                              className="rounded-md border border-foreground/10 bg-card p-2"
                            >
                              <div className="flex items-start gap-2">
                                {editor && it.kind === "text" ? (
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <input
                                      type="text"
                                      value={it.title ?? ""}
                                      onChange={(e) =>
                                        editor.onText(it.id, {
                                          title: e.target.value,
                                        })
                                      }
                                      placeholder={tx("tituloEjCestaDe")}
                                      maxLength={120}
                                      className={cn(inputCls, "w-full")}
                                    />
                                    <input
                                      type="text"
                                      value={it.text ?? ""}
                                      onChange={(e) =>
                                        editor.onText(it.id, {
                                          text: e.target.value,
                                        })
                                      }
                                      placeholder={tx("textoOpcional")}
                                      className={cn(inputCls, "w-full")}
                                    />
                                  </div>
                                ) : (
                                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                                    {term(it.label)}
                                  </span>
                                )}
                                {editor ? (
                                  <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                                    <input
                                      type="number"
                                      min={1}
                                      max={300}
                                      value={it.minutes ?? ""}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value, 10);
                                        if (!isNaN(v) && v > 0)
                                          editor.onMinutes(it.id, v);
                                      }}
                                      aria-label={tx("minutos")}
                                      className={cn(inputCls, "w-16 text-center")}
                                    />
                                    {tx("min")}
                                  </label>
                                ) : (
                                  it.minutes !== null && (
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {tx("v1Min", { v1: it.minutes })}</span>
                                  )
                                )}
                                {editor && (
                                  <div className="flex shrink-0 items-center">
                                    {editor.onReplace && (
                                      <button
                                        type="button"
                                        onClick={() => editor.onReplace?.(it.id)}
                                        title={tx("sustituirPorOtroEjercicio")}
                                        className="mr-1 inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                                      >
                                        <RefreshCw className="size-3" />
                                        {tx("sustituir")}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => editor.onMove(it.id, -1)}
                                      disabled={pos === 0}
                                      aria-label={tx("subir")}
                                      className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    >
                                      <ArrowUp className="size-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => editor.onMove(it.id, 1)}
                                      disabled={pos === entries.length - 1}
                                      aria-label={tx("bajar")}
                                      className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                    >
                                      <ArrowDown className="size-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => editor.onRemove(it.id)}
                                      aria-label={tx("quitarDeLaSesion")}
                                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <div
                                  role="group"
                                  aria-label={tx("quienLoDirige")}
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
                                        {term(opt.label)}
                                      </button>
                                    );
                                  })}
                                </div>
                                <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={turn}
                                    onChange={(e) =>
                                      onPatchItem(
                                        it.id,
                                        e.target.checked
                                          ? { turnMinutes: 5, turnSize: 1 }
                                          : { turnMinutes: null, turnSize: null }
                                      )
                                    }
                                    className="size-3.5 accent-[#D6FF38]"
                                  />
                                  {tx("porTurnos")}
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onPatchItem(it.id, { court: other })
                                  }
                                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                                >
                                  <ArrowRightLeft className="size-3" />
                                  {tx("pasarAPista")}{" "}{other}
                                </button>
                              </div>
                              {turn && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                  {tx("cadaAlumno")}
                                  <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={it.turnMinutes ?? 1}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value, 10);
                                      if (!isNaN(v) && v > 0)
                                        onPatchItem(it.id, { turnMinutes: v });
                                    }}
                                    aria-label={tx("minutosPorAlumno")}
                                    className={cn(inputCls, "w-14 text-center")}
                                  />
                                  {tx("min2")}
                                  <input
                                    type="number"
                                    min={1}
                                    max={8}
                                    value={it.turnSize ?? 1}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value, 10);
                                      if (!isNaN(v) && v > 0)
                                        onPatchItem(it.id, { turnSize: v });
                                    }}
                                    aria-label={tx("alumnosPorTurno")}
                                    className={cn(inputCls, "w-14 text-center")}
                                  />
                                  {tx("studentsAtOnce")}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {editor && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(
                          [
                            { kind: "exercise", label: tx("anadirEjercicio") },
                            { kind: "text", label: tx("textoLibre") },
                            { kind: "warmup", label: tx("descanso") },
                          ] as const
                        ).map(({ kind, label }) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => editor.onAdd(phase, court, kind)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:border-brand/50 hover:bg-brand/10"
                          >
                            <Plus className="size-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!rotating &&
              lane(1).length > 0 &&
              lane(2).length > 0 &&
              total(1) !== total(2) && (
                <p className="mt-2 text-xs text-amber-600">
                  {tx("lasPistasDuranDistinto", { v1: total(1), v2: total(2), v3: laneMax })}</p>
              )}

            {phasePanel?.(phase)}

            {perStudent.perStudent.length > 0 && (
              <div className="mt-2 rounded-md border border-brand/30 bg-brand/5 px-3 py-2 text-xs text-foreground">
                <p className="font-bold">
                  {tx("porAlumnoBloqueDe", { v1: perStudent.blockMinutes })}</p>
                <ul className="mt-1 space-y-0.5">
                  {perStudent.perStudent.map((p, i) => (
                    <li key={`${p.label}-${i}`}>
                      {term(p.label)}: <strong>{tx("v1Min", { v1: p.minutes })}</strong>
                      {p.kind === "turno" ? tx("enSuTurno") : ""}
                    </li>
                  ))}
                </ul>
                {studentCount > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    {tx("calculadoParaV1Alumnos", { v1: studentCount })}</p>
                )}
                {perStudent.warnings.map((w) => (
                  <p key={w} className="mt-1 font-medium text-amber-600">
                    {w}
                  </p>
                ))}
              </div>
            )}
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
    (isWarmupItem(ex) ? "Descanso" : "Actividad")
  );
}

function kindOf(ex: WizardExercise): LaneItemKind {
  if (isWarmupItem(ex)) return "warmup";
  if (isStationsItem(ex)) return "stations";
  if (isTextItem(ex)) return "text";
  return "exercise";
}

interface CourtsBoardProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  /** Mis lugares: cada pista puede estar en un lugar distinto. */
  places?: { id: string; name: string }[];
  /** Abre el buscador de ejercicios para añadir uno a una pista. */
  onPickExercise?: (phase: TrainingPhase, court: 1 | 2) => void;
  /** Sustituye un elemento por otro ejercicio (por su posición). */
  onReplace?: (index: number) => void;
  /** Buscador de ejercicios bajo las pistas del bloque que lo tiene abierto. */
  phasePanel?: (phase: TrainingPhase) => ReactNode;
}

/** Tablero de pistas del Paso 2 del asistente de sesiones. */
export function CourtsBoard({
  state,
  update,
  places = [],
  onPickExercise,
  onReplace,
  phasePanel,
}: CourtsBoardProps) {
  const tx = useTranslations("ui.s_sessionwizard_courtsboard");
  const exercises = state.exercises;
  const items: LaneItem[] = exercises.map((ex, i) => ({
    id: String(i),
    phase: ex.phase ?? "main",
    label: itemLabel(ex),
    minutes: ex.overrideDuration ?? ex.durationMinutes,
    court: ex.court === 2 ? 2 : 1,
    ledBy: ex.ledBy ?? null,
    kind: kindOf(ex),
    title: ex.title ?? "",
    text: ex.freeText ?? "",
    turnMinutes: ex.turnMinutes ?? null,
    turnSize: ex.turnSize ?? null,
  }));

  const setAt = (id: string, patch: Partial<WizardExercise>) =>
    update({
      exercises: exercises.map((ex, i) =>
        String(i) === id ? { ...ex, ...patch } : ex
      ),
    });

  const editor: LaneEditor = {
    onAdd: (phase, court, kind) => {
      if (kind === "exercise") {
        onPickExercise?.(phase, court);
        return;
      }
      const base =
        kind === "text" ? createTextItem("", phase) : createWarmupItem(phase);
      update({
        exercises: [...exercises, { ...base, court, ledBy: null }],
      });
    },
    onRemove: (id) =>
      update({ exercises: exercises.filter((_, i) => String(i) !== id) }),
    onMinutes: (id, minutes) => setAt(id, { overrideDuration: minutes }),
    onMove: (id, direction) => {
      const idx = Number(id);
      const me = exercises[idx];
      if (!me) return;
      // Intercambia con el vecino de la misma pista y bloque.
      const same = (ex: WizardExercise) =>
        (ex.phase ?? "main") === (me.phase ?? "main") &&
        (ex.court === 2 ? 2 : 1) === (me.court === 2 ? 2 : 1);
      let j = idx + direction;
      while (j >= 0 && j < exercises.length && !same(exercises[j])) j += direction;
      if (j < 0 || j >= exercises.length) return;
      const next = [...exercises];
      [next[idx], next[j]] = [next[j], next[idx]];
      update({ exercises: next });
    },
    onReplace: onReplace ? (id) => onReplace(Number(id)) : undefined,
    onText: (id, patch) =>
      setAt(id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.text !== undefined ? { freeText: patch.text } : {}),
      }),
  };

  return (
    <CourtsBoardView
      rotates={Object.fromEntries(
        state.blocks.map((b) => [
          b.orderIndex === 1 ? "activation" : b.orderIndex === 3 ? "cooldown" : "main",
          !!b.rotates,
        ])
      )}
      onToggleRotate={(phase, on) => {
        const order = phase === "activation" ? 1 : phase === "cooldown" ? 3 : 2;
        update({
          blocks: state.blocks.map((b) =>
            b.orderIndex === order ? { ...b, rotates: on } : b
          ),
        });
      }}
      twoCourts={state.courts === 2}
      onSetTwoCourts={(on) => update({ courts: on ? 2 : 1 })}
      items={items}
      editor={editor}
      phasePanel={phasePanel}
      studentCount={state.studentIds.length}
      onPatchItem={(id, patch) => setAt(id, patch)}
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
                {tx("lugarDeLaPista")}{" "}{court}
                <select
                  value={value ?? ""}
                  onChange={(e) => update({ [key]: e.target.value || null })}
                  className="h-9 rounded-md border border-foreground/15 bg-background px-2 text-sm font-normal text-foreground"
                >
                  <option value="">{tx("sinLugarAsignado")}</option>
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
