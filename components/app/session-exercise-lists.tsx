"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, Loader2, Plus, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExerciseQuickViewDialog } from "@/components/app/exercise-quick-view-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExerciseListItem {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  imageUrl: string | null;
  description?: string | null;
  objectives?: string | null;
  videoUrl?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

interface ExerciseListWithItems {
  id: string;
  name: string;
  emoji: string | null;
  createdAt: string;
  itemsCount: number;
  items: ExerciseListItem[];
}

interface SessionExerciseListsProps {
  selectedExerciseIds: string[];
  onApplyList: (items: ExerciseListItem[]) => void;
  /** Cómo referirse al destino en los mensajes, p.ej. "la sesión" o "la clase". */
  contextLabel?: string;
}

export function SessionExerciseLists({
  selectedExerciseIds,
  onApplyList,
  contextLabel = "la sesión",
}: SessionExerciseListsProps) {
  const [lists, setLists] = useState<ExerciseListWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [selectingList, setSelectingList] =
    useState<ExerciseListWithItems | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quickView, setQuickView] = useState<ExerciseListItem | null>(null);

  const selectedSet = useMemo(
    () => new Set(selectedExerciseIds),
    [selectedExerciseIds]
  );

  useEffect(() => {
    async function loadLists() {
      setLoading(true);
      try {
        const res = await fetch("/api/exercise-lists?includeExercises=true", {
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          data?: ExerciseListWithItems[];
        };
        setLists(Array.isArray(payload.data) ? payload.data : []);
      } finally {
        setLoading(false);
      }
    }

    void loadLists();
  }, []);

  function openSelectDialog(list: ExerciseListWithItems) {
    setSelectingList(list);
    // Empieza sin nada marcado: el monitor elige qué añadir (o "Seleccionar todos").
    setSelectedItems(new Set());
    setSelectDialogOpen(true);
  }

  const selectableItems = useMemo(
    () => selectingList?.items.filter((item) => !selectedSet.has(item.id)) ?? [],
    [selectingList, selectedSet]
  );
  const allSelected =
    selectableItems.length > 0 && selectedItems.size === selectableItems.length;

  function toggleAll() {
    setSelectedItems(
      allSelected ? new Set() : new Set(selectableItems.map((i) => i.id))
    );
  }

  function toggleItem(itemId: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function applySelected() {
    if (!selectingList || selectedItems.size === 0) {
      setSelectDialogOpen(false);
      return;
    }
    const toAdd = selectingList.items.filter((item) =>
      selectedItems.has(item.id)
    );
    onApplyList(toAdd);
    setSelectDialogOpen(false);
  }

  return (
    <>
      <div className="px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : lists.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
            <p className="text-sm font-medium text-foreground">
              No tienes listas guardadas todavía.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Guarda ejercicios en una lista y podrás reutilizarlos aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lists.map((list) => {
              const availableItems = list.items.filter(
                (item) => !selectedSet.has(item.id)
              );
              const alreadyAdded = list.items.length - availableItems.length;

              return (
                <div
                  key={list.id}
                  className="rounded-xl border border-border bg-background px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span>{list.emoji ?? "📋"}</span>
                        <p className="truncate text-sm font-medium text-foreground">
                          {list.name}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {list.itemsCount} ejercicio
                        {list.itemsCount !== 1 ? "s" : ""}
                        {alreadyAdded > 0
                          ? ` · ${alreadyAdded} ya en ${contextLabel}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openSelectDialog(list)}
                      disabled={availableItems.length === 0}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition-colors",
                        availableItems.length > 0
                          ? "bg-brand text-brand-foreground hover:bg-brand/90"
                          : "border border-border text-muted-foreground"
                      )}
                    >
                      <Plus className="size-3" />
                      Añadir
                    </button>
                  </div>

                  {list.items.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {list.items.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {item.name}
                        </span>
                      ))}
                      {list.items.length > 3 ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          +{list.items.length - 3} más
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={selectDialogOpen} onOpenChange={setSelectDialogOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6">
              Selecciona ejercicios de {selectingList?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={toggleAll}
              disabled={selectableItems.length === 0}
              className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-brand disabled:opacity-50"
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded border",
                  allSelected
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-foreground/30"
                )}
              >
                {allSelected ? <Check className="size-3" /> : null}
              </span>
              {allSelected ? "Quitar selección" : "Seleccionar todos"}
            </button>
            <span className="tabular-nums text-muted-foreground">
              {selectedItems.size} de {selectableItems.length} seleccionados
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-foreground/10 bg-background">
            <div className="divide-y divide-foreground/8">
              {selectableItems.map((item) => {
                const isSelected = selectedItems.has(item.id);
                const description = item.description?.trim();
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 px-3 py-3 transition-colors",
                      isSelected ? "bg-brand/5" : "hover:bg-foreground/[0.02]"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(item.id)}
                      aria-label={`Seleccionar ${item.name}`}
                      className="mt-1 size-4 shrink-0 cursor-pointer rounded border-foreground/30"
                    />

                    {item.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setQuickView(item)}
                        aria-label={`Ver ${item.name}`}
                        className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-foreground/5"
                      >
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </button>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="block w-full break-words text-left text-sm font-medium leading-tight text-foreground"
                      >
                        {item.name}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-brand">
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {item.durationMinutes}′
                        </span>
                        {item.videoUrl ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Video className="size-3" /> Vídeo
                          </span>
                        ) : null}
                      </div>
                      {description ? (
                        <p className="mt-1.5 line-clamp-2 break-words text-[11px] leading-snug text-foreground/60">
                          {description}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setQuickView(item)}
                          className="text-foreground/50 hover:text-foreground"
                        >
                          Vista rápida
                        </button>
                        <a
                          href={`/exercises/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand hover:opacity-70"
                        >
                          Ficha <ArrowRight className="size-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectDialogOpen(false)}
              className="flex-1 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-semibold transition-colors hover:bg-foreground/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={applySelected}
              disabled={selectedItems.size === 0}
              className="flex-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              <Check className="mr-1 inline size-4" />
              Añadir ({selectedItems.size})
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ExerciseQuickViewDialog
        exercise={quickView}
        open={quickView !== null}
        onOpenChange={(open) => {
          if (!open) setQuickView(null);
        }}
      />
    </>
  );
}
