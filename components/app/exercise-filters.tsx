"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import {
  ASPECTO_JUEGO_LABELS,
  AUTORIAS,
  CARACTER,
  FASES,
  NUEVOS_TIPOS_ACTIVIDAD,
  PELOTAS,
  PELOTAS_LEGACY,
  showsTipoPelota,
  SITUACION_JUEGO,
  TIPO_COMPETICION,
  tipoEjercicioOptionLabel,
} from "@/lib/exercise-taxonomy";
import { cn } from "@/lib/utils";

const FORMATOS = [
  { id: "individual", label: "Individual" },
  { id: "parejas", label: "Parejas" },
  { id: "grupal", label: "Grupal" },
  { id: "multigrupo", label: "Multigrupo" },
] as const;

const ASPECTOS = [
  { id: "tecnica", label: "Técnica" },
  { id: "tactica", label: "Táctica" },
  { id: "mental", label: ASPECTO_JUEGO_LABELS.mental },
  { id: "fisico", label: ASPECTO_JUEGO_LABELS.fisico },
] as const;

const PARAMETROS = [
  { id: "altura", label: "Altura" },
  { id: "profundidad", label: "Profundidad" },
  { id: "velocidad", label: "Velocidad" },
  { id: "direccion", label: "Dirección" },
  { id: "efecto", label: "Efecto" },
] as const;

const DURACION_RANGOS = [
  { id: "1-5", label: "1-5 min" },
  { id: "5-10", label: "5-10 min" },
  { id: "10-15", label: "10-15 min" },
  { id: "15-20", label: "15-20 min" },
  { id: "+20", label: "+20 min" },
] as const;

// Incluye los tipos antiguos (marcados "antiguo") para poder encontrar los
// ejercicios que aún no se han re-etiquetado.
const TIPOS_ACTIVIDAD = NUEVOS_TIPOS_ACTIVIDAD.map((id) => ({
  id,
  label: tipoEjercicioOptionLabel(id),
}));

// Incluye las pelotas antiguas (marcadas) para encontrar los ejercicios
// que aún no se han re-etiquetado.
const TIPOS_PELOTA: { id: string; label: string; color?: string }[] = [
  ...PELOTAS,
  ...PELOTAS_LEGACY.map((p) => ({ id: p.id, label: `${p.label} (antigua)` })),
];

const GOLPES = [
  { id: "derecha", label: "Derecha" },
  { id: "reves", label: "Revés" },
  { id: "saque", label: "Saque" },
  { id: "volea", label: "Volea" },
  { id: "remate", label: "Remate" },
  { id: "globo", label: "Globo" },
  { id: "dejada", label: "Dejada" },
  { id: "resto", label: "Resto" },
] as const;

const EFECTOS = [
  { id: "liftado", label: "Liftado" },
  { id: "cortado", label: "Cortado" },
  { id: "plano", label: "Plano" },
] as const;

const UBICACIONES = [
  { id: "pista", label: "Pista" },
  { id: "pared", label: "Pared" },
  { id: "playa", label: "Playa" },
  { id: "casa", label: "Casa" },
] as const;

export interface ExerciseFiltersProps {
  currentFilters: {
    formato: string[];
    nivel: string[];
    aspectoJuego: string[];
    parametro: string[];
    duracionRango: string[];
    numJugadores: number[];
    tipoPelota: string[];
    tipoActividad: string[];
    golpes: string[];
    efecto: string[];
    location: string[];
    fase: string[];
    caracter: string[];
    situacionJuego: string[];
    tipoCompeticion: string[];
    autoria: string[];
  };
  preserved: {
    // El nivel se elige en la primera pantalla; aquí solo se conserva.
    nivel?: string[];
    q?: string;
    tab?: string;
    category?: string;
    difficulty?: string;
  };
  sport?: string | null;
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-sans font-semibold tracking-[0.04em] transition-colors",
        active
          ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
          : "border-foreground/15 text-foreground/55 hover:border-foreground/30 hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function toggleString(
  set: Set<string>,
  setter: (next: Set<string>) => void,
  value: string
) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function toggleNumber(
  set: Set<number>,
  setter: (next: Set<number>) => void,
  value: number
) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

function appendAll(
  params: URLSearchParams,
  key: string,
  values: Iterable<string | number>
) {
  for (const value of values) params.append(key, String(value));
}

