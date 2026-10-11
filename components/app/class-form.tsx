"use client";

import { useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Loader2,
  GraduationCap,
  Plus,
  X,
  ChevronDown,
  Type,
  Dumbbell,
  GripVertical,
  ExternalLink,
  Coffee,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  emptyStationDraft,
  STATION_COUNT_MAX,
  STATION_COUNT_MIN,
  type StationDraftItem,
} from "@/lib/block-items";
import { AUTORIAS, nivelesForSport } from "@/lib/exercise-taxonomy";
import { SessionExerciseLists } from "@/components/app/session-exercise-lists";

function nivelOptionsForSport(sport?: string | null) {
  return nivelesForSport(sport).map((n) => ({
    id: n.id,
    label: n.edad ? `${n.label} (${n.edad.replace(" años", "")})` : n.label,
  }));
}

const ASPECTOS = [
  { id: "tecnica", label: "Técnica" },
  { id: "tactica", label: "Táctica" },
  { id: "mental", label: "Mental / cognitivo" },
  { id: "fisico", label: "Físico / movilidad" },
];

const GOLPES = [
  { id: "derecha", label: "Derecha" },
  { id: "reves", label: "Reves" },
  { id: "saque", label: "Saque" },
  { id: "volea", label: "Volea" },
  { id: "remate", label: "Remate" },
  { id: "dejada", label: "Dejada" },
  { id: "globo", label: "Globo" },
];

const DURACIONES = [30, 45, 60, 75, 90, 120];

const BLOCK_TITLES = [
  { idx: 1, label: "Bloque inicial" },
  { idx: 2, label: "Bloque principal" },
  { idx: 3, label: "Bloque final" },
];

interface AvailableExercise {
  id: string;
  name: string;
  category: string;
  description?: string | null;
}

type BlockItem =
  | {
      kind: "exercise";
      exerciseId: string;
      name: string;
      durationMinutes: number | null;
    }
  | { kind: "text"; freeText: string; durationMinutes: number | null }
  | { kind: "warmup"; durationMinutes: number | null }
  | {
      kind: "stations";
      introText: string;
      stations: StationDraftItem[];
      /** Duración por estación (la misma para todas), no la suma. */
      durationMinutes: number | null;
    };

interface BlockState {
  orderIndex: number;
  title: string;
  notes: string;
  items: BlockItem[];
}

export interface ClassInitialData {
  name: string;
  duracionMinutes: number;
  alumnosTipo: "individual" | "grupal" | null;
  numAlumnos: number | null;
  nivel: string | null;
  niveles: string[] | null;
  aspectoJuego: string | null;
  aspectosJuego: string[] | null;
  golpes: string[] | null;
  objetivos: string | null;
  material: string | null;
  videoUrl: string | null;
  aspectosImportantes: string | null;
  isLibrary: boolean;
  autoria?: string | null;
  status?: "draft" | "published";
  blocks: {
    orderIndex: number;
    title: string | null;
    notes: string | null;
    items: BlockItem[];
  }[];
}

export interface ClassFormProps {
  mode: "create" | "edit";
  classId?: string;
  availableExercises: AvailableExercise[];
  isAdmin?: boolean;
  initialData?: ClassInitialData;
  sport?: string | null;
}

