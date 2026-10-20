"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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
}

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
    setSelectedItems(
      new Set(
        list.items.filter((item) => !selectedSet.has(item.id)).map((i) => i.id)
      )
    );
    setSelectDialogOpen(true);
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
        <DialogContent className="flex max-h-[70vh] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Selecciona ejercicios de {selectingList?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-foreground/10 bg-background">
            <div className="divide-y divide-foreground/8">
              {selectingList?.items
                .filter((item) => !selectedSet.has(item.id))
                .map((item) => {
                  const isSelected = selectedItems.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-foreground/[0.02]"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItem(item.id)}
                        className="size-4 rounded border-foreground/30"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.durationMinutes}′
                        </p>
                      </div>
                    </label>
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
    </>
  );
}
