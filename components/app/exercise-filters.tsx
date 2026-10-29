"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  ASPECTO_JUEGO_LABELS,
  AUTORIAS,
  CARACTER,
  FASES,
  NUEVOS_TIPOS_ACTIVIDAD,
  PELOTAS,
  PELOTAS_LEGACY,
  SITUACION_JUEGO,
  TIPO_COMPETICION,
  showsTipoPelota,
  tipoEjercicioOptionLabel,
} from "@/lib/exercise-taxonomy";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string; color?: string };

const FORMATOS: Option[] = [
  { id: "individual", label: "Individual" },
  { id: "parejas", label: "Parejas" },
  { id: "grupal", label: "Grupal" },
  { id: "multigrupo", label: "Multigrupo" },
];

const ASPECTOS: Option[] = [
  { id: "tecnica", label: "Técnica" },
  { id: "tactica", label: "Táctica" },
  { id: "mental", label: ASPECTO_JUEGO_LABELS.mental },
  { id: "fisico", label: ASPECTO_JUEGO_LABELS.fisico },
];

const PARAMETROS: Option[] = [
  { id: "altura", label: "Altura" },
  { id: "profundidad", label: "Profundidad" },
  { id: "velocidad", label: "Velocidad" },
  { id: "direccion", label: "Dirección" },
  { id: "efecto", label: "Efecto" },
];

const DURACION_RANGOS: Option[] = [
  { id: "1-5", label: "1-5 min" },
  { id: "5-10", label: "5-10 min" },
  { id: "10-15", label: "10-15 min" },
  { id: "15-20", label: "15-20 min" },
  { id: "+20", label: "+20 min" },
];

// Incluye los tipos antiguos (marcados "antiguo") para poder encontrar los
// ejercicios que aún no se han re-etiquetado.
const TIPOS_ACTIVIDAD: Option[] = NUEVOS_TIPOS_ACTIVIDAD.map((id) => ({
  id,
  label: tipoEjercicioOptionLabel(id),
}));

const PELOTAS_COLOR: Option[] = PELOTAS.map((p) => ({ ...p }));

// Las pelotas antiguas se listan aparte para encontrar los ejercicios que
// aún no se han re-etiquetado.
const PELOTAS_ANTIGUAS: Option[] = PELOTAS_LEGACY.map((p) => ({
  id: p.id,
  label: `${p.label} (antigua)`,
}));

const GOLPES: Option[] = [
  { id: "derecha", label: "Derecha" },
  { id: "reves", label: "Revés" },
  { id: "saque", label: "Saque" },
  { id: "volea", label: "Volea" },
  { id: "remate", label: "Remate" },
  { id: "globo", label: "Globo" },
  { id: "dejada", label: "Dejada" },
  { id: "resto", label: "Resto" },
];

const EFECTOS: Option[] = [
  { id: "liftado", label: "Liftado" },
  { id: "cortado", label: "Cortado" },
  { id: "plano", label: "Plano" },
];

const UBICACIONES: Option[] = [
  { id: "pista", label: "Pista" },
  { id: "pared", label: "Pared" },
  { id: "playa", label: "Playa" },
  { id: "casa", label: "Casa" },
];

const JUGADORES: Option[] = [
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "3", label: "3" },
  { id: "4", label: "4" },
  { id: "5", label: "5" },
  { id: "6", label: "6" },
  { id: "7", label: "+6" },
];

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
  sport?: string | null;
  preserved: {
    // El nivel se elige en la primera pantalla; aquí solo se conserva.
    nivel?: string[];
    q?: string;
    tab?: string;
    category?: string;
    difficulty?: string;
  };
}

type FilterDef = {
  // Nombre del parámetro en la URL.
  param: string;
  label: string;
  options: Option[];
  // Opciones secundarias (sin color) que se muestran bajo la rejilla de color.
  extraOptions?: Option[];
  swatches?: boolean;
};

// Los más usados van en la barra; el resto, bajo "Más filtros".
const PRIMARY_FILTERS: FilterDef[] = [
  { param: "aspectoJuego", label: "Aspecto", options: ASPECTOS },
  {
    param: "tipoActividad",
    label: "Tipo de ejercicio",
    options: TIPOS_ACTIVIDAD,
  },
  { param: "duracionRango", label: "Duración", options: DURACION_RANGOS },
  { param: "formato", label: "Formato", options: FORMATOS },
  {
    param: "tipoPelota",
    label: "Pelota",
    options: PELOTAS_COLOR,
    extraOptions: PELOTAS_ANTIGUAS,
    swatches: true,
  },
  { param: "fase", label: "Fase", options: FASES.map((f) => ({ ...f })) },
];

