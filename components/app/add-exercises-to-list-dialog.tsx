"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_PICKER_FILTERS,
  ExercisePickerFilters,
  hasPickerFilters,
  type PickerFilters,
} from "@/components/app/exercise-picker-filters";
import { ExerciseQuickDescription } from "@/components/app/exercise-quick-description";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 40;

export interface ListableExercise {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  imageUrl: string | null;
  description?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

/**
 * Añadir ejercicios directamente a una colección (lista de favoritos) sin
 * tener que ir a la ficha de cada ejercicio: se busca por nombre y se pulsa
 * para añadir o quitar.
 */
export function AddExercisesToListDialog({
  open,
  onOpenChange,
  listId,
  listName,
  currentIds,
  sport,
  onAdded,
  onRemoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listName: string;
  /** Ids de los ejercicios que ya están en la colección. */
  currentIds: string[];
  /** Deporte activo, para ofrecer sus niveles en el filtro. */
  sport?: string | null;
  onAdded: (exercise: ListableExercise) => void;
  onRemoved: (exerciseId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListableExercise[]>([]);
  const [filters, setFilters] = useState<PickerFilters>(EMPTY_PICKER_FILTERS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const inList = new Set(currentIds);

  // Al cambiar la búsqueda o los filtros se vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  useEffect(() => {
    if (!open) return;
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setLoadError(false);
        try {
          const params = new URLSearchParams({
            limit: String(PAGE_SIZE),
            page: String(page),
          });
          const q = query.trim();
          if (q) params.set("search", q);
          if (filters.nivel) params.append("nivel", filters.nivel);
          if (filters.fase) params.set("phase", filters.fase);
          if (filters.aspecto) params.append("aspectoJuego", filters.aspecto);
          if (filters.golpe) params.append("golpe", filters.golpe);
          const res = await fetch(`/api/exercises?${params.toString()}`);
          if (!res.ok) throw new Error("load");
          const json = (await res.json()) as {
            data?: ListableExercise[];
            pagination?: { total?: number };
          };
          if (requestId === requestRef.current) {
            const rows = Array.isArray(json.data) ? json.data : [];
            setResults((prev) => (page === 1 ? rows : [...prev, ...rows]));
            setTotal(json.pagination?.total ?? rows.length);
          }
        } catch {
          if (requestId === requestRef.current) setLoadError(true);
        } finally {
          if (requestId === requestRef.current) setLoading(false);
        }
      },
      query.trim() && page === 1 ? 300 : 0
    );
    return () => window.clearTimeout(timer);
  }, [open, query, filters, page]);

  async function toggle(exercise: ListableExercise) {
    if (busyId) return;
    const adding = !inList.has(exercise.id);
    setBusyId(exercise.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/exercise-lists/${listId}/items`, {
        method: adding ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId: exercise.id }),
      });
      if (!res.ok) {
        setActionError(
          "No se pudo actualizar la colección. Inténtalo de nuevo."
        );
        return;
      }
      if (adding) onAdded(exercise);
      else onRemoved(exercise.id);
    } catch {
      setActionError("No se pudo actualizar la colección. Inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setFilters(EMPTY_PICKER_FILTERS);
          setActionError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir ejercicios</DialogTitle>
          <DialogDescription>A la colección “{listName}”.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio por nombre…"
            autoFocus
            className="h-10 w-full rounded-lg border border-foreground/15 bg-background pl-9 pr-3 text-sm text-foreground focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <ExercisePickerFilters
          exercises={[]}
          showAllOptions
          sport={sport}
          value={filters}
          onChange={setFilters}
        />

        {actionError ? (
          <p className="text-xs text-destructive">{actionError}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-foreground/10">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : loadError ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No se pudieron cargar los ejercicios.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin resultados.
            </p>
          ) : (
            <ul className="divide-y divide-foreground/8">
              {results.map((ex) => {
                const added = inList.has(ex.id);
                return (
                  <li
                    key={ex.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium leading-snug text-foreground">
                        {ex.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {CATEGORY_LABELS[ex.category] ?? ex.category}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="size-3" />
                          {ex.durationMinutes} min
                        </span>
                      </p>
                      <ExerciseQuickDescription text={ex.description} />
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggle(ex)}
                      disabled={busyId === ex.id}
                      aria-label={
                        added
                          ? `Quitar ${ex.name} de la colección`
                          : `Añadir ${ex.name} a la colección`
                      }
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60",
                        added
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-red-500/10 hover:text-red-500 dark:text-emerald-400"
                          : "border-brand/40 text-brand hover:bg-brand/10"
                      )}
                    >
                      {busyId === ex.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : added ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      {added ? "Añadido" : "Añadir"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {results.length > 0 && results.length < total ? (
            <div className="border-t border-foreground/8 p-2 text-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-60"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Mostrar más
              </button>
            </div>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {total} ejercicio{total === 1 ? "" : "s"}
          {query.trim() || hasPickerFilters(filters)
            ? " con esos criterios"
            : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
