"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassList {
  id: string;
  name: string;
  emoji: string | null;
  itemsCount: number;
}

/**
 * Diálogo para añadir varias clases (seleccionadas en el listado) a una
 * lista existente o nueva de una sola vez. Mismo backend que
 * ClassListPicker (app/(public)/classes/[id]/class-list-picker.tsx), pero
 * para `classIds` en lote en lugar de una sola clase.
 */
export function AddClassesToListDialog({
  open,
  onOpenChange,
  classIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classIds: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [lists, setLists] = useState<ClassList[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [done, setDone] = useState<{ listId: string; added: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setError(null);
    setShowNew(false);
    setNewName("");
    void loadLists();
  }, [open]);

  useEffect(() => {
    if (showNew) setTimeout(() => newInputRef.current?.focus(), 40);
  }, [showNew]);

  async function loadLists() {
    setLoading(true);
    try {
      const res = await fetch("/api/class-lists", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        data?: ClassList[];
      };
      setLists(Array.isArray(data.data) ? data.data : []);
    } finally {
      setLoading(false);
    }
  }

  async function addToList(listId: string) {
    if (classIds.length === 0) return;
    setAddingTo(listId);
    setError(null);
    try {
      const results = await Promise.all(
        classIds.map((classId) =>
          fetch(`/api/class-lists/${listId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classId }),
          }).then((r) => r.ok)
        )
      );
      const added = results.filter(Boolean).length;
      if (added === 0) {
        setError("No se pudo añadir ninguna clase. Inténtalo de nuevo.");
        return;
      }
      setDone({ listId, added });
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setAddingTo(null);
    }
  }

  async function createListAndAdd() {
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
      const { data: created } = (await res.json()) as {
        data: { id: string; name: string; emoji: string | null };
      };
      setLists((prev) => [{ ...created, itemsCount: 0 }, ...prev]);
      setNewName("");
      setShowNew(false);
      await addToList(created.id);
    } finally {
      setCreating(false);
    }
  }

  function close() {
    onOpenChange(false);
    if (done) onDone?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative w-full overflow-hidden rounded-t-3xl border border-foreground/15 bg-background shadow-2xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-foreground/10 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
              Añadir a lista
            </p>
            <h2 className="truncate text-lg font-black text-foreground">
              {classIds.length} clase{classIds.length !== 1 ? "s" : ""}{" "}
              seleccionada{classIds.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-xl text-foreground/40 hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
          {done ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505]">
                <Check className="size-5" strokeWidth={3} />
              </span>
              <p className="text-sm font-bold text-foreground">
                {done.added} clase{done.added !== 1 ? "s" : ""} añadida
                {done.added !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-foreground/45">
                Guardadas en{" "}
                {lists.find((l) => l.id === done.listId)?.name ?? "la lista"}.
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-foreground/30" />
            </div>
          ) : lists.length === 0 && !showNew ? (
            <p className="py-6 text-center text-sm text-foreground/60">
              Aún no tienes listas de clases. Crea la primera.
            </p>
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => void addToList(list.id)}
                disabled={!!addingTo}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  "border-foreground/10 hover:border-foreground/25",
                  addingTo === list.id && "opacity-60"
                )}
              >
                <span className="text-2xl">
                  {list.emoji && list.emoji.length <= 2 ? list.emoji : "🎓"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {list.name}
                  </span>
                  <span className="block text-xs text-foreground/45">
                    {list.itemsCount}{" "}
                    {list.itemsCount === 1 ? "clase" : "clases"}
                  </span>
                </span>
                {addingTo === list.id && (
                  <Loader2 className="size-4 animate-spin text-foreground/40" />
                )}
              </button>
            ))
          )}
        </div>

        {!loading && !done && (
          <div className="space-y-2 border-t border-foreground/10 px-4 py-3">
            {showNew ? (
              <div className="flex gap-2">
                <input
                  ref={newInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createListAndAdd();
                  }}
                  placeholder="Ej: Adultos iniciación"
                  maxLength={100}
                  className="min-w-0 flex-1 rounded-xl border border-foreground/15 bg-foreground/[0.02] px-3 py-2 text-sm placeholder:text-foreground/30 focus:border-[#D6FF38] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void createListAndAdd()}
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

        {done && (
          <div className="border-t border-foreground/10 px-4 py-3">
            <button
              type="button"
              onClick={close}
              className="w-full rounded-xl bg-[#D6FF38] py-2.5 text-sm font-bold text-[#050505]"
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
