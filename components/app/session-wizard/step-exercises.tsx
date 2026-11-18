"use client";

import {
  useRef,
  useState,
  DragEvent,
  useEffect,
  type ReactNode,
} from "react";
import NextLink from "next/link";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock,
  Coffee,
  Dumbbell,
  ExternalLink,
  RefreshCw,
  Shuffle,
  Filter,
  GripVertical,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  StickyNote,
  Type,
  X,
} from "lucide-react";
import {
  ExerciseForm,
  type ExerciseFormResult,
} from "@/components/app/exercise-form";
import { SessionExerciseLists } from "@/components/app/session-exercise-lists";
import { ExerciseQuickDescription } from "@/components/app/exercise-quick-description";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CourtsBoard } from "./courts-board";
import {
  EMPTY_PICKER_FILTERS,
  ExercisePickerFilters,
  hasPickerFilters,
  matchesPickerFilters,
  type PickerFilters,
} from "@/components/app/exercise-picker-filters";
import {
  ASPECTO_JUEGO_VALUES,
  emptyStationDraft,
  STATION_COUNT_MAX,
  STATION_COUNT_MIN,
  type AspectoJuego,
  type StationDraftItem,
} from "@/lib/block-items";
import { ASPECTO_JUEGO_LABELS } from "@/lib/exercise-taxonomy";
import {
  pickExerciseHref,
  useExercisePickListener,
} from "@/lib/exercise-pick-bridge";
import {
  PHASE_LABELS,
  type AvailableExercise,
  type TrainingPhase,
  type WizardExercise,
  type WizardState,
} from "./types";
import {
  computeTimelineDuration,
  createStationsItem,
  createTextItem,
  createWarmupItem,
  isStationsItem,
  isTextItem,
  isWarmupItem,
} from "./timeline";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

const CATEGORY_COLORS: Record<string, string> = {
  technique: "text-blue-400 bg-blue-400/10",
  tactics: "text-purple-400 bg-purple-400/10",
  fitness: "text-amber-400 bg-amber-400/10",
  "warm-up": "text-brand bg-brand/10",
  warmup: "text-sky-400 bg-sky-400/10",
  stations: "text-emerald-400 bg-emerald-400/10",
};

const CATEGORY_BAR: Record<string, string> = {
  text: "bg-foreground/30",
  technique: "bg-blue-400",
  tactics: "bg-purple-400",
  fitness: "bg-amber-400",
  "warm-up": "bg-brand",
  warmup: "bg-sky-400",
  stations: "bg-emerald-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Fitness",
  "warm-up": "Calentamiento",
  warmup: "Descanso",
  stations: "Estaciones",
};

/** Orden fijo de los 3 bloques predefinidos de la sesión. */
const PHASE_ORDER: TrainingPhase[] = ["activation", "main", "cooldown"];

/** Máximo de resultados que muestra el buscador de ejercicios a la vez. */
const VISIBLE_RESULTS = 30;

interface StepExercisesProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  availableExercises: AvailableExercise[];
  /** Mis lugares: para elegir en qué lugar está cada pista. */
  places?: { id: string; name: string }[];
  /** Se llama justo antes de abrir la ficha de un ejercicio (guardar borrador). */
  onBeforeLeave?: () => void;
  /**
   * "Que la diseñe Ten Planner": cambia automáticamente un ejercicio de la
   * propuesta por otro adecuado para ese hueco. Solo se muestra en los
   * items para los que canAutoChange devuelve true.
   */
  onAutoChange?: (flatIdx: number) => void;
  canAutoChange?: (ex: WizardExercise) => boolean;
  autoChangingIdx?: number | null;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Fase efectiva de un item: los items sin fase (sesiones antiguas) se
 * muestran en "Bloque principal", igual que ya hace `phaseToBlockOrder`
 * al guardar. */
function effectivePhase(ex: WizardExercise): TrainingPhase {
  return ex.phase ?? "main";
}

type IndexedExercise = { ex: WizardExercise; flatIdx: number };

function groupByPhase(
  items: WizardExercise[]
): Record<TrainingPhase, IndexedExercise[]> {
  const groups: Record<TrainingPhase, IndexedExercise[]> = {
    activation: [],
    main: [],
    cooldown: [],
  };
  items.forEach((ex, flatIdx) => {
    groups[effectivePhase(ex)].push({ ex, flatIdx });
  });
  return groups;
}

/**
 * Con dos pistas el tablero es el editor principal; la lista por bloques
 * (notas, estaciones, ajustes de cada elemento) queda plegada debajo.
 */