export function ClassForm({
  mode,
  classId,
  availableExercises,
  isAdmin = false,
  initialData,
  sport,
}: ClassFormProps) {
  const router = useRouter();
  const NIVELES = nivelOptionsForSport(sport);
  const [name, setName] = useState(initialData?.name ?? "");
  const [duracionMinutes, setDuracionMinutes] = useState<number>(
    initialData?.duracionMinutes ?? 60
  );
  const [alumnosTipo, setAlumnosTipo] = useState<"individual" | "grupal" | "">(
    initialData?.alumnosTipo ?? ""
  );
  const [numAlumnos, setNumAlumnos] = useState<number | "">(
    initialData?.numAlumnos ?? ""
  );
  const [niveles, setNiveles] = useState<string[]>(
    initialData?.niveles && initialData.niveles.length > 0
      ? initialData.niveles
      : initialData?.nivel
        ? [initialData.nivel]
        : []
  );
  const [aspectosJuego, setAspectosJuego] = useState<string[]>(
    initialData?.aspectosJuego && initialData.aspectosJuego.length > 0
      ? initialData.aspectosJuego
      : initialData?.aspectoJuego
        ? [initialData.aspectoJuego]
        : []
  );
  const [golpes, setGolpes] = useState<string[]>(initialData?.golpes ?? []);
  const [objetivos, setObjetivos] = useState(initialData?.objetivos ?? "");
  const [material, setMaterial] = useState(initialData?.material ?? "");
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl ?? "");
  const [aspectosImportantes, setAspectosImportantes] = useState(
    initialData?.aspectosImportantes ?? ""
  );
  const [isLibrary, setIsLibrary] = useState(initialData?.isLibrary ?? false);
  const [autoria, setAutoria] = useState(initialData?.autoria ?? "libre");
  const isDraft = initialData?.status === "draft";

  const [blocks, setBlocks] = useState<BlockState[]>(() => {
    const base = BLOCK_TITLES.map((b) => ({
      orderIndex: b.idx,
      title: b.label,
      notes: "",
      items: [] as BlockItem[],
    }));
    if (!initialData?.blocks) return base;
    // Map initial blocks por orderIndex sobre la base.
    return base.map((b) => {
      const found = initialData.blocks.find(
        (ib) => ib.orderIndex === b.orderIndex
      );
      if (!found) return b;
      return {
        ...b,
        title: found.title ?? b.title,
        notes: found.notes ?? "",
        items: found.items,
      };
    });
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [pickerSourceTab, setPickerSourceTab] = useState<"search" | "lists">(
    "search"
  );

  function updateBlock(idx: number, patch: Partial<BlockState>) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === idx ? { ...b, ...patch } : b))
    );
  }

  function addExerciseToBlock(blockIdx: number, ex: AvailableExercise) {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
              ...b,
              items: [
                ...b.items,
                {
                  kind: "exercise" as const,
                  exerciseId: ex.id,
                  name: ex.name,
                  durationMinutes: null,
                },
              ],
            }
          : b
      )
    );
    setPickerOpen(null);
    setSearch("");
  }

  function addExercisesToBlock(blockIdx: number, list: AvailableExercise[]) {
    if (list.length === 0) return;
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
              ...b,
              items: [
                ...b.items,
                ...list.map((ex) => ({
                  kind: "exercise" as const,
                  exerciseId: ex.id,
                  name: ex.name,
                  durationMinutes: null,
                })),
              ],
            }
          : b
      )
    );
  }

  function addTextToBlock(blockIdx: number) {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
              ...b,
              items: [
                ...b.items,
                { kind: "text" as const, freeText: "", durationMinutes: null },
              ],
            }
          : b
      )
    );
  }

  function addWarmupToBlock(blockIdx: number) {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
              ...b,
              items: [
                ...b.items,
                { kind: "warmup" as const, durationMinutes: null },
              ],
            }
          : b
      )
    );
  }

  const [stationsDraftBlock, setStationsDraftBlock] = useState<number | null>(
    null
  );
  const [stationsDraftCount, setStationsDraftCount] = useState(4);

  function confirmStationsDraft() {
    if (stationsDraftBlock === null) return;
    const n = Math.min(
      STATION_COUNT_MAX,
      Math.max(STATION_COUNT_MIN, stationsDraftCount)
    );
    const blockIdx = stationsDraftBlock;
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
              ...b,
              items: [
                ...b.items,
                {
                  kind: "stations" as const,
                  introText: "",
                  stations: Array.from({ length: n }, emptyStationDraft),
                  durationMinutes: 5,
                },
              ],
            }
          : b
      )
    );
    setStationsDraftBlock(null);
    setStationsDraftCount(4);
  }

  function updateStation(
    blockIdx: number,
    itemIdx: number,
    stationIdx: number,
    patch: Partial<StationDraftItem>
  ) {
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== blockIdx) return b;
        return {
          ...b,
          items: b.items.map((it, j) => {
            if (j !== itemIdx || it.kind !== "stations") return it;
            return {
              ...it,
              stations: it.stations.map((s, k) =>
                k === stationIdx ? { ...s, ...patch } : s
              ),
            };
          }),
        };
      })
    );
  }

  /** Estación para la que se está eligiendo un ejercicio desde la Biblioteca. */
  const [stationPickerTarget, setStationPickerTarget] = useState<{
    blockIdx: number;
    itemIdx: number;
    stationIdx: number;
  } | null>(null);

  function setStationExercise(
    blockIdx: number,
    itemIdx: number,
    stationIdx: number,
    ex: AvailableExercise
  ) {
    updateStation(blockIdx, itemIdx, stationIdx, {
      kind: "exercise",
      exerciseId: ex.id,
      name: ex.name,
    });
    setStationPickerTarget(null);
    setSearch("");
  }

  function removeItem(blockIdx: number, itemIdx: number) {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? { ...b, items: b.items.filter((_, j) => j !== itemIdx) }
          : b
      )
    );
  }

  function updateItem(
    blockIdx: number,
    itemIdx: number,
    patch: Partial<BlockItem>
  ) {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? {
              ...b,
              items: b.items.map((it, j) =>
                j === itemIdx ? ({ ...it, ...patch } as BlockItem) : it
              ),
            }
          : b
      )
    );
  }

  function moveItem(
    fromBlock: number,
    fromIdx: number,
    toBlock: number,
    toIdx: number
  ) {
    setBlocks((prev) => {
      if (fromBlock === toBlock && fromIdx === toIdx) return prev;
      const next = prev.map((b) => ({ ...b, items: [...b.items] }));
      const [moved] = next[fromBlock].items.splice(fromIdx, 1);
      // Si vamos hacia abajo en el mismo bloque, ajustar índice porque ya quitamos uno antes
      const targetIdx =
        fromBlock === toBlock && fromIdx < toIdx ? toIdx - 1 : toIdx;
      next[toBlock].items.splice(targetIdx, 0, moved);
      return next;
    });
  }

  const [dragSource, setDragSource] = useState<{
    blockIdx: number;
    itemIdx: number;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    blockIdx: number;
    itemIdx: number;
  } | null>(null);

  function handleDragStart(e: DragEvent, blockIdx: number, itemIdx: number) {
    e.dataTransfer.setData("text/plain", `${blockIdx}:${itemIdx}`);
    e.dataTransfer.effectAllowed = "move";
    setDragSource({ blockIdx, itemIdx });
  }

  function handleDragEnd() {
    setDragSource(null);
    setDragOverTarget(null);
  }

  function handleDragOverItem(e: DragEvent, blockIdx: number, itemIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget({ blockIdx, itemIdx });
  }

  function handleDropOnItem(e: DragEvent, blockIdx: number, itemIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const [fromB, fromI] = data.split(":").map(Number);
    moveItem(fromB, fromI, blockIdx, itemIdx);
    handleDragEnd();
  }

  function handleDropOnBlockEnd(e: DragEvent, blockIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    const [fromB, fromI] = data.split(":").map(Number);
    moveItem(fromB, fromI, blockIdx, blocks[blockIdx].items.length);
    handleDragEnd();
  }

  function toggleGolpe(id: string) {
    setGolpes((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  function toggleNivel(id: string) {
    // El nivel es de selección única: al pulsar uno se sustituye el anterior;
    // si ya estaba seleccionado, se deselecciona.
    setNiveles((prev) => (prev[0] === id ? [] : [id]));
  }

  function toggleAspecto(id: string) {
    setAspectosJuego((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // El botón pulsado decide si se guarda como borrador o se publica.
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const status =
      submitter instanceof HTMLButtonElement && submitter.value === "draft"
        ? "draft"
        : "published";
    if (!name.trim()) {
      setError("El nombre de la clase es obligatorio.");
      return;
    }

    setSubmitting(true);
    const payload = {
      name: name.trim(),
      duracionMinutes,
      alumnosTipo: alumnosTipo || null,
      numAlumnos: numAlumnos === "" ? null : Number(numAlumnos),
      objetivos: objetivos.trim() || null,
      material: material.trim() || null,
      videoUrl: videoUrl.trim() || null,
      aspectosImportantes: aspectosImportantes.trim() || null,
      nivel: niveles[0] ?? null,
      niveles: niveles.length > 0 ? niveles : null,
      aspectoJuego: aspectosJuego[0] ?? null,
      aspectosJuego: aspectosJuego.length > 0 ? aspectosJuego : null,
      golpes: golpes.length > 0 ? golpes : null,
      isLibrary: isAdmin ? isLibrary : false,
      autoria: isAdmin ? autoria : undefined,
      status,
      blocks: blocks
        .filter((b) => b.items.length > 0 || b.notes.trim())
        .map((b) => ({
          orderIndex: b.orderIndex,
          title: b.title.trim() || null,
          notes: b.notes.trim() || null,
          items: b.items.map((item) => {
            if (item.kind === "exercise") {
              return {
                kind: "exercise" as const,
                exerciseId: item.exerciseId,
                freeText: null,
                durationMinutes: item.durationMinutes,
              };
            }
            if (item.kind === "warmup") {
              return {
                kind: "warmup" as const,
                exerciseId: null,
                freeText: null,
                durationMinutes: item.durationMinutes,
              };
            }
            if (item.kind === "stations") {
              return {
                kind: "stations" as const,
                exerciseId: null,
                freeText: item.introText.trim() || null,
                durationMinutes: item.durationMinutes,
                stations: item.stations.map((s) =>
                  s.kind === "exercise"
                    ? {
                        kind: "exercise" as const,
                        exerciseId: s.exerciseId,
                        freeText: null,
                        durationMinutes: s.durationMinutes,
                      }
                    : {
                        kind: "text" as const,
                        exerciseId: null,
                        freeText: s.freeText.trim() || null,
                        durationMinutes: s.durationMinutes,
                      }
                ),
              };
            }
            return {
              kind: "text" as const,
              exerciseId: null,
              freeText: item.freeText.trim() || null,
              durationMinutes: item.durationMinutes,
            };
          }),
        })),
    };

    const url =
      mode === "edit" && classId ? `/api/classes/${classId}` : "/api/classes";
    const method = mode === "edit" ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data.error?.formErrors?.[0] ??
          data.error ??
          (mode === "edit"
            ? "No se pudo actualizar la clase."
            : "No se pudo crear la clase.")
      );
      setSubmitting(false);
      return;
    }

    if (mode === "edit") {
      router.push(`/classes/${classId}`);
    } else {
      const { data } = await res.json();
      router.push(`/classes/${data.id}`);
    }
    router.refresh();
  }

  const filteredExercises = (search: string) =>
    availableExercises.filter((e) =>
      e.name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Identidad */}
      <section className="space-y-5 rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
        <div className="flex items-center gap-3 border-b border-foreground/10 pb-4">
          <div className="flex size-9 items-center justify-center rounded-full border border-[#D6FF38]/40 bg-[#D6FF38]/12 text-[#D6FF38]">
            <GraduationCap className="size-4" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
              Datos de la clase
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Identidad, nivel y duración
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="block text-sm font-semibold text-foreground"
          >
            Nombre de la clase
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Derecha y revés verde"
            className="h-11 w-full rounded-lg border border-foreground/15 bg-background/70 px-4 text-sm font-medium text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground">
              Duración
            </label>
            <select
              value={duracionMinutes}
              onChange={(e) => setDuracionMinutes(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            >
              {DURACIONES.map((d) => (
                <option key={d} value={d}>
                  {d === 120 ? "Más de 90 min" : `${d} min`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-foreground">
              Tipo
            </label>
            <select
              value={alumnosTipo}
              onChange={(e) =>
                setAlumnosTipo(e.target.value as "individual" | "grupal" | "")
              }
              className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            >
              <option value="">— Selecciona —</option>
              <option value="individual">Individual</option>
              <option value="grupal">Grupal</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="numAlumnos"
              className="block text-sm font-semibold text-foreground"
            >
              Alumnos
            </label>
            <input
              id="numAlumnos"
              type="number"
              min={1}
              max={60}
              value={numAlumnos}
              onChange={(e) =>
                setNumAlumnos(e.target.value ? Number(e.target.value) : "")
              }
              placeholder="4"
              className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">
            Nivel{" "}
            <span className="font-normal text-muted-foreground">
              (elige uno)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {NIVELES.map((n) => {
              const active = niveles.includes(n.id);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => toggleNivel(n.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                    active
                      ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                      : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">
            Aspecto del juego{" "}
            <span className="font-normal text-muted-foreground">
              (puedes elegir varios)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ASPECTOS.map((a) => {
              const active = aspectosJuego.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAspecto(a.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                    active
                      ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                      : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">
            Golpes{" "}
            <span className="font-normal text-muted-foreground">
              (puedes elegir varios)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {GOLPES.map((g) => {
              const active = golpes.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGolpe(g.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                    active
                      ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                      : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Objetivos / Material / Vídeo */}
      <section className="space-y-5 rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
        <p className="border-b border-foreground/10 pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
          Contenido
        </p>

        <div className="space-y-1.5">
          <label
            htmlFor="objetivos"
            className="block text-sm font-semibold text-foreground"
          >
            Objetivos{" "}
            <span className="font-normal text-muted-foreground">
              (numera con 1) 2)…)
            </span>
          </label>
          <textarea
            id="objetivos"
            rows={4}
            maxLength={4000}
            value={objetivos}
            onChange={(e) => setObjetivos(e.target.value)}
            placeholder="1) preparar la raqueta antes del bote 2) terminar el golpe…"
            className="w-full resize-none rounded-lg border border-foreground/15 bg-background/70 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="material"
              className="block text-sm font-semibold text-foreground"
            >
              Material{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <textarea
              id="material"
              rows={3}
              maxLength={2000}
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Pelotas verdes, 9 aros, conos…"
              className="w-full resize-none rounded-lg border border-foreground/15 bg-background/70 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="videoUrl"
              className="block text-sm font-semibold text-foreground"
            >
              Vídeo{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <input
              id="videoUrl"
              type="url"
              maxLength={500}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
              className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
          </div>
        </div>
      </section>

      {/* Estructura por bloques */}
      <section className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
          Estructura por bloques
        </p>

        {blocks.map((block, blockIdx) => (
          <div
            key={block.orderIndex}
            className="space-y-4 rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                  {String(block.orderIndex).padStart(2, "0")}
                </span>
                <input
                  type="text"
                  maxLength={120}
                  value={block.title}
                  onChange={(e) =>
                    updateBlock(blockIdx, { title: e.target.value })
                  }
                  className="border-0 border-b border-transparent bg-transparent px-1 py-0.5 font-heading text-lg text-foreground transition-colors hover:border-foreground/20 focus:border-[#D6FF38] focus:outline-none"
                />
              </div>
            </div>

            {block.items.length > 0 && (
              <ul
                className="space-y-2"
                onDragOver={(e) => {
                  // permite drop sobre el bloque entero (cae al final si no toca un item)
                  if (dragSource) e.preventDefault();
                }}
                onDrop={(e) => handleDropOnBlockEnd(e, blockIdx)}
              >
                {block.items.map((item, itemIdx) => {
                  const isDraggingThis =
                    dragSource?.blockIdx === blockIdx &&
                    dragSource?.itemIdx === itemIdx;
                  const isDropTarget =
                    dragOverTarget?.blockIdx === blockIdx &&
                    dragOverTarget?.itemIdx === itemIdx &&
                    !isDraggingThis;
                  return (
                    <li
                      key={itemIdx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, blockIdx, itemIdx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) =>
                        handleDragOverItem(e, blockIdx, itemIdx)
                      }
                      onDrop={(e) => handleDropOnItem(e, blockIdx, itemIdx)}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border bg-muted/30 p-3 transition-colors",
                        isDraggingThis
                          ? "opacity-40 border-brand/40"
                          : isDropTarget
                            ? "border-brand/60 bg-brand/5"
                            : "border-foreground/10"
                      )}
                    >
                      <span
                        className="cursor-grab active:cursor-grabbing pt-1 text-muted-foreground/60 hover:text-foreground"
                        title="Arrastrar"
                      >
                        <GripVertical className="size-3.5" />
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums pt-1">
                        {String(itemIdx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        {item.kind === "exercise" ? (
                          <div className="flex items-center gap-2">
                            <Dumbbell className="size-3.5 text-brand shrink-0" />
                            <span className="text-sm text-foreground truncate">
                              {item.name}
                            </span>
                          </div>
                        ) : item.kind === "text" ? (
                          <div className="flex items-start gap-2">
                            <Type className="size-3.5 text-muted-foreground mt-1 shrink-0" />
                            <textarea
                              rows={2}
                              value={item.freeText}
                              onChange={(e) =>
                                updateItem(blockIdx, itemIdx, {
                                  kind: "text",
                                  freeText: e.target.value,
                                } as Partial<BlockItem>)
                              }
                              placeholder="Escribe la actividad…"
                              className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-foreground resize-none placeholder:text-muted-foreground"
                            />
                          </div>
                        ) : item.kind === "warmup" ? (
                          <div className="flex items-center gap-2">
                            <Coffee className="size-3.5 text-sky-500 shrink-0" />
                            <span className="text-sm font-medium text-foreground">
                              Descanso
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <LayoutGrid className="size-3.5 text-brand shrink-0" />
                              <span className="text-sm font-medium text-foreground">
                                Estaciones ({item.stations.length})
                              </span>
                            </div>
                            <textarea
                              rows={1}
                              value={item.introText}
                              onChange={(e) =>
                                updateItem(blockIdx, itemIdx, {
                                  introText: e.target.value,
                                } as Partial<BlockItem>)
                              }
                              placeholder="Explica el ejercicio de estaciones (opcional)…"
                              className="w-full resize-none rounded-lg border border-foreground/10 bg-background/60 px-2.5 py-1.5 text-xs text-foreground focus:border-[#D6FF38]/70 focus:outline-none placeholder:text-muted-foreground"
                            />
                            <ul className="space-y-2">
                              {item.stations.map((station, stationIdx) => (
                                <li
                                  key={stationIdx}
                                  className="flex items-start gap-2 rounded-lg border border-foreground/10 bg-background/40 p-2"
                                >
                                  <span className="pt-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground tabular-nums">
                                    {String(stationIdx + 1).padStart(2, "0")}
                                  </span>
                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStationPickerTarget({
                                            blockIdx,
                                            itemIdx,
                                            stationIdx,
                                          });
                                          setSearch("");
                                        }}
                                        className={cn(
                                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                                          station.kind === "exercise"
                                            ? "border-brand/40 bg-brand/10 text-brand"
                                            : "border-foreground/15 text-muted-foreground hover:border-brand/40"
                                        )}
                                      >
                                        Ejercicio
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateStation(
                                            blockIdx,
                                            itemIdx,
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
                                            : "border-foreground/15 text-muted-foreground hover:border-brand/40"
                                        )}
                                      >
                                        Texto libre
                                      </button>
                                    </div>
                                    {station.kind === "exercise" ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStationPickerTarget({
                                            blockIdx,
                                            itemIdx,
                                            stationIdx,
                                          });
                                          setSearch("");
                                        }}
                                        className={cn(
                                          "truncate text-left text-xs hover:text-brand",
                                          stationPickerTarget?.blockIdx ===
                                            blockIdx &&
                                            stationPickerTarget?.itemIdx ===
                                              itemIdx &&
                                            stationPickerTarget?.stationIdx ===
                                              stationIdx
                                            ? "font-semibold text-brand"
                                            : "text-foreground"
                                        )}
                                      >
                                        {stationPickerTarget?.blockIdx ===
                                          blockIdx &&
                                        stationPickerTarget?.itemIdx ===
                                          itemIdx &&
                                        stationPickerTarget?.stationIdx ===
                                          stationIdx
                                          ? "Elige en la Biblioteca ↓"
                                          : station.name || (
                                              <span className="italic text-muted-foreground">
                                                Elige un ejercicio…
                                              </span>
                                            )}
                                      </button>
                                    ) : (
                                      <textarea
                                        rows={1}
                                        value={station.freeText}
                                        onChange={(e) =>
                                          updateStation(
                                            blockIdx,
                                            itemIdx,
                                            stationIdx,
                                            { freeText: e.target.value }
                                          )
                                        }
                                        placeholder="Describe la estación…"
                                        className="w-full resize-none rounded-lg border-0 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground"
                                      />
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        <input
                          type="number"
                          min={1}
                          max={300}
                          placeholder="min"
                          title={
                            item.kind === "stations"
                              ? "Duración de cada estación"
                              : undefined
                          }
                          value={item.durationMinutes ?? ""}
                          onChange={(e) =>
                            updateItem(blockIdx, itemIdx, {
                              durationMinutes: e.target.value
                                ? Number(e.target.value)
                                : null,
                            } as Partial<BlockItem>)
                          }
                          className="h-8 w-16 rounded-lg border border-foreground/15 bg-background/70 px-2 text-xs tabular-nums text-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-1 focus:ring-[#D6FF38]/20"
                        />
                        {item.kind === "stations" && (
                          <span className="text-[9px] text-muted-foreground">
                            por estación
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(blockIdx, itemIdx)}
                        aria-label="Quitar"
                        className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Drop zone for empty block */}
            {block.items.length === 0 && dragSource && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnBlockEnd(e, blockIdx)}
                className="rounded-lg border-2 border-dashed border-[#D6FF38]/50 bg-[#D6FF38]/10 px-4 py-6 text-center text-xs font-semibold text-foreground"
              >
                Suelta aquí para mover al bloque {block.orderIndex}
              </div>
            )}

            {stationPickerTarget?.blockIdx === blockIdx ? (
              <div className="space-y-2 rounded-lg border border-[#D6FF38]/35 bg-[#D6FF38]/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Elige un ejercicio para la estación{" "}
                    {stationPickerTarget.stationIdx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStationPickerTarget(null);
                      setSearch("");
                    }}
                    className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Cerrar"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  placeholder="Buscar ejercicio…"
                  className="h-9 w-full rounded-lg border border-foreground/15 bg-background/80 px-3 text-sm text-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
                />
                <ul className="max-h-64 overflow-y-auto space-y-1">
                  {filteredExercises(search)
                    .slice(0, 30)
                    .map((ex) => (
                      <li
                        key={ex.id}
                        className="flex items-start gap-1 rounded-lg hover:bg-brand/10"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setStationExercise(
                              stationPickerTarget.blockIdx,
                              stationPickerTarget.itemIdx,
                              stationPickerTarget.stationIdx,
                              ex
                            )
                          }
                          className="min-w-0 flex-1 text-left px-3 py-2 text-sm transition-colors hover:text-brand text-foreground/80"
                        >
                          <span className="block truncate font-medium">
                            {ex.name}
                          </span>
                          {ex.description && (
                            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                              {ex.description}
                            </span>
                          )}
                        </button>
                        <NextLink
                          href={`/exercises/${ex.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Ver ficha completa del ejercicio"
                          className="mt-2 mr-2 shrink-0 text-muted-foreground hover:text-brand"
                        >
                          <ExternalLink className="size-3.5" />
                        </NextLink>
                      </li>
                    ))}
                  {filteredExercises(search).length === 0 && (
                    <li className="text-xs text-muted-foreground italic px-3 py-2">
                      Sin resultados.
                    </li>
                  )}
                </ul>
              </div>
            ) : pickerOpen === blockIdx ? (
              <div className="space-y-2 rounded-lg border border-[#D6FF38]/35 bg-[#D6FF38]/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-full border border-foreground/15 bg-background p-0.5">
                    <button
                      type="button"
                      onClick={() => setPickerSourceTab("search")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                        pickerSourceTab === "search"
                          ? "bg-[#050505] text-white dark:bg-white dark:text-[#050505]"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Buscar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerSourceTab("lists")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                        pickerSourceTab === "lists"
                          ? "bg-[#050505] text-white dark:bg-white dark:text-[#050505]"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Favoritos
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPickerOpen(null);
                      setSearch("");
                      setPickerSourceTab("search");
                    }}
                    className="size-8 shrink-0 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Cerrar"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {pickerSourceTab === "lists" ? (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-foreground/10 bg-background/60">
                    <SessionExerciseLists
                      selectedExerciseIds={block.items
                        .filter(
                          (
                            item
                          ): item is Extract<BlockItem, { kind: "exercise" }> =>
                            item.kind === "exercise"
                        )
                        .map((item) => item.exerciseId)}
                      onApplyList={(items) =>
                        addExercisesToBlock(blockIdx, items)
                      }
                      contextLabel="la clase"
                    />
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                      placeholder="Buscar ejercicio…"
                      className="h-9 w-full rounded-lg border border-foreground/15 bg-background/80 px-3 text-sm text-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
                    />
                    <ul className="max-h-64 overflow-y-auto space-y-1">
                      {filteredExercises(search)
                        .slice(0, 30)
                        .map((ex) => (
                          <li
                            key={ex.id}
                            className="flex items-start gap-1 rounded-lg hover:bg-brand/10"
                          >
                            <button
                              type="button"
                              onClick={() => addExerciseToBlock(blockIdx, ex)}
                              className="min-w-0 flex-1 text-left px-3 py-2 text-sm transition-colors hover:text-brand text-foreground/80"
                            >
                              <span className="block truncate font-medium">
                                {ex.name}
                              </span>
                              {ex.description && (
                                <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                                  {ex.description}
                                </span>
                              )}
                            </button>
                            <NextLink
                              href={`/exercises/${ex.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Ver ficha completa del ejercicio"
                              className="mt-2 mr-2 shrink-0 text-muted-foreground hover:text-brand"
                            >
                              <ExternalLink className="size-3.5" />
                            </NextLink>
                          </li>
                        ))}
                      {filteredExercises(search).length === 0 && (
                        <li className="text-xs text-muted-foreground italic px-3 py-2">
                          Sin resultados.
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            ) : stationsDraftBlock === blockIdx ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#D6FF38]/35 bg-[#D6FF38]/10 p-3">
                <label className="text-xs font-semibold text-foreground">
                  ¿Cuántas estaciones?
                </label>
                <input
                  type="number"
                  min={STATION_COUNT_MIN}
                  max={STATION_COUNT_MAX}
                  value={stationsDraftCount}
                  onChange={(e) =>
                    setStationsDraftCount(Number(e.target.value))
                  }
                  className="h-8 w-16 rounded-lg border border-foreground/15 bg-background/80 px-2 text-xs tabular-nums text-foreground focus:border-[#D6FF38]/70 focus:outline-none"
                />
                <span className="text-xs text-muted-foreground">
                  (de {STATION_COUNT_MIN} a {STATION_COUNT_MAX})
                </span>
                <button
                  type="button"
                  onClick={confirmStationsDraft}
                  className="rounded-full bg-[#050505] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#D6FF38] hover:text-[#050505]"
                >
                  Crear estaciones
                </button>
                <button
                  type="button"
                  onClick={() => setStationsDraftBlock(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(blockIdx);
                    setSearch("");
                    setPickerSourceTab("search");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-[#D6FF38]/50 hover:bg-[#D6FF38]/10"
                >
                  <Dumbbell className="size-3.5" /> Añadir ejercicio
                </button>
                <button
                  type="button"
                  onClick={() => addTextToBlock(blockIdx)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-[#D6FF38]/50 hover:bg-[#D6FF38]/10"
                >
                  <Type className="size-3.5" /> Texto libre
                </button>
                <button
                  type="button"
                  onClick={() => addWarmupToBlock(blockIdx)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-[#D6FF38]/50 hover:bg-[#D6FF38]/10"
                >
                  <Coffee className="size-3.5" /> Descanso
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStationsDraftBlock(blockIdx);
                    setStationsDraftCount(4);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-[#D6FF38]/50 hover:bg-[#D6FF38]/10"
                >
                  <LayoutGrid className="size-3.5" /> Estaciones
                </button>
              </div>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                <ChevronDown className="size-3" /> Notas del bloque
              </summary>
              <textarea
                rows={2}
                value={block.notes}
                onChange={(e) =>
                  updateBlock(blockIdx, { notes: e.target.value })
                }
                placeholder="Aspectos importantes de este bloque…"
                className="mt-2 w-full resize-none rounded-lg border border-foreground/15 bg-background/70 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-1 focus:ring-[#D6FF38]/20"
              />
            </details>
          </div>
        ))}
      </section>

      {/* Aspectos importantes */}
      <section className="space-y-3 rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
        <label
          htmlFor="aspectos"
          className="block text-sm font-semibold text-foreground"
        >
          Aspectos importantes y observaciones{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="aspectos"
          rows={4}
          maxLength={4000}
          value={aspectosImportantes}
          onChange={(e) => setAspectosImportantes(e.target.value)}
          placeholder="Información extra valiosa para quien imparta esta clase…"
          className="w-full resize-none rounded-lg border border-foreground/15 bg-background/70 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
        />

        {isAdmin && (
          <label className="flex items-center gap-2 text-sm pt-2">
            <input
              type="checkbox"
              checked={isLibrary}
              onChange={(e) => setIsLibrary(e.target.checked)}
              className="size-4 rounded border-foreground/20 text-[#D6FF38] focus:ring-[#D6FF38]/30"
            />
            <span className="text-foreground/80">
              Marcar como Biblioteca Ten Planner (visible para todos)
            </span>
          </label>
        )}

        {isAdmin && (
          <div className="space-y-1.5 pt-1">
            <label className="block text-sm font-semibold text-foreground">
              Autoría
            </label>
            <p className="text-xs text-muted-foreground">
              De quién es esta clase dentro de la biblioteca pública.
            </p>
            <div className="flex flex-wrap gap-2">
              {AUTORIAS.map(({ id, label }) => {
                const isSelected = (autoria ?? "libre") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAutoria(id)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-150",
                      isSelected
                        ? "border-[#D6FF38] bg-[#D6FF38]/10 text-[#6D7F00]"
                        : "border-foreground/15 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-foreground/10 pt-4">
        {/* El primer botón es el que usa Enter: en clases nuevas o en
            borrador, guarda como borrador para no publicar por accidente. */}
        {(mode === "create" || isDraft) && (
          <button
            type="submit"
            value="draft"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-5 py-2.5 text-sm font-semibold text-foreground/70 transition-all hover:border-foreground/30 hover:text-foreground active:scale-95 disabled:opacity-60"
          >
            {isDraft ? "Guardar borrador" : "Guardar como borrador"}
          </button>
        )}
        <button
          type="submit"
          value="published"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-6 py-2.5 text-sm font-bold text-[#050505] transition-all hover:bg-[#c8f52e] active:scale-95 disabled:opacity-60"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {mode === "edit" ? null : <Plus className="size-4" />}
          {mode === "edit"
            ? isDraft
              ? "Publicar clase"
              : "Guardar cambios"
            : "Crear clase"}
        </button>
      </div>
    </form>
  );
}