export function ExerciseFilters({
  currentFilters,
  preserved,
  sport,
}: ExerciseFiltersProps) {
  const router = useRouter();
  const showPelota = showsTipoPelota(sport);
  const [open, setOpen] = useState(false);
  const [formato, setFormato] = useState(new Set(currentFilters.formato));
  const [fase, setFase] = useState(new Set(currentFilters.fase));
  const [caracter, setCaracter] = useState(new Set(currentFilters.caracter));
  const [situacionJuego, setSituacionJuego] = useState(
    new Set(currentFilters.situacionJuego)
  );
  const [tipoCompeticion, setTipoCompeticion] = useState(
    new Set(currentFilters.tipoCompeticion)
  );
  const [aspectoJuego, setAspectoJuego] = useState(
    new Set(currentFilters.aspectoJuego)
  );
  const [parametro, setParametro] = useState(new Set(currentFilters.parametro));
  const [duracionRango, setDuracionRango] = useState(
    new Set(currentFilters.duracionRango)
  );
  const [numJugadores, setNumJugadores] = useState(
    new Set(currentFilters.numJugadores)
  );
  const [tipoPelota, setTipoPelota] = useState(
    new Set(currentFilters.tipoPelota)
  );
  const [tipoActividad, setTipoActividad] = useState(
    new Set(currentFilters.tipoActividad)
  );
  const [golpes, setGolpes] = useState(new Set(currentFilters.golpes));
  const [efecto, setEfecto] = useState(new Set(currentFilters.efecto));
  const [location, setLocation] = useState(new Set(currentFilters.location));
  const [autoria, setAutoria] = useState(new Set(currentFilters.autoria));

  const activeCount =
    formato.size +
    fase.size +
    caracter.size +
    situacionJuego.size +
    tipoCompeticion.size +
    aspectoJuego.size +
    parametro.size +
    duracionRango.size +
    numJugadores.size +
    tipoPelota.size +
    tipoActividad.size +
    golpes.size +
    efecto.size +
    location.size +
    autoria.size;

  function buildParams() {
    const p = new URLSearchParams();
    if (preserved.q) p.set("q", preserved.q);
    if (preserved.tab && preserved.tab !== "all") p.set("tab", preserved.tab);
    if (preserved.category && preserved.category !== "all") {
      p.set("category", preserved.category);
    }
    if (preserved.difficulty && preserved.difficulty !== "all") {
      p.set("difficulty", preserved.difficulty);
    }
    appendAll(p, "formato", formato);
    appendAll(p, "nivel", preserved.nivel ?? []);
    appendAll(p, "fase", fase);
    appendAll(p, "caracter", caracter);
    appendAll(p, "situacionJuego", situacionJuego);
    appendAll(p, "tipoCompeticion", tipoCompeticion);
    appendAll(p, "aspectoJuego", aspectoJuego);
    appendAll(p, "parametro", parametro);
    appendAll(p, "duracionRango", duracionRango);
    appendAll(p, "numJugadores", numJugadores);
    appendAll(p, "tipoPelota", tipoPelota);
    appendAll(p, "tipoActividad", tipoActividad);
    appendAll(p, "golpe", golpes);
    appendAll(p, "efecto", efecto);
    appendAll(p, "location", location);
    appendAll(p, "autoria", autoria);
    return p;
  }

  function applyFilters() {
    const p = buildParams();
    router.push(`/exercises${p.toString() ? `?${p}` : ""}`);
    setOpen(false);
  }

  function clearFilters() {
    setFormato(new Set<string>());
    setFase(new Set<string>());
    setCaracter(new Set<string>());
    setSituacionJuego(new Set<string>());
    setTipoCompeticion(new Set<string>());
    setAspectoJuego(new Set<string>());
    setParametro(new Set<string>());
    setDuracionRango(new Set<string>());
    setNumJugadores(new Set<number>());
    setTipoPelota(new Set<string>());
    setTipoActividad(new Set<string>());
    setGolpes(new Set<string>());
    setEfecto(new Set<string>());
    setLocation(new Set<string>());
    setAutoria(new Set<string>());

    const p = new URLSearchParams();
    if (preserved.q) p.set("q", preserved.q);
    if (preserved.tab && preserved.tab !== "all") p.set("tab", preserved.tab);
    if (preserved.category && preserved.category !== "all") {
      p.set("category", preserved.category);
    }
    if (preserved.difficulty && preserved.difficulty !== "all") {
      p.set("difficulty", preserved.difficulty);
    }
    appendAll(p, "nivel", preserved.nivel ?? []);
    router.push(`/exercises${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[11px] font-sans font-bold tracking-[0.08em] transition-colors",
          open || activeCount > 0
            ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
            : "border-foreground/20 text-foreground/55 hover:border-foreground/30 hover:bg-muted hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="size-3.5" strokeWidth={1.6} />
        Filtros
        {activeCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-[#050505] text-[9px] font-bold text-[#D6FF38]">
            {activeCount}
          </span>
        )}
        {open ? (
          <ChevronUp className="size-3" strokeWidth={1.6} />
        ) : (
          <ChevronDown className="size-3" strokeWidth={1.6} />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-5 rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
          <div className="flex flex-wrap items-center gap-3 border-b border-foreground/10 pb-3">
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-4 py-2 text-[12px] font-bold text-[#050505] transition-colors hover:bg-[#c8f52e]"
            >
              Aplicar filtros
            </button>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-[11px] text-foreground/50 transition-colors hover:text-foreground"
              >
                <X className="size-3" />
                Limpiar ({activeCount})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FilterGroup label="Fase de la sesión">
              {FASES.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={fase.has(id)}
                  onClick={() => toggleString(fase, setFase, id)}
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Aspectos del juego">
              {ASPECTOS.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={aspectoJuego.has(id)}
                  onClick={() =>
                    toggleString(aspectoJuego, setAspectoJuego, id)
                  }
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <FilterGroup label="Parámetros">
              {PARAMETROS.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={parametro.has(id)}
                  onClick={() => toggleString(parametro, setParametro, id)}
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Tipo de ejercicio">
              {TIPOS_ACTIVIDAD.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={tipoActividad.has(id)}
                  onClick={() =>
                    toggleString(tipoActividad, setTipoActividad, id)
                  }
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Carácter">
              {CARACTER.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={caracter.has(id)}
                  onClick={() => toggleString(caracter, setCaracter, id)}
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Situación del juego">
              {SITUACION_JUEGO.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={situacionJuego.has(id)}
                  onClick={() =>
                    toggleString(situacionJuego, setSituacionJuego, id)
                  }
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Tipo de competición">
              {TIPO_COMPETICION.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={tipoCompeticion.has(id)}
                  onClick={() =>
                    toggleString(tipoCompeticion, setTipoCompeticion, id)
                  }
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Rango de duración">
              {DURACION_RANGOS.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={duracionRango.has(id)}
                  onClick={() =>
                    toggleString(duracionRango, setDuracionRango, id)
                  }
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FilterGroup label="Formato">
              {FORMATOS.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={formato.has(id)}
                  onClick={() => toggleString(formato, setFormato, id)}
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>

            <FilterGroup label="Jugadores">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <ChipButton
                  key={n}
                  active={numJugadores.has(n)}
                  onClick={() => toggleNumber(numJugadores, setNumJugadores, n)}
                >
                  {n}
                </ChipButton>
              ))}
              <ChipButton
                active={numJugadores.has(7)}
                onClick={() => toggleNumber(numJugadores, setNumJugadores, 7)}
              >
                +6
              </ChipButton>
            </FilterGroup>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-5",
              showPelota && "md:grid-cols-2"
            )}
          >
            {showPelota && (
              <FilterGroup label="Pelota">
                {TIPOS_PELOTA.map(({ id, label, color }) => (
                  <ChipButton
                    key={id}
                    active={tipoPelota.has(id)}
                    onClick={() => toggleString(tipoPelota, setTipoPelota, id)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {color && (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      {label}
                    </span>
                  </ChipButton>
                ))}
              </FilterGroup>
            )}

            <FilterGroup label="Lugar">
              {UBICACIONES.map(({ id, label }) => (
                <ChipButton
                  key={id}
                  active={location.has(id)}
                  onClick={() => toggleString(location, setLocation, id)}
                >
                  {label}
                </ChipButton>
              ))}
            </FilterGroup>
          </div>

          <FilterGroup label="Autoría">
            {AUTORIAS.map(({ id, label }) => (
              <ChipButton
                key={id}
                active={autoria.has(id)}
                onClick={() => toggleString(autoria, setAutoria, id)}
              >
                {label}
              </ChipButton>
            ))}
          </FilterGroup>

          <FilterGroup label="Golpes">
            {GOLPES.map(({ id, label }) => (
              <ChipButton
                key={id}
                active={golpes.has(id)}
                onClick={() => toggleString(golpes, setGolpes, id)}
              >
                {label}
              </ChipButton>
            ))}
          </FilterGroup>

          <FilterGroup label="Efecto">
            {EFECTOS.map(({ id, label }) => (
              <ChipButton
                key={id}
                active={efecto.has(id)}
                onClick={() => toggleString(efecto, setEfecto, id)}
              >
                {label}
              </ChipButton>
            ))}
          </FilterGroup>

          <div className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-3">
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-4 py-2 text-[12px] font-bold text-[#050505] transition-colors hover:bg-[#c8f52e]"
            >
              Aplicar filtros
            </button>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-[11px] text-foreground/50 transition-colors hover:text-foreground"
              >
                <X className="size-3" />
                Limpiar ({activeCount})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