function DetailsWhen({
  when,
  children,
}: {
  when: boolean;
  children: ReactNode;
}) {
  const tx = useTranslations("ui.s_sessionwizard_stepexercises");
  if (!when) return <>{children}</>;
  return (
    <details className="rounded-lg border border-dashed border-foreground/20 bg-card/50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        {tx("edicionDetalladaNotasEstaciones")}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

const ITEM_KIND_FALLBACK_NAME = "este elemento";

export function StepExercises({
  state,
  update,
  availableExercises,
  places = [],
  onBeforeLeave,
  onAutoChange,
  canAutoChange,
  autoChangingIdx = null,
}: StepExercisesProps) {
  const term = useTerm();
  const tx = useTranslations("ui.s_sessionwizard_stepexercises");
  const [libraryExercises, setLibraryExercises] = useState(availableExercises);
  const [sourceTab, setSourceTab] = useState<"library" | "lists">("library");
  const [search, setSearch] = useState("");
  const [libCategoryFilter, setLibCategoryFilter] = useState<string>("all");
  const [pickerFilters, setPickerFilters] =
    useState<PickerFilters>(EMPTY_PICKER_FILTERS);
  const [editingDurationIdx, setEditingDurationIdx] = useState<number | null>(
    null
  );
  const [durationEditValue, setDurationEditValue] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [focusedTextIdx, setFocusedTextIdx] = useState<number | null>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);

  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  /** Estación sobre la que se arrastra un ejercicio de la Biblioteca, para resaltarla. */
  const [dragOverStation, setDragOverStation] = useState<{
    itemIdx: number;
    stationIdx: number;
  } | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [refreshingLibrary, setRefreshingLibrary] = useState(false);
  /** Item de texto libre que se está "convirtiendo" en ficha de ejercicio
   * (su clave local, p. ej. "text-..."): al crear el ejercicio, lo
   * sustituye en vez de añadirse al final. */
  const [convertingItemKey, setConvertingItemKey] = useState<string | null>(
    null
  );
  const [quickCreateInitialData, setQuickCreateInitialData] = useState<{
    name?: string;
    description?: string | null;
    aspectoJuego?: AspectoJuego | null;
  } | null>(null);

  /** A qué bloque se añade lo siguiente desde el panel derecho (Biblioteca/Listas). */
  const [addPhaseOverride, setAddPhaseOverride] =
    useState<TrainingPhase | null>(null);

  const [stationsDraftPhase, setStationsDraftPhase] =
    useState<TrainingPhase | null>(null);
  const [stationsDraftCount, setStationsDraftCount] = useState(4);
  /** Estación para la que se está eligiendo un ejercicio desde la Biblioteca. */
  const [pickingStation, setPickingStation] = useState<{
    itemIdx: number;
    stationIdx: number;
  } | null>(null);
  /** Bloque en el que está abierto el buscador de ejercicios (como en Clases). */
  const [pickerPhase, setPickerPhase] = useState<TrainingPhase | null>(null);
  // Dos pistas: lo que se añade desde una pista se queda en ella mientras el
  // buscador siga abierto en ese bloque.
  const pendingCourtRef = useRef<1 | 2 | null>(null);
  /** Elemento con el menú "Sustituir por…" abierto (índice en la sesión). */
  const [replaceMenuIdx, setReplaceMenuIdx] = useState<number | null>(null);
  /** Elemento que se está sustituyendo por un ejercicio de la biblioteca o
   * por unas estaciones: lo elegido ocupa su lugar en vez de añadirse. */
  const replacePanelRef = useRef<HTMLDivElement>(null);
  const [replacing, setReplacing] = useState<{
    idx: number;
    name: string;
    target: "exercise" | "stations";
  } | null>(null);

  const selected = state.exercises;

  // Al sustituir, el buscador se abre bajo el elemento: llevarlo a la vista.
  useEffect(() => {
    if (!replacing) return;
    const frame = requestAnimationFrame(() =>
      replacePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    );
    return () => cancelAnimationFrame(frame);
  }, [replacing]);

  // Las sesiones creadas antes de que los 3 bloques fueran explícitos tienen
  // items con phase=null; al cargarlos aquí se normalizan a "main" (igual que
  // `phaseToBlockOrder` ya los trataba al guardar), para que nada quede fuera
  // de los 3 bloques visibles.
  useEffect(() => {
    if (state.exercises.some((ex) => ex.phase === null)) {
      update({
        exercises: state.exercises.map((ex) =>
          ex.phase === null ? { ...ex, phase: "main" } : ex
        ),
      });
    }
    // Solo al montar: normaliza una vez los datos cargados inicialmente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Con dos pistas lo de cada pista ocurre a la vez (ver timeline.ts).
  const totalDuration = computeTimelineDuration({
    exercises: selected,
    courts: state.courts,
    blocks: state.blocks,
  });
  const selectedIds = new Set(selected.map((e) => e.exerciseId));
  // Sumatorio del tiempo por tipo de elemento (ejercicios, descansos...).
  const minutesByKind = { exercise: 0, rest: 0, text: 0, stations: 0 };
  for (const e of selected) {
    const minutes = e.overrideDuration ?? e.durationMinutes;
    if (isWarmupItem(e)) minutesByKind.rest += minutes;
    else if (isStationsItem(e)) minutesByKind.stations += minutes;
    else if (isTextItem(e)) minutesByKind.text += minutes;
    else minutesByKind.exercise += minutes;
  }
  const timeParts = [
    { label: tx("ejercicios"), minutes: minutesByKind.exercise },
    { label: tx("estaciones"), minutes: minutesByKind.stations },
    { label: tx("textosActividades"), minutes: minutesByKind.text },
    { label: tx("descansos"), minutes: minutesByKind.rest },
  ].filter((p) => p.minutes > 0);
  const availableCategories = Array.from(
    new Set(libraryExercises.map((e) => e.category))
  );

  const grouped = groupByPhase(selected);
  const activeAddPhase: TrainingPhase =
    addPhaseOverride ??
    PHASE_ORDER.find((p) => grouped[p].length === 0) ??
    "activation";

  const filteredAvailable = libraryExercises.filter((ex) => {
    const notSelected = !selectedIds.has(ex.id);
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      libCategoryFilter === "all" || ex.category === libCategoryFilter;
    return (
      notSelected &&
      matchesSearch &&
      matchesCategory &&
      matchesPickerFilters(ex, pickerFilters)
    );
  });

  useEffect(() => {
    if (editingDurationIdx !== null) durationInputRef.current?.focus();
  }, [editingDurationIdx]);

  useEffect(() => {
    // Al cerrar el buscador, lo siguiente que se añada vuelve a la pista 1.
    if (pickerPhase === null) pendingCourtRef.current = null;
  }, [pickerPhase]);

  function setExercises(next: WizardExercise[]) {
    update({ exercises: next });
  }

  function addExercise(ex: AvailableExercise, phase: TrainingPhase) {
    const item: WizardExercise = {
      exerciseId: ex.id,
      name: ex.name,
      category: ex.category,
      durationMinutes: ex.durationMinutes,
      overrideDuration: null,
      notes: "",
      phase,
      intensity: null,
      // Dos pistas: se queda en la pista desde la que se abrió el buscador.
      ...(pendingCourtRef.current ? { court: pendingCourtRef.current } : {}),
    };
    setExercises([...selected, item]);
  }

  /**
   * Pone `next` en el lugar del elemento `idx` (mismo bloque y posición). Se
   * conserva el tiempo que tenía ese hueco si era distinto del nuevo, para
   * que la duración de la sesión no cambie sin querer.
   */
  function replaceAt(idx: number, next: WizardExercise) {
    const old = selected[idx];
    if (!old) return;
    const oldMinutes = old.overrideDuration ?? old.durationMinutes;
    const keepTime =
      !isStationsItem(next) &&
      !isStationsItem(old) &&
      oldMinutes != null &&
      oldMinutes !== next.durationMinutes;
    const item: WizardExercise = {
      ...next,
      phase: old.phase,
      overrideDuration: keepTime ? oldMinutes : next.overrideDuration,
      // Con dos pistas, lo que sustituye se queda en su pista, con quien lo
      // dirige y sus turnos.
      court: old.court,
      ledBy: old.ledBy,
      turnMinutes: old.turnMinutes,
      turnSize: old.turnSize,
    };
    setExercises(selected.map((e, i) => (i === idx ? item : e)));
    setReplacing(null);
    setReplaceMenuIdx(null);
    setExpandedIdx(null);
  }

  function exerciseItemFrom(
    ex: AvailableExercise,
    phase: TrainingPhase
  ): WizardExercise {
    return {
      exerciseId: ex.id,
      name: ex.name,
      category: ex.category,
      durationMinutes: ex.durationMinutes,
      overrideDuration: null,
      notes: "",
      phase,
      intensity: null,
    };
  }

  /** "Sustituir por…": Ejercicio abre el buscador; Texto y Descanso
   * sustituyen al momento; Estaciones pide cuántas. */
  function startReplace(
    idx: number,
    kind: "exercise" | "text" | "warmup" | "stations"
  ) {
    const old = selected[idx];
    if (!old) return;
    const phase = old.phase ?? "main";
    const name = old.name || ITEM_KIND_FALLBACK_NAME;
    setReplaceMenuIdx(null);
    if (kind === "text") {
      replaceAt(idx, createTextItem("", phase));
      return;
    }
    if (kind === "warmup") {
      replaceAt(idx, createWarmupItem(phase));
      return;
    }
    if (kind === "stations") {
      setReplacing({ idx, name, target: "stations" });
      setPickerPhase(null);
      setStationsDraftPhase(phase);
      setStationsDraftCount(4);
      return;
    }
    setReplacing({ idx, name, target: "exercise" });
    setAddPhaseOverride(phase);
    setPickingStation(null);
    setStationsDraftPhase(null);
    setSourceTab("library");
    setSearch("");
    setPickerPhase(phase);
  }

  /** Sustituye un item de texto libre (por su clave local) por un ejercicio
   * de biblioteca recién creado, conservando bloque, duración y notas. */
  function replaceItemWithExercise(key: string, ex: AvailableExercise) {
    setExercises(
      selected.map((item) =>
        item.exerciseId === key
          ? ({
              exerciseId: ex.id,
              name: ex.name,
              category: ex.category,
              durationMinutes: ex.durationMinutes,
              overrideDuration: item.overrideDuration,
              notes: item.notes,
              phase: item.phase,
              intensity: item.intensity,
            } satisfies WizardExercise)
          : item
      )
    );
  }

  /** Usado tras crear un ejercicio desde el diálogo rápido: si se abrió
   * para convertir un texto libre concreto, lo sustituye; si no, lo añade
   * al final del bloque activo (comportamiento normal de "Nuevo"). */
  function addOrReplaceExercise(ex: AvailableExercise) {
    if (convertingItemKey) {
      replaceItemWithExercise(convertingItemKey, ex);
      setConvertingItemKey(null);
    } else {
      addExercise(ex, activeAddPhase);
    }
  }

  function addExercisesFromList(
    items: Array<{
      id: string;
      name: string;
      category: string;
      difficulty: string;
      durationMinutes: number;
    }>,
    phase: TrainingPhase
  ) {
    if (items.length === 0) return;

    const nextItems: WizardExercise[] = items
      .filter((item) => !selectedIds.has(item.id))
      .map((item) => ({
        exerciseId: item.id,
        name: item.name,
        category: item.category,
        durationMinutes: item.durationMinutes,
        overrideDuration: null,
        notes: "",
        phase,
        intensity: null,
        ...(pendingCourtRef.current ? { court: pendingCourtRef.current } : {}),
      }));

    if (nextItems.length === 0) return;
    setExercises([...selected, ...nextItems]);
  }

  function addTextItem(phase: TrainingPhase) {
    setExercises([...selected, createTextItem("", phase)]);
  }

  function addWarmupItem(phase: TrainingPhase) {
    setExercises([...selected, createWarmupItem(phase)]);
  }

  function confirmStationsDraft() {
    if (!stationsDraftPhase) return;
    const n = Math.min(
      STATION_COUNT_MAX,
      Math.max(STATION_COUNT_MIN, stationsDraftCount || STATION_COUNT_MIN)
    );
    const stationsItem = createStationsItem(stationsDraftPhase, n, "");
    if (replacing?.target === "stations") {
      replaceAt(replacing.idx, stationsItem);
    } else {
      setExercises([...selected, stationsItem]);
    }
    setStationsDraftPhase(null);
    setStationsDraftCount(4);
  }

  function updateStation(
    itemIdx: number,
    stationIdx: number,
    patch: Partial<StationDraftItem>
  ) {
    setExercises(
      selected.map((ex, i) => {
        if (i !== itemIdx || !isStationsItem(ex)) return ex;
        return {
          ...ex,
          stations: (ex.stations ?? []).map((s, k) =>
            k === stationIdx ? { ...s, ...patch } : s
          ),
        };
      })
    );
  }

  function addStation(itemIdx: number) {
    setExercises(
      selected.map((ex, i) => {
        if (i !== itemIdx || !isStationsItem(ex)) return ex;
        const stations = ex.stations ?? [];
        if (stations.length >= STATION_COUNT_MAX) return ex;
        return { ...ex, stations: [...stations, emptyStationDraft()] };
      })
    );
  }

  function removeStation(itemIdx: number, stationIdx: number) {
    setExercises(
      selected.map((ex, i) => {
        if (i !== itemIdx || !isStationsItem(ex)) return ex;
        const stations = ex.stations ?? [];
        if (stations.length <= STATION_COUNT_MIN) return ex;
        return {
          ...ex,
          stations: stations.filter((_, k) => k !== stationIdx),
        };
      })
    );
    setPickingStation((current) =>
      current?.itemIdx === itemIdx && current.stationIdx === stationIdx
        ? null
        : current
    );
  }

  function setStationExercise(
    itemIdx: number,
    stationIdx: number,
    ex: AvailableExercise
  ) {
    updateStation(itemIdx, stationIdx, {
      kind: "exercise",
      exerciseId: ex.id,
      name: ex.name,
    });
    setPickingStation(null);
    setPickerPhase(null);
  }

  /**
   * Destino recordado al abrir la ficha de un ejercicio en otra pestaña:
   * el bloque (o la estación) desde el que se abrió. Así, al pulsar
   * "Añadir a la sesión que estás creando" en la ficha, el ejercicio cae
   * donde el monitor estaba eligiendo aunque luego haya cerrado el buscador.
   */
  const pickTargetRef = useRef<{
    phase: TrainingPhase;
    station: { itemIdx: number; stationIdx: number } | null;
  } | null>(null);

  function rememberPickTarget() {
    pickTargetRef.current = {
      phase: activeAddPhase,
      station: pickingStation,
    };
    // Guarda el borrador antes de abrir la ficha: en el móvil la ficha puede
    // abrirse en la misma ventana y, al volver, hay que recuperar la sesión.
    onBeforeLeave?.();
  }

  const pickerId = useExercisePickListener((exerciseId) => {
    const ex = libraryExercises.find((e) => e.id === exerciseId);
    if (!ex) {
      return {
        ok: false,
        message: tx("esteEjercicioNoEsta"),
      };
    }
    const target = pickTargetRef.current ?? {
      phase: activeAddPhase,
      station: pickingStation,
    };
    const stationItem = target.station
      ? selected[target.station.itemIdx]
      : undefined;
    if (target.station && stationItem && isStationsItem(stationItem)) {
      setStationExercise(target.station.itemIdx, target.station.stationIdx, ex);
      pickTargetRef.current = null;
      return {
        ok: true,
        message: tx("anadidoALaEstacion"),
      };
    }
    if (selectedIds.has(ex.id)) {
      return { ok: false, message: tx("esteEjercicioYaEsta") };
    }
    if (replacing?.target === "exercise") {
      replaceAt(replacing.idx, exerciseItemFrom(ex, target.phase));
      setPickerPhase(null);
      return {
        ok: true,
        message: tx("ejercicioSustituidoYaPuedes"),
      };
    }
    addExercise(ex, target.phase);
    return {
      ok: true,
      message: tx("anadidoAV1Ya", { v1: PHASE_LABELS[target.phase] }),
    };
  });

  function removeExercise(id: string) {
    // Cambian las posiciones: se anula una sustitución a medias.
    setReplacing(null);
    setReplaceMenuIdx(null);
    setExercises(selected.filter((e) => e.exerciseId !== id));
  }

  /**
   * Mueve el item en `sourceFlatIdx` al bloque `targetPhase`, en la posición
   * `targetLocalIdx` dentro de ese bloque. Reconstruye la línea de tiempo
   * agrupando por bloque (en el orden fijo de los 3 bloques) para que el
   * orden dentro de cada bloque sea el que ve el monitor, y actualiza la
   * `phase` del item si cambia de bloque.
   */
  function relocateItem(
    sourceFlatIdx: number,
    targetPhase: TrainingPhase,
    targetLocalIdx: number
  ) {
    const item = selected[sourceFlatIdx];
    if (!item) return;
    setReplacing(null);
    setReplaceMenuIdx(null);
    const groups = groupByPhase(selected);
    // Mapa mutable fase -> array de ejercicios, para hacer el splice/insert
    // y luego aplanar en el orden fijo de los 3 bloques.
    const byPhase: Record<TrainingPhase, WizardExercise[]> = {
      activation: groups.activation.map((entry) => entry.ex),
      main: groups.main.map((entry) => entry.ex),
      cooldown: groups.cooldown.map((entry) => entry.ex),
    };

    const sourcePhase = effectivePhase(item);
    const sourceGroup = byPhase[sourcePhase];
    const sourceLocalIdx = sourceGroup.indexOf(item);
    if (sourceLocalIdx === -1) return;
    if (sourcePhase === targetPhase && sourceLocalIdx === targetLocalIdx)
      return;

    sourceGroup.splice(sourceLocalIdx, 1);
    let insertIdx = targetLocalIdx;
    if (sourcePhase === targetPhase && sourceLocalIdx < targetLocalIdx) {
      insertIdx = targetLocalIdx - 1;
    }

    const targetGroup = byPhase[targetPhase];
    insertIdx = Math.max(0, Math.min(insertIdx, targetGroup.length));

    const updatedItem: WizardExercise =
      sourcePhase === targetPhase ? item : { ...item, phase: targetPhase };
    targetGroup.splice(insertIdx, 0, updatedItem);

    setExercises(PHASE_ORDER.flatMap((p) => byPhase[p]));
  }

  function moveItemToPhase(flatIdx: number, targetPhase: TrainingPhase) {
    const item = selected[flatIdx];
    if (!item || effectivePhase(item) === targetPhase) return;
    relocateItem(flatIdx, targetPhase, grouped[targetPhase].length);
  }

  function patchItem(idx: number, patch: Partial<WizardExercise>) {
    setExercises(selected.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function startEditDuration(idx: number) {
    const ex = selected[idx];
    setDurationEditValue(String(ex.overrideDuration ?? ex.durationMinutes));
    setEditingDurationIdx(idx);
  }

  function commitDurationEdit(idx: number) {
    const val = parseInt(durationEditValue, 10);
    if (!isNaN(val) && val >= 1 && val <= 300) {
      patchItem(idx, { overrideDuration: val });
    }
    setEditingDurationIdx(null);
  }

  function onLibraryDragStart(e: DragEvent, ex: AvailableExercise) {
    e.dataTransfer.setData("dnd-type", "library");
    e.dataTransfer.setData("exercise-id", ex.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  function onTimelineDragStart(e: DragEvent, index: number) {
    e.dataTransfer.setData("dnd-type", "reorder");
    e.dataTransfer.setData("src-index", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDragSrcIdx(index);
  }

  function onBlockItemDrop(
    e: DragEvent,
    phase: TrainingPhase,
    localIdx: number
  ) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIdx(null);
    const type = e.dataTransfer.getData("dnd-type");
    if (type === "library") {
      const id = e.dataTransfer.getData("exercise-id");
      const ex = libraryExercises.find((a) => a.id === id);
      if (ex && !selectedIds.has(id)) addExercise(ex, phase);
    } else if (type === "reorder") {
      const from = parseInt(e.dataTransfer.getData("src-index"), 10);
      if (!isNaN(from)) relocateItem(from, phase, localIdx);
    }
    setDragSrcIdx(null);
  }

  function onBlockEndDrop(e: DragEvent, phase: TrainingPhase) {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData("dnd-type");
    if (type === "library") {
      const id = e.dataTransfer.getData("exercise-id");
      const ex = libraryExercises.find((a) => a.id === id);
      if (ex && !selectedIds.has(id)) addExercise(ex, phase);
    } else if (type === "reorder") {
      const from = parseInt(e.dataTransfer.getData("src-index"), 10);
      if (!isNaN(from)) relocateItem(from, phase, grouped[phase].length);
    }
    setDragSrcIdx(null);
    setDragOverIdx(null);
  }

  /** Suelta un ejercicio de la Biblioteca directamente sobre una estación concreta. */
  function onStationDrop(e: DragEvent, itemIdx: number, stationIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData("dnd-type");
    if (type === "library") {
      const id = e.dataTransfer.getData("exercise-id");
      const ex = libraryExercises.find((a) => a.id === id);
      if (ex) setStationExercise(itemIdx, stationIdx, ex);
    }
    setDragOverStation(null);
  }

  async function refreshLibrary(createdExercise?: ExerciseFormResult) {
    setRefreshingLibrary(true);

    try {
      const res = await fetch("/api/exercises?limit=200", {
        cache: "no-store",
      });

      if (!res.ok) {
        if (createdExercise && !selectedIds.has(createdExercise.id)) {
          const fallbackExercise: AvailableExercise = {
            id: createdExercise.id,
            name: createdExercise.name,
            category: createdExercise.category,
            difficulty: createdExercise.difficulty,
            durationMinutes: createdExercise.durationMinutes,
          };

          setLibraryExercises((current) => {
            const next = current.filter(
              (exercise) => exercise.id !== fallbackExercise.id
            );
            return [fallbackExercise, ...next];
          });
          addOrReplaceExercise(fallbackExercise);
        }
        return;
      }

      const payload = (await res.json()) as {
        data?: Array<{
          id: string;
          name: string;
          category: string;
          difficulty: string;
          durationMinutes: number;
          description?: string | null;
        }>;
      };

      const nextLibrary = Array.isArray(payload.data)
        ? payload.data.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            category: exercise.category,
            difficulty: exercise.difficulty,
            durationMinutes: exercise.durationMinutes,
            description: exercise.description ?? null,
          }))
        : [];

      const fallbackExercise =
        createdExercise != null
          ? ({
              id: createdExercise.id,
              name: createdExercise.name,
              category: createdExercise.category,
              difficulty: createdExercise.difficulty,
              durationMinutes: createdExercise.durationMinutes,
            } satisfies AvailableExercise)
          : null;

      const normalizedLibrary =
        fallbackExercise &&
        !nextLibrary.some((exercise) => exercise.id === fallbackExercise.id)
          ? [fallbackExercise, ...nextLibrary]
          : nextLibrary;

      if (normalizedLibrary.length > 0) {
        setLibraryExercises(normalizedLibrary);
      }

      if (createdExercise && !selectedIds.has(createdExercise.id)) {
        const createdFromList =
          normalizedLibrary.find(
            (exercise) => exercise.id === createdExercise.id
          ) ?? fallbackExercise;

        if (createdFromList) {
          addOrReplaceExercise(createdFromList);
        }
      }
    } catch {
      if (createdExercise && !selectedIds.has(createdExercise.id)) {
        const fallbackExercise: AvailableExercise = {
          id: createdExercise.id,
          name: createdExercise.name,
          category: createdExercise.category,
          difficulty: createdExercise.difficulty,
          durationMinutes: createdExercise.durationMinutes,
        };

        setLibraryExercises((current) => {
          const next = current.filter(
            (exercise) => exercise.id !== fallbackExercise.id
          );
          return [fallbackExercise, ...next];
        });
        addOrReplaceExercise(fallbackExercise);
      }
    } finally {
      setRefreshingLibrary(false);
    }
  }

  async function handleQuickCreateSuccess(exercise?: ExerciseFormResult) {
    setShowQuickCreate(false);
    setQuickCreateInitialData(null);
    if (!exercise) {
      setConvertingItemKey(null);
      return;
    }
    await refreshLibrary(exercise);
  }

  function closeQuickCreate() {
    setShowQuickCreate(false);
    setQuickCreateInitialData(null);
    setConvertingItemKey(null);
  }

  /** Abre el diálogo de "crear ejercicio" con el texto libre de un item
   * como punto de partida, para convertirlo en una ficha completa. */
  function openQuickCreateFromText(item: WizardExercise) {
    setConvertingItemKey(item.exerciseId);
    setQuickCreateInitialData({
      name: (item.title || item.freeText || "").slice(0, 255),
      description: item.freeText?.trim() || null,
      aspectoJuego: item.aspecto ?? null,
    });
    setShowQuickCreate(true);
  }

  // Buscador de ejercicios (Biblioteca / Listas). Se abre dentro del bloque
  // en el que se pulsa "Añadir ejercicio" (o al elegir el ejercicio de una
  // estación), como en el formulario de clases, en vez de ocupar una columna
  // fija con toda la biblioteca.
  const stationsDraftPanel = (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-2 py-1.5">
      <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">
        {replacing?.target === "stations"
          ? tx("sustituirV1PorEstaciones", { v1: replacing.name })
          : "¿Cuántas?"}
      </span>
      <input
        type="number"
        min={STATION_COUNT_MIN}
        max={STATION_COUNT_MAX}
        value={stationsDraftCount}
        onChange={(e) => setStationsDraftCount(Number(e.target.value))}
        className="h-6 w-12 rounded-md border border-border bg-background px-1 text-xs text-center tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-brand/40"
      />
      <button
        type="button"
        onClick={confirmStationsDraft}
        className="rounded-md bg-foreground px-2 py-1 text-[10px] font-bold text-background transition-colors hover:bg-foreground/90"
      >
        {replacing?.target === "stations" ? "Sustituir" : "Crear"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStationsDraftPhase(null);
          setReplacing(null);
        }}
        className="text-[10px] text-muted-foreground hover:text-foreground"
      >
        {tx("cancelar")}
      </button>
    </div>
  );

  const sourcesPanel = (
    <div className="mt-3 flex flex-col rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
        <div className="inline-flex rounded-full border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setSourceTab("library")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              sourceTab === "library"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="size-3.5" />
            {tx("biblioteca")}
          </button>
          <button
            type="button"
            onClick={() => setSourceTab("lists")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              sourceTab === "lists"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="size-3.5" />
            {tx("listas")}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {sourceTab === "library" && filteredAvailable.length > 0 ? (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {tx("v1Disponibles", { v1: filteredAvailable.length })}</span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowQuickCreate(true)}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand bg-brand/10 hover:bg-brand/20 px-2 py-1 rounded-lg transition-colors"
          >
            <Plus className="size-3" />
            {tx("nuevo")}
          </button>
          <button
            type="button"
            onClick={() => {
              setPickerPhase(null);
              setPickingStation(null);
              setReplacing(null);
            }}
            aria-label={tx("cerrarBuscadorDeEjercicios")}
            title={tx("cerrar")}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {replacing?.target === "exercise" && !pickingStation && (
        <div className="flex items-center gap-2 border-b border-brand/30 bg-brand/10 px-3 py-2">
          <RefreshCw className="size-3.5 text-brand shrink-0" />
          <span className="min-w-0 truncate text-xs font-semibold text-foreground">
            {tx("eligeElEjercicioQue", { v1: replacing.name })}</span>
          <button
            type="button"
            onClick={() => {
              setReplacing(null);
              setPickerPhase(null);
            }}
            className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {tx("cancelar")}
          </button>
        </div>
      )}

      {pickingStation && (
        <div className="flex items-center gap-2 border-b border-brand/30 bg-brand/10 px-3 py-2">
          <LayoutGrid className="size-3.5 text-brand shrink-0" />
          <span className="text-xs font-semibold text-foreground">
            {tx("eligeUnEjercicioPara", { v1: pickingStation.stationIdx + 1 })}
          </span>
          <button
            type="button"
            onClick={() => {
              setPickingStation(null);
              setPickerPhase(null);
            }}
            className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {tx("cancelar")}
          </button>
        </div>
      )}

      {sourceTab === "lists" ? (
        <div className="flex-1 overflow-y-auto max-h-80">
          <SessionExerciseLists
            selectedExerciseIds={Array.from(selectedIds)}
            onApplyList={(items) => addExercisesFromList(items, activeAddPhase)}
          />
        </div>
      ) : (
        <>
          <div className="px-3 pt-2 pb-1.5 border-b border-border shrink-0">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tx("buscarEjercicios")}
                className="w-full h-8 pl-8 pr-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {["all", ...availableCategories].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setLibCategoryFilter(cat)}
                  className={cn(
                    "shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full transition-colors whitespace-nowrap",
                    libCategoryFilter === cat
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat === "all" ? "Todos" : (CATEGORY_LABELS[cat] ?? cat)}
                </button>
              ))}
            </div>
            <ExercisePickerFilters
              exercises={libraryExercises}
              value={pickerFilters}
              onChange={setPickerFilters}
              className="mt-2"
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/50 max-h-80">
            {filteredAvailable.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Filter className="size-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  {search ||
                  libCategoryFilter !== "all" ||
                  hasPickerFilters(pickerFilters)
                    ? tx("sinResultadosParaEse")
                    : libraryExercises.length === 0
                      ? tx("noHayEjerciciosEn")
                      : tx("todosLosEjerciciosEstan")}
                </p>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickCreate(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
                  >
                    <Plus className="size-3.5" />
                    {tx("crearEjercicioRapido")}
                  </button>
                  {refreshingLibrary ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {tx("actualizandoBiblioteca")}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              filteredAvailable.slice(0, VISIBLE_RESULTS).map((ex) => (
                <div
                  key={ex.id}
                  draggable
                  onDragStart={(e) => onLibraryDragStart(e, ex)}
                  className="group flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <div
                    className={cn(
                      "w-0.5 h-7 rounded-full shrink-0",
                      CATEGORY_BAR[ex.category] ?? "bg-muted"
                    )}
                  />
                  <GripVertical className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="flex items-start gap-1.5 text-sm font-medium text-foreground leading-snug">
                      <NextLink
                        href={pickExerciseHref(ex.id, pickerId, "sesion")}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={rememberPickTarget}
                        draggable={false}
                        title={tx("verLaFichaDel")}
                        className="min-w-0 break-words hover:text-brand hover:underline"
                      >
                        {ex.name}
                      </NextLink>
                      <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    </p>
                    <ExerciseQuickDescription text={ex.description} />
                    <span
                      className={cn(
                        "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                        CATEGORY_COLORS[ex.category] ??
                          "text-muted-foreground bg-muted"
                      )}
                    >
                      {CATEGORY_LABELS[ex.category] ?? ex.category}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="size-3" />
                    {ex.durationMinutes}{" "}{tx("min")}
                  </span>
                  <NextLink
                    href={pickExerciseHref(ex.id, pickerId, "sesion")}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      rememberPickTarget();
                    }}
                    title={tx("verFichaCompletaDel")}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <ExternalLink className="size-3.5" />
                  </NextLink>
                  <button
                    type="button"
                    onClick={() => {
                      if (pickingStation) {
                        setStationExercise(
                          pickingStation.itemIdx,
                          pickingStation.stationIdx,
                          ex
                        );
                      } else if (replacing?.target === "exercise") {
                        replaceAt(
                          replacing.idx,
                          exerciseItemFrom(ex, activeAddPhase)
                        );
                        setPickerPhase(null);
                      } else {
                        addExercise(ex, activeAddPhase);
                      }
                    }}
                    title={
                      pickingStation
                        ? tx("anadirAEstaEstacion")
                        : tx("anadirAV1", { v1: PHASE_LABELS[activeAddPhase] })
                    }
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand transition-colors hover:bg-brand/20",
                      pickingStation
                        ? "opacity-100"
                        : "sm:opacity-0 sm:group-hover:opacity-100"
                    )}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          {filteredAvailable.length > VISIBLE_RESULTS && (
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              {tx("mostrandoV1DeV2", { v1: VISIBLE_RESULTS, v2: filteredAvailable.length })}</p>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <Dialog
        open={showQuickCreate}
        onOpenChange={(open) =>
          open ? setShowQuickCreate(true) : closeQuickCreate()
        }
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {convertingItemKey
                ? tx("convertirEnFichaDe")
                : tx("crearEjercicioRapido")}
            </DialogTitle>
            <DialogDescription>
              {convertingItemKey
                ? tx("completaLaFichaA")
                : tx("creaUnEjercicioMinimo")}
            </DialogDescription>
          </DialogHeader>
          <ExerciseForm
            key={convertingItemKey ?? "new"}
            mode="create"
            initialFormMode="quick"
            enableDrafts={!convertingItemKey}
            draftQueryParam="exerciseDraft"
            initialData={quickCreateInitialData ?? undefined}
            onSuccess={handleQuickCreateSuccess}
            onCancel={closeQuickCreate}
          />
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <CourtsBoard
          state={state}
          update={update}
          places={places}
          onReplace={(idx) => startReplace(idx, "exercise")}
          phasePanel={(phase) =>
            pickerPhase === phase && !pickingStation ? sourcesPanel : null
          }
          onPickExercise={(phase, court) => {
            pendingCourtRef.current = court;
            setAddPhaseOverride(phase);
            setPickingStation(null);
            setReplacing(null);
            setSourceTab("library");
            setSearch("");
            setPickerPhase(phase);
          }}
        />
        {selected.length > 0 && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {timeParts.map((part) => (
                <span key={part.label}>
                  {term(part.label)}{" "}
                  <strong className="font-semibold text-foreground">
                    {formatMinutes(part.minutes)}
                  </strong>
                </span>
              ))}
            </span>
            <span className="text-sm font-bold text-foreground">
              {tx("totalV1", { v1: formatMinutes(totalDuration) })}
            </span>
          </div>
        )}

        <DetailsWhen when={state.courts === 2}>
        <div>
          {/* Los 3 bloques predefinidos */}
          <div className="flex flex-col gap-3">
            {PHASE_ORDER.map((phase) => {
              const blockEntries = grouped[phase];
              const blockDuration = blockEntries.reduce(
                (sum, { ex }) =>
                  sum + (ex.overrideDuration ?? ex.durationMinutes),
                0
              );

              return (
                <div
                  key={phase}
                  className="flex flex-col rounded-lg border border-foreground/10 bg-card shadow-sm shadow-black/5"
                >
                  <div className="flex items-center gap-3 px-4 pt-4 sm:px-5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                      {String(PHASE_ORDER.indexOf(phase) + 1).padStart(2, "0")}
                    </span>
                    <span className="font-heading text-lg text-foreground">
                      {term(PHASE_LABELS[phase])}
                    </span>
                    {blockDuration > 0 && (
                      <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-lg">
                        <Clock className="size-3" />
                        {formatMinutes(blockDuration)}
                      </span>
                    )}
                  </div>

                  <div
                    className="px-4 pb-4 pt-3 sm:px-5"
                    onDragOver={(e) => {
                      if (dragSrcIdx !== null) e.preventDefault();
                    }}
                    onDrop={(e) => onBlockEndDrop(e, phase)}
                  >
                    {blockEntries.length === 0 ? (
                      dragSrcIdx !== null ? (
                        <div className="w-full rounded-xl border-2 border-dashed border-brand bg-brand/5 py-4 text-center text-xs text-muted-foreground">
                          {tx("sueltaAquiParaMoverlo")}
                        </div>
                      ) : null
                    ) : (
                      <div className="space-y-1">
                        {blockEntries.map(({ ex, flatIdx }, localIdx) => {
                          const effectiveDuration =
                            ex.overrideDuration ?? ex.durationMinutes;
                          const isEditingDuration =
                            editingDurationIdx === flatIdx;
                          const isExpanded = expandedIdx === flatIdx;
                          const isDragging = dragSrcIdx === flatIdx;

                          return (
                            <div key={`${ex.exerciseId}-${flatIdx}`}>
                              <div
                                className={cn(
                                  "h-0.5 rounded-full transition-all mb-1",
                                  dragOverIdx === flatIdx
                                    ? "bg-brand"
                                    : "bg-transparent"
                                )}
                              />
                              <div
                                draggable={
                                  !isEditingDuration &&
                                  focusedTextIdx !== flatIdx &&
                                  replacing?.idx !== flatIdx
                                }
                                onDragStart={(e) =>
                                  !isEditingDuration &&
                                  focusedTextIdx !== flatIdx &&
                                  replacing?.idx !== flatIdx &&
                                  onTimelineDragStart(e, flatIdx)
                                }
                                onDragEnd={() => {
                                  setDragSrcIdx(null);
                                  setDragOverIdx(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDragOverIdx(flatIdx);
                                }}
                                onDragLeave={() => setDragOverIdx(null)}
                                onDrop={(e) =>
                                  onBlockItemDrop(e, phase, localIdx)
                                }
                                className={cn(
                                  "group bg-card border rounded-xl transition-all",
                                  isDragging
                                    ? "opacity-40 border-dashed border-border cursor-grabbing"
                                    : "border-border hover:border-brand/30 cursor-grab active:cursor-grabbing"
                                )}
                              >
                                {/* En el móvil: título y descripción a todo el ancho y
                                    los botones en una fila debajo. */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5 sm:flex-nowrap">
                                  <div
                                    className={cn(
                                      "w-0.5 h-8 rounded-full shrink-0",
                                      CATEGORY_BAR[ex.category] ?? "bg-muted"
                                    )}
                                  />
                                  <GripVertical className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 transition-colors" />
                                  <div className="min-w-0 flex-[1_1_calc(100%-3rem)] sm:flex-1">
                                    {isTextItem(ex) ? (
                                      <div className="space-y-1">
                                        <input
                                          type="text"
                                          value={ex.title ?? ""}
                                          onChange={(e) =>
                                            patchItem(flatIdx, {
                                              title: e.target.value,
                                            })
                                          }
                                          maxLength={120}
                                          placeholder={tx("tituloOpcional")}
                                          className="w-full cursor-text rounded-lg border border-transparent bg-transparent px-0.5 text-sm font-semibold leading-snug text-foreground placeholder:font-normal placeholder:text-muted-foreground/60 focus:border-brand/50 focus:bg-background focus:px-2 focus:py-1 focus:outline-none focus:ring-1 focus:ring-brand/40"
                                        />
                                        <textarea
                                          value={ex.freeText ?? ""}
                                          onChange={(e) =>
                                            patchItem(flatIdx, {
                                              freeText: e.target.value,
                                              name: e.target.value,
                                            })
                                          }
                                          onFocus={() =>
                                            setFocusedTextIdx(flatIdx)
                                          }
                                          onBlur={() => setFocusedTextIdx(null)}
                                          autoFocus={!ex.freeText && !ex.title}
                                          rows={2}
                                          maxLength={2000}
                                          placeholder={tx("escribeAquiExplicacionJuego")}
                                          className="field-sizing-content min-h-[2.75rem] w-full cursor-text resize-y rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm leading-snug text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/40"
                                        />
                                      </div>
                                    ) : isWarmupItem(ex) ? (
                                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate leading-snug">
                                        <Coffee className="size-3.5 text-sky-400 shrink-0" />
                                        {tx("descanso")}
                                      </p>
                                    ) : isStationsItem(ex) ? (
                                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate leading-snug">
                                        <LayoutGrid className="size-3.5 text-emerald-500 shrink-0" />
                                        {tx("estaciones2")}{ex.stations?.length ?? 0})
                                      </p>
                                    ) : (
                                      <p className="text-sm font-medium text-foreground line-clamp-2 break-words leading-snug">
                                        {ex.name}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span
                                        className={cn(
                                          "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                          isTextItem(ex)
                                            ? "text-foreground/70 bg-muted"
                                            : (CATEGORY_COLORS[ex.category] ??
                                                "text-muted-foreground bg-muted")
                                        )}
                                      >
                                        {isTextItem(ex)
                                          ? ex.overrideDuration === null
                                            ? "Anotación"
                                            : "Actividad"
                                          : (CATEGORY_LABELS[ex.category] ??
                                            ex.category)}
                                      </span>
                                    </div>
                                    {!isTextItem(ex) &&
                                      !isWarmupItem(ex) &&
                                      !isStationsItem(ex) && (
                                        <ExerciseQuickDescription
                                          className="mt-1"
                                          text={
                                            libraryExercises.find(
                                              (lib) => lib.id === ex.exerciseId
                                            )?.description
                                          }
                                        />
                                      )}
                                  </div>

                                  <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                                    {isEditingDuration ? (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <input
                                          ref={durationInputRef}
                                          type="number"
                                          min={1}
                                          max={300}
                                          value={durationEditValue}
                                          onChange={(e) =>
                                            setDurationEditValue(e.target.value)
                                          }
                                          onBlur={() =>
                                            commitDurationEdit(flatIdx)
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              commitDurationEdit(flatIdx);
                                            }
                                            if (e.key === "Escape")
                                              setEditingDurationIdx(null);
                                          }}
                                          className="w-14 h-7 text-xs text-center bg-background border border-brand/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/40"
                                        />
                                        <span className="text-xs text-muted-foreground">
                                          {tx("min")}
                                        </span>
                                      </div>
                                    ) : isTextItem(ex) &&
                                      ex.overrideDuration === null ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          startEditDuration(flatIdx)
                                        }
                                        title={tx("ponerDuracionSeConvierte")}
                                        className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors shrink-0 px-1.5 py-1 rounded-lg hover:bg-muted"
                                      >
                                        <Clock className="size-3" />
                                        <span>{tx("sinDuracion")}</span>
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            startEditDuration(flatIdx)
                                          }
                                          title={
                                            isStationsItem(ex)
                                              ? tx("duracionTotalDeLas")
                                              : "Editar duración"
                                          }
                                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-lg hover:bg-muted group/dur"
                                        >
                                          <Clock className="size-3" />
                                          <span>
                                            {tx("v1MinV2", { v1: effectiveDuration, v2: isStationsItem(ex)
                                              ? tx("inTotalSuffix")
                                              : "" })}
                                          </span>
                                          <ChevronDown className="size-2.5 opacity-0 group-hover/dur:opacity-100 transition-opacity" />
                                        </button>
                                        {isTextItem(ex) && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              patchItem(flatIdx, {
                                                overrideDuration: null,
                                              })
                                            }
                                            title={tx("quitarDuracionQuedaComo")}
                                            className="flex size-5 items-center justify-center rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                          >
                                            <X className="size-3" />
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {!isTextItem(ex) &&
                                      !isWarmupItem(ex) &&
                                      !isStationsItem(ex) && (
                                        <NextLink
                                          href={`/exercises/${ex.exerciseId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          draggable={false}
                                          onClick={(e) => e.stopPropagation()}
                                          title={tx("verLaFichaCompleta")}
                                          aria-label={tx("verLaFichaCompleta2")}
                                          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                          <ExternalLink className="size-3.5" />
                                        </NextLink>
                                      )}

                                    {onAutoChange && canAutoChange?.(ex) && (
                                      <button
                                        type="button"
                                        onClick={() => onAutoChange(flatIdx)}
                                        disabled={autoChangingIdx !== null}
                                        title={tx("cambiarPorOtroEjercicio")}
                                        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                                      >
                                        {autoChangingIdx === flatIdx ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <Shuffle className="size-3" />
                                        )}
                                        <span className="hidden sm:inline">
                                          {tx("cambiar")}
                                        </span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReplaceMenuIdx(
                                          replaceMenuIdx === flatIdx
                                            ? null
                                            : flatIdx
                                        )
                                      }
                                      aria-expanded={replaceMenuIdx === flatIdx}
                                      title={tx("sustituirPorOtroEjercicio")}
                                      className={cn(
                                        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold transition-colors",
                                        replaceMenuIdx === flatIdx ||
                                          replacing?.idx === flatIdx
                                          ? "bg-brand/15 text-foreground"
                                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                      )}
                                    >
                                      <RefreshCw className="size-3" />
                                      <span className="hidden sm:inline">
                                        {tx("sustituir")}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedIdx(
                                          isExpanded ? null : flatIdx
                                        )
                                      }
                                      title={tx("ajustes")}
                                      className={cn(
                                        "size-6 rounded-md flex items-center justify-center transition-colors shrink-0",
                                        isExpanded || ex.notes || ex.aspecto
                                          ? "text-brand bg-brand/10"
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100"
                                      )}
                                    >
                                      <StickyNote className="size-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeExercise(ex.exerciseId)
                                      }
                                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {replacing?.idx === flatIdx && (
                                  <div
                                    ref={replacePanelRef}
                                    className="scroll-mt-24 border-t border-border/40 px-3 pb-3 pt-2"
                                  >
                                    {replacing.target === "exercise"
                                      ? state.courts === 2
                                        ? null
                                        : sourcesPanel
                                      : stationsDraftPhase
                                        ? stationsDraftPanel
                                        : null}
                                  </div>
                                )}

                                {replaceMenuIdx === flatIdx && (
                                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 px-3 py-2">
                                    <span className="text-[11px] font-semibold text-muted-foreground">
                                      {tx("sustituirPor")}
                                    </span>
                                    {(
                                      [
                                        ["exercise", "Ejercicio", Dumbbell],
                                        ["text", "Texto", Type],
                                        ["warmup", "Descanso", Coffee],
                                        ["stations", "Estaciones", LayoutGrid],
                                      ] as const
                                    ).map(([kind, label, Icon]) => (
                                      <button
                                        key={kind}
                                        type="button"
                                        onClick={() =>
                                          startReplace(flatIdx, kind)
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:border-brand/50 hover:bg-brand/10"
                                      >
                                        <Icon className="size-3" />
                                        {label}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setReplaceMenuIdx(null)}
                                      className="ml-auto text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                                    >
                                      {tx("cancelar")}
                                    </button>
                                  </div>
                                )}

                                {isStationsItem(ex) && (
                                  <div className="px-3 pb-3 border-t border-border/40 pt-3 space-y-2.5">
                                    <textarea
                                      rows={1}
                                      value={ex.freeText ?? ""}
                                      onChange={(e) =>
                                        patchItem(flatIdx, {
                                          freeText: e.target.value,
                                        })
                                      }
                                      placeholder={tx("explicaElEjercicioDe")}
                                      className="field-sizing-content w-full resize-none rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/40"
                                    />
                                    <ul className="space-y-2">
                                      {(ex.stations ?? []).map(
                                        (station, stationIdx) => {
                                          const stationsCount =
                                            ex.stations?.length ?? 0;
                                          const isStationDragOver =
                                            dragOverStation?.itemIdx ===
                                              flatIdx &&
                                            dragOverStation?.stationIdx ===
                                              stationIdx;
                                          return (
                                            <li
                                              key={stationIdx}
                                              onDragOver={(e) => {
                                                if (
                                                  e.dataTransfer.types.includes(
                                                    "exercise-id"
                                                  )
                                                ) {
                                                  e.preventDefault();
                                                  setDragOverStation({
                                                    itemIdx: flatIdx,
                                                    stationIdx,
                                                  });
                                                }
                                              }}
                                              onDragLeave={() =>
                                                setDragOverStation((current) =>
                                                  current?.itemIdx ===
                                                    flatIdx &&
                                                  current.stationIdx ===
                                                    stationIdx
                                                    ? null
                                                    : current
                                                )
                                              }
                                              onDrop={(e) =>
                                                onStationDrop(
                                                  e,
                                                  flatIdx,
                                                  stationIdx
                                                )
                                              }
                                              className={cn(
                                                "flex items-start gap-2 rounded-lg border p-2 transition-colors",
                                                isStationDragOver
                                                  ? "border-brand bg-brand/10"
                                                  : "border-border/60 bg-muted/20"
                                              )}
                                            >
                                              <span className="pt-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground tabular-nums">
                                                {String(
                                                  stationIdx + 1
                                                ).padStart(2, "0")}
                                              </span>
                                              <div className="flex-1 min-w-0 space-y-1.5">
                                                <div className="flex gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setPickingStation({
                                                        itemIdx: flatIdx,
                                                        stationIdx,
                                                      });
                                                      setSourceTab("library");
                                                      setPickerPhase(phase);
                                                    }}
                                                    className={cn(
                                                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                                                      station.kind ===
                                                        "exercise"
                                                        ? "border-brand/40 bg-brand/10 text-brand"
                                                        : "border-border text-muted-foreground hover:border-brand/40"
                                                    )}
                                                  >
                                                    {tx("ejercicio")}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      updateStation(
                                                        flatIdx,
                                                        stationIdx,
                                                        {
                                                          kind: "text",
                                                          exerciseId: null,
                                                          name: "",
                                                        }
                                                      )
                                                    }
                                                    className={cn(
                                                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                                                      station.kind === "text"
                                                        ? "border-brand/40 bg-brand/10 text-brand"
                                                        : "border-border text-muted-foreground hover:border-brand/40"
                                                    )}
                                                  >
                                                    {tx("textoLibre")}
                                                  </button>
                                                </div>
                                                {station.kind === "exercise" ? (
                                                  <div className="flex items-center gap-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setPickingStation({
                                                          itemIdx: flatIdx,
                                                          stationIdx,
                                                        });
                                                        setSourceTab("library");
                                                        setPickerPhase(phase);
                                                      }}
                                                      className={cn(
                                                        "min-w-0 flex-1 truncate text-left text-xs hover:text-brand",
                                                        pickingStation?.itemIdx ===
                                                          flatIdx &&
                                                          pickingStation?.stationIdx ===
                                                            stationIdx
                                                          ? "font-semibold text-brand"
                                                          : "text-foreground"
                                                      )}
                                                    >
                                                      {pickingStation?.itemIdx ===
                                                        flatIdx &&
                                                      pickingStation?.stationIdx ===
                                                        stationIdx
                                                        ? tx("eligeEnLaBiblioteca")
                                                        : station.name || (
                                                            <span className="italic text-muted-foreground">
                                                              {tx("eligeUnEjercicio")}
                                                            </span>
                                                          )}
                                                    </button>
                                                    {station.exerciseId && (
                                                      <NextLink
                                                        href={`/exercises/${station.exerciseId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) =>
                                                          e.stopPropagation()
                                                        }
                                                        title={tx("verFichaCompletaDel")}
                                                        className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                                      >
                                                        <ExternalLink className="size-3" />
                                                      </NextLink>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <textarea
                                                    rows={1}
                                                    value={station.freeText}
                                                    onChange={(e) =>
                                                      updateStation(
                                                        flatIdx,
                                                        stationIdx,
                                                        {
                                                          freeText:
                                                            e.target.value,
                                                        }
                                                      )
                                                    }
                                                    placeholder={tx("describeLaEstacion")}
                                                    className="w-full resize-none rounded-lg border-0 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground"
                                                  />
                                                )}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeStation(
                                                    flatIdx,
                                                    stationIdx
                                                  )
                                                }
                                                disabled={
                                                  stationsCount <=
                                                  STATION_COUNT_MIN
                                                }
                                                title={
                                                  stationsCount <=
                                                  STATION_COUNT_MIN
                                                    ? tx("minimoV1Estaciones", { v1: STATION_COUNT_MIN })
                                                    : "Quitar estación"
                                                }
                                                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                                              >
                                                <X className="size-3.5" />
                                              </button>
                                            </li>
                                          );
                                        }
                                      )}
                                    </ul>
                                    <button
                                      type="button"
                                      onClick={() => addStation(flatIdx)}
                                      disabled={
                                        (ex.stations?.length ?? 0) >=
                                        STATION_COUNT_MAX
                                      }
                                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand hover:text-brand/80 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-brand"
                                    >
                                      <Plus className="size-3" />
                                      {tx("anadirEstacion")}
                                      {(ex.stations?.length ?? 0) >=
                                        STATION_COUNT_MAX &&
                                        ` (máximo ${STATION_COUNT_MAX})`}
                                    </button>
                                  </div>
                                )}

                                {isExpanded && (
                                  <div className="px-3 pb-3 border-t border-border/40 pt-3 space-y-3">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                        {tx("bloque")}
                                      </label>
                                      <div className="flex flex-wrap gap-1.5">
                                        {PHASE_ORDER.map((p) => (
                                          <button
                                            key={p}
                                            type="button"
                                            onClick={() =>
                                              moveItemToPhase(flatIdx, p)
                                            }
                                            className={cn(
                                              "h-7 px-2.5 text-[10px] font-semibold rounded-full border transition-colors",
                                              phase === p
                                                ? "bg-brand text-brand-foreground border-brand"
                                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                                            )}
                                          >
                                            {term(PHASE_LABELS[p])}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {isTextItem(ex) && (
                                      <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                            {tx("esUnEjercicio")}
                                          </label>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openQuickCreateFromText(ex)
                                            }
                                            disabled={
                                              !ex.freeText?.trim() &&
                                              !ex.title?.trim()
                                            }
                                            className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand transition-colors hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                            <Plus className="size-3" />
                                            {tx("crearFichaDeEjercicio")}
                                          </button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                          {tx("siNoDinosAl")}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {ASPECTO_JUEGO_VALUES.map((a) => (
                                            <button
                                              key={a}
                                              type="button"
                                              onClick={() =>
                                                patchItem(flatIdx, {
                                                  aspecto:
                                                    ex.aspecto === a ? null : a,
                                                })
                                              }
                                              className={cn(
                                                "h-6 px-2 text-[10px] font-semibold rounded-full border transition-colors",
                                                ex.aspecto === a
                                                  ? "bg-foreground text-background border-foreground"
                                                  : "bg-background border-border text-muted-foreground hover:text-foreground"
                                              )}
                                            >
                                              {term(ASPECTO_JUEGO_LABELS[a])}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    <textarea
                                      value={ex.notes}
                                      onChange={(e) =>
                                        patchItem(flatIdx, {
                                          notes: e.target.value,
                                        })
                                      }
                                      placeholder={
                                        isTextItem(ex)
                                          ? "Notas…"
                                          : tx("notasParaEsteEjercicio")
                                      }
                                      rows={2}
                                      className="w-full text-xs bg-muted/40 border border-border/50 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground resize-none"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Acciones para añadir directamente a este bloque */}
                    {stationsDraftPhase === phase &&
                    replacing?.target !== "stations" ? (
                      stationsDraftPanel
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            pendingCourtRef.current = null;
                            setAddPhaseOverride(phase);
                            setPickingStation(null);
                            setReplacing(null);
                            setSourceTab("library");
                            setSearch("");
                            setPickerPhase((current) =>
                              current === phase ? null : phase
                            );
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
                            pickerPhase === phase && !pickingStation
                              ? "border-brand/60 bg-brand/10 text-brand"
                              : "border-border bg-background text-foreground hover:border-brand/50 hover:bg-brand/10"
                          )}
                        >
                          <Dumbbell className="size-3" />
                          {tx("anadirEjercicio")}
                        </button>
                        <button
                          type="button"
                          onClick={() => addTextItem(phase)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:border-brand/50 hover:bg-brand/10"
                        >
                          <Type className="size-3" />
                          {tx("textoLibre")}
                        </button>
                        <button
                          type="button"
                          onClick={() => addWarmupItem(phase)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:border-brand/50 hover:bg-brand/10"
                        >
                          <Coffee className="size-3" />
                          {tx("descanso")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStationsDraftPhase(phase);
                            setStationsDraftCount(4);
                          }}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:border-brand/50 hover:bg-brand/10"
                        >
                          <LayoutGrid className="size-3" />
                          {tx("estaciones")}
                        </button>
                      </div>
                    )}

                    {state.courts !== 2 &&
                      pickerPhase === phase &&
                      replacing?.target !== "exercise" &&
                      sourcesPanel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </DetailsWhen>
      </div>
    </>
  );
}
