"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, Plus, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExerciseQuickDescription } from "@/components/app/exercise-quick-description";
import {
  resultMessage,
  saveSearchToList,
} from "@/components/app/save-search-to-list";
import { nivelesForSport } from "@/lib/exercise-taxonomy";
import { cn } from "@/lib/utils";

export interface ListableClass {
  id: string;
  name: string;
  duracionMinutes: number;
  alumnosTipo: string | null;
  nivel: string | null;
  isLibrary: boolean;
  objetivos?: string | null;
}

const PAGE_SIZE = 40;

const DURACIONES = [
  { id: "30", label: "30 min" },
  { id: "45", label: "45 min" },
  { id: "55", label: "55 min" },
  { id: "60", label: "60 min" },
  { id: "75", label: "75 min" },
  { id: "90", label: "90 min" },
  { id: "120", label: "+90 min" },
];

const ASPECTOS = [
  { id: "tecnica", label: "Técnica" },
  { id: "tactica", label: "Táctica" },
  { id: "mental", label: "Mental / cognitivo" },
  { id: "fisico", label: "Físico / movilidad" },
];

const GOLPES = [
  { id: "derecha", label: "Derecha" },
  { id: "reves", label: "Revés" },
  { id: "saque", label: "Saque" },
  { id: "volea", label: "Volea" },
  { id: "remate", label: "Remate" },
  { id: "dejada", label: "Dejada" },
  { id: "globo", label: "Globo" },
];

interface ClassFilters {
  nivel: string;
  duracion: string;
  aspecto: string;
  golpe: string;
}

const EMPTY_FILTERS: ClassFilters = {
  nivel: "",
  duracion: "",
  aspecto: "",
  golpe: "",
};

const SELECT_CLASS =
  "h-8 min-w-0 rounded-lg border border-foreground/15 bg-background px-2 text-xs text-foreground focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20";

/**
 * Añadir clases directamente a una lista de clases, con buscador, filtros
 * (nivel, duración, aspecto, golpe) y la opción de añadir de golpe todos los
 * resultados de la búsqueda.
 */
export function PickClassesForListDialog({
  open,
  onOpenChange,
  listId,
  listName,
  currentIds,
  sport,
  onAdded,
  onRemoved,
  onBulkAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  listName: string;
  currentIds: string[];
  sport?: string | null;
  onAdded: (cls: ListableClass) => void;
  onRemoved: (classId: string) => void;
  onBulkAdded?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ClassFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<ListableClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const requestRef = useRef(0);
  const inList = new Set(currentIds);
  const niveles = nivelesForSport(sport);
  const hasFilters = Object.values(filters).some(Boolean);
  const hasCriteria = !!query.trim() || hasFilters;

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
          if (q) params.set("q", q);
          if (filters.nivel) params.set("nivel", filters.nivel);
          if (filters.duracion) params.set("duracion", filters.duracion);
          if (filters.aspecto) params.set("aspecto", filters.aspecto);
          if (filters.golpe) params.set("golpe", filters.golpe);
          const res = await fetch(`/api/classes?${params.toString()}`);
          if (!res.ok) throw new Error("load");
          const json = (await res.json()) as {
            data?: ListableClass[];
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

  async function toggle(cls: ListableClass) {
    if (busyId) return;
    const adding = !inList.has(cls.id);
    setBusyId(cls.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/class-lists/${listId}/items`, {
        method: adding ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: cls.id }),
      });
      if (!res.ok) {
        setActionError("No se pudo actualizar la lista. Inténtalo de nuevo.");
        return;
      }
      if (adding) onAdded(cls);
      else onRemoved(cls.id);
    } catch {
      setActionError("No se pudo actualizar la lista. Inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  async function addAllResults() {
    if (bulkBusy || total === 0) return;
    setBulkBusy(true);
    setActionError(null);
    setBulkMessage(null);
    const q = new URLSearchParams();
    if (query.trim()) q.set("q", query.trim());
    if (filters.nivel) q.set("nivel", filters.nivel);
    if (filters.duracion) q.set("duracion", filters.duracion);
    if (filters.aspecto) q.append("aspecto", filters.aspecto);
    if (filters.golpe) q.append("golpe", filters.golpe);
    const res = await saveSearchToList("class", listId, q.toString());
    setBulkBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setBulkMessage(resultMessage("class", res.total, res.added));
    onBulkAdded?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setFilters(EMPTY_FILTERS);
          setActionError(null);
          setBulkMessage(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir clases</DialogTitle>
          <DialogDescription>A la lista “{listName}”.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clase por nombre…"
            autoFocus
            className="h-10 w-full rounded-lg border border-foreground/15 bg-background pl-9 pr-3 text-sm text-foreground focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <select
              aria-label="Filtrar por nivel"
              value={filters.nivel}
              onChange={(e) =>
                setFilters((f) => ({ ...f, nivel: e.target.value }))
              }
              className={SELECT_CLASS}
            >
              <option value="">Nivel: todos</option>
              {niveles.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por duración"
              value={filters.duracion}
              onChange={(e) =>
                setFilters((f) => ({ ...f, duracion: e.target.value }))
              }
              className={SELECT_CLASS}
            >
              <option value="">Duración: cualquiera</option>
              {DURACIONES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por aspecto del juego"
              value={filters.aspecto}
              onChange={(e) =>
                setFilters((f) => ({ ...f, aspecto: e.target.value }))
              }
              className={SELECT_CLASS}
            >
              <option value="">Aspecto: todos</option>
              {ASPECTOS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por golpe"
              value={filters.golpe}
              onChange={(e) =>
                setFilters((f) => ({ ...f, golpe: e.target.value }))
              }
              className={SELECT_CLASS}
            >
              <option value="">Golpe: todos</option>
              {GOLPES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
              Quitar filtros
            </button>
          ) : null}
        </div>

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
              No se pudieron cargar las clases.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin resultados.
            </p>
          ) : (
            <ul className="divide-y divide-foreground/8">
              {results.map((cls) => {
                const added = inList.has(cls.id);
                return (
                  <li
                    key={cls.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium leading-snug text-foreground">
                        {cls.name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="size-3" />
                          {cls.duracionMinutes} min
                        </span>
                        {cls.alumnosTipo ? (
                          <span className="capitalize">{cls.alumnosTipo}</span>
                        ) : null}
                        {cls.isLibrary ? (
                          <span className="text-brand/80">Biblioteca</span>
                        ) : null}
                      </p>
                      <ExerciseQuickDescription text={cls.objetivos} />
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggle(cls)}
                      disabled={busyId === cls.id}
                      aria-label={
                        added
                          ? `Quitar ${cls.name} de la lista`
                          : `Añadir ${cls.name} a la lista`
                      }
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60",
                        added
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-red-500/10 hover:text-red-500 dark:text-emerald-400"
                          : "border-brand/40 text-brand hover:bg-brand/10"
                      )}
                    >
                      {busyId === cls.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : added ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      {added ? "Añadida" : "Añadir"}
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {total} clase{total === 1 ? "" : "s"}
            {hasCriteria ? " con esos criterios" : ""}
          </p>
          {hasCriteria && total > 0 ? (
            <button
              type="button"
              onClick={() => void addAllResults()}
              disabled={bulkBusy}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-brand/40 px-3 text-xs font-semibold text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
            >
              {bulkBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Añadir las {total} clases
            </button>
          ) : null}
        </div>
        {bulkMessage ? (
          <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            {bulkMessage}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
