"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import {
  PRIMARY_FILTERS,
  SECONDARY_FILTERS,
  type FilterDef,
  type Option,
} from "@/lib/exercise-filter-options";
import { showsTipoPelota } from "@/lib/exercise-taxonomy";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

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
  const term = useTerm();
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 font-sans text-sm text-foreground/80 transition-colors hover:bg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 shrink-0 cursor-pointer accent-[#050505]"
      />
      {term(option.label)}
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
  const term = useTerm();
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
      {term(option.label)}
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
  const term = useTerm();
  const tx = useTranslations("ui.s_app_exercisefilters");
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
        {term(def.label)}
        {count > 0 && <CountBadge count={count} />}
        <ChevronDown
          className="size-3.5 transition-transform group-data-popup-open:rotate-180"
          strokeWidth={1.8}
        />
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between pb-2">
          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
            {term(def.label)}
          </p>
          <PopoverClose
            aria-label={tx("cerrar")}
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
      </PopoverContent>
    </Popover>
  );
}

export function ExerciseFilters({
  currentFilters,
  preserved,
  sport,
}: ExerciseFiltersProps) {
  const tx = useTranslations("ui.s_app_exercisefilters");
  const router = useRouter();
  const primaryFilters = showsTipoPelota(sport)
    ? PRIMARY_FILTERS
    : PRIMARY_FILTERS.filter((f) => f.param !== "tipoPelota");
  const [isPending, startTransition] = useTransition();
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

  // Todos los filtros van visibles de entrada, en filas que se ajustan al ancho.
  const visibleFilters = [...primaryFilters, ...SECONDARY_FILTERS];
  const activeCount = visibleFilters.reduce(
    (sum, f) => sum + (values[f.param]?.length ?? 0),
    0
  );

  return (
    <div className={cn("transition-opacity", isPending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        {visibleFilters.map((def) => (
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
            {tx("limpiar")}{activeCount})
          </button>
        )}
      </div>
    </div>
  );
}