const SECONDARY_FILTERS: FilterDef[] = [
  { param: "parametro", label: "Parámetros", options: PARAMETROS },
  {
    param: "caracter",
    label: "Carácter",
    options: CARACTER.map((c) => ({ ...c })),
  },
  {
    param: "situacionJuego",
    label: "Situación del juego",
    options: SITUACION_JUEGO.map((s) => ({ ...s })),
  },
  {
    param: "tipoCompeticion",
    label: "Competición",
    options: TIPO_COMPETICION.map((c) => ({ ...c })),
  },
  { param: "numJugadores", label: "Jugadores", options: JUGADORES },
  { param: "location", label: "Lugar", options: UBICACIONES },
  {
    param: "autoria",
    label: "Autoría",
    options: AUTORIAS.map((a) => ({ ...a })),
  },
  { param: "golpe", label: "Golpes", options: GOLPES },
  { param: "efecto", label: "Efecto", options: EFECTOS },
];

const ALL_PARAMS = [...PRIMARY_FILTERS, ...SECONDARY_FILTERS].map(
  (f) => f.param
);

const APPLY_DELAY_MS = 350;

type Values = Record<string, string[]>;

function valuesFromProps(
  current: ExerciseFiltersProps["currentFilters"]
): Values {
  return {
    formato: current.formato,
    fase: current.fase,
    caracter: current.caracter,
    situacionJuego: current.situacionJuego,
    tipoCompeticion: current.tipoCompeticion,
    aspectoJuego: current.aspectoJuego,
    parametro: current.parametro,
    duracionRango: current.duracionRango,
    numJugadores: current.numJugadores.map(String),
    tipoPelota: current.tipoPelota,
    tipoActividad: current.tipoActividad,
    golpe: current.golpes,
    efecto: current.efecto,
    location: current.location,
    autoria: current.autoria,
  };
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
      aria-pressed={active}
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

function CountBadge({ count }: { count: number }) {
  return (
    <span className="flex size-4 items-center justify-center rounded-full bg-[#050505] text-[9px] font-bold text-[#D6FF38]">
      {count}
    </span>
  );
}

function CheckboxRow({
  option,
  checked,
  onToggle,
}: {
  option: Option;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 font-sans text-sm text-foreground/80 transition-colors hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 shrink-0 cursor-pointer accent-[#050505]"
      />
      {option.label}
    </label>
  );
}

function SwatchButton({
  option,
  checked,
  onToggle,
}: {
  option: Option;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="flex flex-col items-center gap-1.5 rounded-md px-1 py-1.5 font-sans text-xs text-foreground/80 transition-colors hover:bg-muted"
    >
      <span
        aria-hidden
        className={cn(
          "grid size-9 place-items-center rounded-full border border-black/10",
          checked && "ring-2 ring-[#050505] ring-offset-2 ring-offset-popover"
        )}
        style={{ backgroundColor: option.color }}
      >
        {checked && (
          <Check className="size-4 text-black/70" strokeWidth={2.5} />
        )}
      </span>
      {option.label}
    </button>
  );
}

function FilterDropdown({
  def,
  selected,
  onToggle,
}: {
  def: FilterDef;
  selected: string[];
  onToggle: (param: string, id: string) => void;
}) {
  const count = selected.length;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "group inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 font-sans text-[11px] font-bold tracking-[0.08em] transition-colors",
          count > 0
            ? "border-[#050505] bg-[#D6FF38] text-[#050505]"
            : "border-foreground/20 text-foreground/70 hover:border-foreground/40 hover:text-foreground"
        )}
      >
        {def.label}
        {count > 0 && <CountBadge count={count} />}
        <ChevronDown
          className="size-3.5 transition-transform group-data-popup-open:rotate-180"
          strokeWidth={1.8}
        />
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between pb-2">
          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
            {def.label}
          </p>
          <PopoverClose
            aria-label="Cerrar"
            className="grid size-7 place-items-center rounded-full text-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </PopoverClose>
        </div>
        {def.swatches ? (
          <div className="grid grid-cols-3 gap-1">
            {def.options.map((option) => (
              <SwatchButton
                key={option.id}
                option={option}
                checked={selected.includes(option.id)}
                onToggle={() => onToggle(def.param, option.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-0.5">
            {def.options.map((option) => (
              <CheckboxRow
                key={option.id}
                option={option}
                checked={selected.includes(option.id)}
                onToggle={() => onToggle(def.param, option.id)}
              />
            ))}
          </div>
        )}
        {def.extraOptions && (
          <div className="mt-2 grid gap-0.5 border-t border-foreground/10 pt-2">
            {def.extraOptions.map((option) => (
              <CheckboxRow
                key={option.id}
                option={option}
                checked={selected.includes(option.id)}
                onToggle={() => onToggle(def.param, option.id)}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ExerciseFilters({
  currentFilters,
  preserved,
  sport,
}: ExerciseFiltersProps) {
  const router = useRouter();
  const primaryFilters = showsTipoPelota(sport)
    ? PRIMARY_FILTERS
    : PRIMARY_FILTERS.filter((f) => f.param !== "tipoPelota");
  const [isPending, startTransition] = useTransition();
  const [moreOpen, setMoreOpen] = useState(false);
  const [values, setValues] = useState<Values>(() =>
    valuesFromProps(currentFilters)
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la URL cambia desde fuera (p. ej. un enlace del resumen), se vuelve a
  // leer. Mientras hay una navegación propia en curso se conserva lo marcado.
  const serverKey = JSON.stringify(currentFilters);
  const [prevServerKey, setPrevServerKey] = useState(serverKey);
  if (prevServerKey !== serverKey) {
    setPrevServerKey(serverKey);
    if (!isPending) setValues(valuesFromProps(currentFilters));
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function buildUrl(next: Values) {
    const p = new URLSearchParams();
    if (preserved.q) p.set("q", preserved.q);
    if (preserved.tab && preserved.tab !== "all") p.set("tab", preserved.tab);
    if (preserved.category && preserved.category !== "all") {
      p.set("category", preserved.category);
    }
    if (preserved.difficulty && preserved.difficulty !== "all") {
      p.set("difficulty", preserved.difficulty);
    }
    for (const value of preserved.nivel ?? []) p.append("nivel", value);
    for (const param of ALL_PARAMS) {
      for (const value of next[param] ?? []) p.append(param, value);
    }
    return `/exercises${p.toString() ? `?${p}` : ""}`;
  }

  function navigate(next: Values, delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      startTransition(() => {
        router.replace(buildUrl(next), { scroll: false });
      });
    }, delay);
  }

  function toggle(param: string, id: string) {
    const current = values[param] ?? [];
    const next: Values = {
      ...values,
      [param]: current.includes(id)
        ? current.filter((v) => v !== id)
        : [...current, id],
    };
    setValues(next);
    navigate(next, APPLY_DELAY_MS);
  }

  function clearAll() {
    const next: Values = {};
    setValues(next);
    navigate(next, 0);
  }

  const primaryCount = primaryFilters.reduce(
    (sum, f) => sum + (values[f.param]?.length ?? 0),
    0
  );
  const secondaryCount = SECONDARY_FILTERS.reduce(
    (sum, f) => sum + (values[f.param]?.length ?? 0),
    0
  );
  const activeCount = primaryCount + secondaryCount;

  return (
    <div className={cn("transition-opacity", isPending && "opacity-70")}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls="exercise-more-filters"
          aria-label="Más filtros"
          title="Más filtros"
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 transition-colors",
            moreOpen || secondaryCount > 0
              ? "border-[#050505] bg-[#D6FF38] text-[#050505]"
              : "border-foreground/20 text-foreground/70 hover:border-foreground/40 hover:text-foreground"
          )}
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.8} />
          {secondaryCount > 0 && <CountBadge count={secondaryCount} />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {primaryFilters.map((def) => (
            <FilterDropdown
              key={def.param}
              def={def}
              selected={values[def.param] ?? []}
              onToggle={toggle}
            />
          ))}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-2 font-sans text-[11px] text-foreground/50 transition-colors hover:text-foreground"
            >
              <X className="size-3" />
              Limpiar ({activeCount})
            </button>
          )}
        </div>
      </div>

      {moreOpen && (
        <div
          id="exercise-more-filters"
          className="mt-3 grid grid-cols-1 gap-5 rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5 md:grid-cols-2"
        >
          {SECONDARY_FILTERS.map((def) => (
            <FilterGroup key={def.param} label={def.label}>
              {def.options.map((option) => (
                <ChipButton
                  key={option.id}
                  active={(values[def.param] ?? []).includes(option.id)}
                  onClick={() => toggle(def.param, option.id)}
                >
                  {option.label}
                </ChipButton>
              ))}
            </FilterGroup>
          ))}
        </div>
      )}
    </div>
  );
}
