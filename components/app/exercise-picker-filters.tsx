"use client";

import { X } from "lucide-react";
import {
  ASPECTO_JUEGO_LABELS,
  FASES,
  NIVEL_IDS,
  NIVELES,
  nivelLabel,
} from "@/lib/exercise-taxonomy";
import { cn } from "@/lib/utils";

/** Campos de clasificación que usa el buscador de ejercicios. */
export interface PickerTaggedExercise {
  nivel?: string | null;
  niveles?: string[] | null;
  phase?: string | null;
  aspectoJuego?: string | null;
  aspectosJuego?: string[] | null;
  golpes?: string[] | null;
}

export interface PickerFilters {
  nivel: string;
  fase: string;
  aspecto: string;
  golpe: string;
}

export const EMPTY_PICKER_FILTERS: PickerFilters = {
  nivel: "",
  fase: "",
  aspecto: "",
  golpe: "",
};

const GOLPE_LABELS: Record<string, string> = {
  derecha: "Derecha",
  reves: "Revés",
  saque: "Saque",
  resto: "Resto",
  volea: "Volea",
  remate: "Remate",
  globo: "Globo",
  dejada: "Dejada",
};
const GOLPE_ORDER = Object.keys(GOLPE_LABELS);

/** "Descubrimiento (4-6 años)": nombre del nivel con su tramo de edad. */
function nivelOptionLabel(id: string): string {
  const edad = NIVELES.find((n) => n.id === id)?.edad;
  return edad ? `${nivelLabel(id)} (${edad})` : nivelLabel(id);
}

function nivelesOf(ex: PickerTaggedExercise): string[] {
  if (ex.niveles && ex.niveles.length > 0) return ex.niveles;
  return ex.nivel ? [ex.nivel] : [];
}

function aspectosOf(ex: PickerTaggedExercise): string[] {
  if (ex.aspectosJuego && ex.aspectosJuego.length > 0) return ex.aspectosJuego;
  return ex.aspectoJuego ? [ex.aspectoJuego] : [];
}

export function hasPickerFilters(filters: PickerFilters): boolean {
  return !!(filters.nivel || filters.fase || filters.aspecto || filters.golpe);
}

export function matchesPickerFilters(
  ex: PickerTaggedExercise,
  filters: PickerFilters
): boolean {
  if (filters.nivel && !nivelesOf(ex).includes(filters.nivel)) return false;
  if (filters.fase && ex.phase !== filters.fase) return false;
  if (filters.aspecto && !aspectosOf(ex).includes(filters.aspecto))
    return false;
  if (filters.golpe && !(ex.golpes ?? []).includes(filters.golpe))
    return false;
  return true;
}

/** Valores presentes en los ejercicios, ordenados según `order`. */
function presentValues(values: string[], order: readonly string[]): string[] {
  const unique = Array.from(new Set(values.filter(Boolean)));
  const rank = (v: string) => {
    const i = order.indexOf(v);
    return i === -1 ? order.length : i;
  };
  return unique.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-brand/40";

/**
 * Filtros de Nivel / Fase / Aspecto del juego / Golpe para el buscador de
 * ejercicios de clases y sesiones. Solo ofrece los valores que tienen los
 * ejercicios disponibles.
 */
export function ExercisePickerFilters({
  exercises,
  value,
  onChange,
  className,
}: {
  exercises: PickerTaggedExercise[];
  value: PickerFilters;
  onChange: (next: PickerFilters) => void;
  className?: string;
}) {
  const niveles = presentValues(
    exercises.flatMap(nivelesOf),
    NIVEL_IDS as readonly string[]
  );
  const fases = FASES.filter((f) => exercises.some((ex) => ex.phase === f.id));
  const aspectos = presentValues(
    exercises.flatMap(aspectosOf),
    Object.keys(ASPECTO_JUEGO_LABELS)
  );
  const golpes = presentValues(
    exercises.flatMap((ex) => ex.golpes ?? []),
    GOLPE_ORDER
  );
  const set = (patch: Partial<PickerFilters>) =>
    onChange({ ...value, ...patch });

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="grid grid-cols-2 gap-1.5">
        <select
          aria-label="Filtrar por nivel"
          value={value.nivel}
          onChange={(e) => set({ nivel: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Nivel: todos</option>
          {niveles.map((id) => (
            <option key={id} value={id}>
              {nivelOptionLabel(id)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por fase de la sesión"
          value={value.fase}
          onChange={(e) => set({ fase: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Fase: todas</option>
          {fases.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por aspecto del juego"
          value={value.aspecto}
          onChange={(e) => set({ aspecto: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Aspecto: todos</option>
          {aspectos.map((id) => (
            <option key={id} value={id}>
              {ASPECTO_JUEGO_LABELS[id as keyof typeof ASPECTO_JUEGO_LABELS] ??
                id}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por golpe"
          value={value.golpe}
          onChange={(e) => set({ golpe: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Golpe: todos</option>
          {golpes.map((id) => (
            <option key={id} value={id}>
              {GOLPE_LABELS[id] ?? id}
            </option>
          ))}
        </select>
      </div>
      {hasPickerFilters(value) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_PICKER_FILTERS)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
          Quitar filtros
        </button>
      )}
    </div>
  );
}
