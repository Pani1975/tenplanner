"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassList {
  id: string;
  name: string;
  emoji: string | null;
  isDefault?: boolean;
  containsClass?: boolean;
  itemsCount?: number;
}

/**
 * Selector de listas para una clase, abierto desde el corazón de la ficha
 * (ClassFavoriteToggle). Al cargar, si la clase no está todavía en ninguna
 * lista la añade automáticamente a la lista "Favoritos" por defecto — así,
 * si el monitor no elige ninguna lista explícita, la clase queda guardada
 * en favoritos igualmente.
 */
export function ClassListPicker({
  classId,
  className,
  onClose,
  onFavoritedChange,
}: {
  classId: string;
  className?: string;
  onClose: () => void;
  onFavoritedChange?: (favorited: boolean) => void;
}) {
  const [lists, setLists] = useState<ClassList[]>([]);
  const [inLists, setInLists] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/class-lists?classId=${encodeURIComponent(classId)}`,
          { cache: "no-store" }
        );
        const json = (await res.json().catch(() => ({}))) as {
          data?: ClassList[];
        };
        let all = Array.isArray(json.data) ? json.data : [];
        const alreadyInAny = all.some((l) => l.containsClass);
        if (!alreadyInAny) {
          const defaultList = all.find((l) => l.isDefault);
          if (defaultList) {
            await fetch(`/api/class-lists/${defaultList.id}/items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ classId }),
            });
            all = all.map((l) =>
              l.id === defaultList.id
                ? {
                    ...l,
                    containsClass: true,
                    itemsCount: (l.itemsCount ?? 0) + 1,
                  }
                : l
            );
          }
        }
        setLists(all);
        const next = new Set(
          all.filter((l) => l.containsClass).map((l) => l.id)
        );
        setInLists(next);
        onFavoritedChange?.(next.size > 0);
      } catch {
        setError("No se pudieron cargar las listas.");
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    if (showNew) setTimeout(() => newInputRef.current?.focus(), 50);
  }, [showNew]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggle(list: ClassList) {
    if (toggling) return;
    setToggling(list.id);
    setError(null);
    const isIn = inLists.has(list.id);
    try {
      const res = await fetch(`/api/class-lists/${list.id}/items`, {
        method: isIn ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      if (!res.ok) {
        setError("No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      const next = new Set(inLists);
      if (isIn) next.delete(list.id);
      else next.add(list.id);
      setInLists(next);
      setLists((prev) =>
        prev.map((l) =>
          l.id === list.id
            ? {
                ...l,
                containsClass: !isIn,
                itemsCount: Math.max((l.itemsCount ?? 0) + (isIn ? -1 : 1), 0),
              }
            : l
        )
      );
      onFavoritedChange?.(next.size > 0);
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setToggling(null);
    }
  }

  async function createList() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/class-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError("No se pudo crear la lista.");
        return;
      }
      const { data: created } = (await res.json()) as { data: ClassList };
      const add = await fetch(`/api/class-lists/${created.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      if (!add.ok) {
        setError("La lista se creó, pero no se pudo añadir la clase.");
        return;
      }
      setLists((prev) => [
        ...prev,
        { ...created, containsClass: true, itemsCount: 1 },
      ]);
      const next = new Set([...inLists, created.id]);
      setInLists(next);
      onFavoritedChange?.(next.size > 0);
      setNewName("");
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full overflow-hidden rounded-t-3xl border border-foreground/15 bg-background shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
              Guardar en lista
            </p>
            <h2 className="truncate text-lg font-black text-foreground">
              {className ?? "Elige una lista"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-xl text-foreground/40 hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-foreground/30" />
            </div>
          ) : (
            lists.map((list) => {
              const isIn = inLists.has(list.id);
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => void toggle(list)}
                  disabled={!!toggling}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                    isIn
                      ? "border-[#D6FF38] bg-[#D6FF38]/15"
                      : "border-foreground/10 hover:border-foreground/25",
                    toggling === list.id && "opacity-60"
                  )}
                >
                  <span className="text-2xl">{list.emoji ?? "🎓"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {list.name}
                    </span>
                    <span className="block text-xs text-foreground/45">
                      {list.itemsCount ?? 0}{" "}
                      {(list.itemsCount ?? 0) === 1 ? "clase" : "clases"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full",
                      isIn
                        ? "bg-[#050505] text-white dark:bg-white dark:text-[#050505]"
                        : "border border-foreground/20"
                    )}
                  >
                    {toggling === list.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      isIn && <Check className="size-3.5" strokeWidth={3} />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {!loading && (
          <div className="space-y-2 border-t border-foreground/10 px-4 py-3">
            {showNew ? (
              <div className="flex gap-2">
                <input
                  ref={newInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createList();
                  }}
                  placeholder="Ej: Adultos iniciación"
                  maxLength={100}
                  className="min-w-0 flex-1 rounded-xl border border-foreground/15 bg-foreground/[0.02] px-3 py-2 text-sm placeholder:text-foreground/30 focus:border-[#D6FF38] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void createList()}
                  disabled={!newName.trim() || creating}
                  className="inline-flex items-center justify-center rounded-xl bg-[#D6FF38] px-4 text-sm font-bold text-[#050505] disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Crear"
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-4" />
                Nueva lista
              </button>
            )}
            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
