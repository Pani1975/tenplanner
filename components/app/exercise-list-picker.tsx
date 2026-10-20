"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExerciseList {
  id: string;
  name: string;
  emoji: string | null;
  isDefault?: boolean;
  containsExercise?: boolean;
  itemsCount?: number;
}

interface ExerciseListPickerProps {
  exerciseId: string;
  exerciseName?: string;
  onClose: () => void;
  onFavoritedChange?: (favorited: boolean) => void;
}

const LIST_TINTS = [
  "from-brand/20 to-brand/5",
  "from-violet-500/20 to-violet-500/5",
  "from-amber-500/20 to-amber-500/5",
  "from-rose-500/20 to-rose-500/5",
  "from-cyan-500/20 to-cyan-500/5",
  "from-sky-500/20 to-sky-500/5",
];

export function ExerciseListPicker({
  exerciseId,
  exerciseName,
  onClose,
  onFavoritedChange,
}: ExerciseListPickerProps) {
  const [lists, setLists] = useState<ExerciseList[]>([]);
  const [inLists, setInLists] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [justChecked, setJustChecked] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/exercise-lists?exerciseId=${encodeURIComponent(exerciseId)}`
        );
        const data = (await res.json()) as { data: ExerciseList[] };
        const all = Array.isArray(data.data) ? data.data : [];
        setLists(all);
        setInLists(
          new Set(all.filter((l) => l.containsExercise).map((l) => l.id))
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [exerciseId]);

  useEffect(() => {
    if (showNew) {
      setTimeout(() => newInputRef.current?.focus(), 50);
    }
  }, [showNew]);

  async function toggle(list: ExerciseList) {
    if (toggling) return;
    setToggling(list.id);
    const isIn = inLists.has(list.id);

    try {
      await fetch(`/api/exercise-lists/${list.id}/items`, {
        method: isIn ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });

      const next = new Set(inLists);
      if (isIn) {
        next.delete(list.id);
      } else {
        next.add(list.id);
        setJustChecked(list.id);
        setTimeout(() => setJustChecked(null), 600);
      }
      setInLists(next);
      setLists((prev) =>
        prev.map((l) =>
          l.id === list.id
            ? {
                ...l,
                containsExercise: !isIn,
                itemsCount: isIn
                  ? Math.max((l.itemsCount ?? 1) - 1, 0)
                  : (l.itemsCount ?? 0) + 1,
              }
            : l
        )
      );
      // favorited = in any list
      onFavoritedChange?.(next.size > 0);
    } finally {
      setToggling(null);
    }
  }

  async function createList() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/exercise-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { data: ExerciseList };
      const created = data.data;

      await fetch(`/api/exercise-lists/${created.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });

      const withItem = { ...created, containsExercise: true, itemsCount: 1 };
      setLists((prev) => [withItem, ...prev]);
      const next = new Set([...inLists, created.id]);
      setInLists(next);
      setJustChecked(created.id);
      setTimeout(() => setJustChecked(null), 600);
      onFavoritedChange?.(true);
      setNewName("");
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full sm:max-w-md bg-background border border-foreground/15 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-foreground/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-foreground/10">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/40 mb-0.5">
              Guardar en lista
            </p>
            <h2 className="font-heading text-lg text-foreground leading-tight">
              {exerciseName ? (
                <em className="italic text-brand">{exerciseName}</em>
              ) : (
                "Elige una lista"
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-xl flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-foreground/8 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* List grid */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-foreground/30" />
            </div>
          ) : lists.length === 0 && !showNew ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-sm text-foreground/50 text-center">
                Aún no tienes ninguna lista.
                <br />
                Crea una para guardar este ejercicio.
              </p>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand text-brand-foreground px-4 py-2 text-[13px] font-semibold hover:bg-brand/90 transition-colors"
              >
                <Plus className="size-3.5" />
                Crear lista
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {lists.map((list, i) => {
                const isIn = inLists.has(list.id);
                const isJust = justChecked === list.id;
                const tint = LIST_TINTS[i % LIST_TINTS.length];

                return (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => void toggle(list)}
                    disabled={!!toggling}
                    className={cn(
                      "relative group flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 text-left",
                      isIn
                        ? "border-brand/50 ring-1 ring-brand/30"
                        : "border-foreground/10 hover:border-foreground/25",
                      toggling === list.id && "opacity-60"
                    )}
                  >
                    <div
                      className={cn(
                        "h-20 w-full bg-gradient-to-br flex items-center justify-center text-3xl",
                        tint
                      )}
                    >
                      {list.emoji ?? "📋"}

                      <div
                        className={cn(
                          "absolute inset-0 flex items-end justify-end p-2 transition-opacity duration-200",
                          isIn
                            ? "opacity-100"
                            : "opacity-40 sm:opacity-0 sm:group-hover:opacity-40"
                        )}
                      >
                        <div
                          className={cn(
                            "size-6 rounded-full flex items-center justify-center transition-all duration-300",
                            isIn
                              ? "bg-brand text-brand-foreground scale-100"
                              : "bg-foreground/20 text-foreground/60 scale-90",
                            isJust && "scale-125"
                          )}
                        >
                          <Check className="size-3.5" strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>

                    <div className="px-3 py-2 bg-foreground/[0.02]">
                      <p
                        className={cn(
                          "font-heading text-[13px] leading-tight truncate transition-colors",
                          isIn ? "text-brand" : "text-foreground"
                        )}
                      >
                        {list.name}
                      </p>
                      <p className="font-sans text-[10px] text-foreground/40 mt-0.5">
                        {list.itemsCount ?? 0} ejercicio
                        {(list.itemsCount ?? 0) !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* New list card */}
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="relative flex flex-col rounded-2xl overflow-hidden border border-dashed border-foreground/20 hover:border-brand/40 hover:bg-brand/[0.02] transition-all text-left"
              >
                <div className="h-20 w-full flex items-center justify-center text-foreground/25 hover:text-brand/50 transition-colors">
                  <Plus className="size-7" strokeWidth={1.5} />
                </div>
                <div className="px-3 py-2">
                  <p className="font-heading text-[13px] text-foreground/50">
                    Nueva lista
                  </p>
                  <p className="font-sans text-[10px] text-foreground/30 mt-0.5">
                    Crear
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* New list input */}
        {showNew && (
          <div className="px-4 pb-4 pt-1 border-t border-foreground/10 space-y-2">
            <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/40 pt-3">
              Nombre de la nueva lista
            </p>
            <div className="flex gap-2">
              <input
                ref={newInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createList();
                  if (e.key === "Escape") {
                    setShowNew(false);
                    setNewName("");
                  }
                }}
                placeholder="Ej: Técnica de volea"
                maxLength={100}
                className="flex-1 rounded-xl border border-foreground/15 bg-foreground/[0.02] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-brand/50"
              />
              <button
                onClick={() => void createList()}
                disabled={!newName.trim() || creating}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand text-brand-foreground px-4 text-[13px] font-semibold hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                {creating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Crear"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 pb-5 pt-2 flex items-center justify-between">
          <p className="text-[12px] text-foreground/35">
            {inLists.size > 0
              ? `En ${inLists.size} lista${inLists.size !== 1 ? "s" : ""}`
              : "No guardado en ninguna lista"}
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-foreground text-background px-5 py-2 text-[13px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
