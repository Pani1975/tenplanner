"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SearchListKind = "exercise" | "class";

const COPY = {
  exercise: {
    base: "/api/exercise-lists",
    noun: "ejercicio",
    nouns: "ejercicios",
    container: "colección",
    containerThe: "la colección",
    defaultEmoji: "📋",
  },
  class: {
    base: "/api/class-lists",
    noun: "clase",
    nouns: "clases",
    container: "lista",
    containerThe: "la lista",
    defaultEmoji: "📋",
  },
} as const;

interface ListOption {
  id: string;
  name: string;
  emoji: string | null;
  itemsCount?: number;
}

/**
 * Llama al backend para guardar en `listId` todos los resultados de la
 * búsqueda (`query` = la query string de /exercises o /classes).
 */
export async function saveSearchToList(
  kind: SearchListKind,
  listId: string,
  query: string
): Promise<
  { ok: true; total: number; added: number } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${COPY[kind].base}/${listId}/items/from-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      total?: number;
      added?: number;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error:
          json.error ?? `No se pudo guardar la búsqueda. Inténtalo de nuevo.`,
      };
    }
    return { ok: true, total: json.total ?? 0, added: json.added ?? 0 };
  } catch {
    return { ok: false, error: "Error de red. Inténtalo de nuevo." };
  }
}

export function resultMessage(
  kind: SearchListKind,
  total: number,
  added: number
) {
  const { noun, nouns } = COPY[kind];
  if (total === 0) return `La búsqueda no tiene ${nouns}.`;
  const already = total - added;
  const addedTxt = `${added} ${added === 1 ? noun : nouns} ${
    added === 1 ? "añadido" : "añadidos"
  }`;
  return already > 0 ? `${addedTxt} (${already} ya estaban).` : `${addedTxt}.`;
}

/**
 * Guarda todos los resultados de la búsqueda filtrada que se está viendo en
 * una colección (ejercicios) o lista (clases), existente o nueva. Es una
 * copia del momento: lo que se cree después no entra solo.
 */
export function SaveSearchToListDialog({
  open,
  onOpenChange,
  kind,
  query,
  total,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SearchListKind;
  /** Query string con los filtros activos. */
  query: string;
  /** Resultados que se verán (solo informativo). */
  total: number;
}) {
  const router = useRouter();
  const copy = COPY[kind];
  const [lists, setLists] = useState<ListOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    listId: string;
    message: string;
  } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setShowNew(false);
    setNewName("");
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(copy.base, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          data?: ListOption[];
        };
        if (!cancelled) setLists(Array.isArray(json.data) ? json.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, copy.base]);

  useEffect(() => {
    if (showNew) setTimeout(() => newInputRef.current?.focus(), 40);
  }, [showNew]);

  async function saveTo(listId: string) {
    if (busyId) return;
    setBusyId(listId);
    setError(null);
    const res = await saveSearchToList(kind, listId, query);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({
      listId,
      message: resultMessage(kind, res.total, res.added),
    });
    router.refresh();
  }

  async function createAndSave() {
    const name = newName.trim();
    if (!name || busyId) return;
    setBusyId("new");
    setError(null);
    try {
      const res = await fetch(copy.base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(`No se pudo crear ${copy.containerThe}.`);
        setBusyId(null);
        return;
      }
      const json = (await res.json()) as { data: ListOption };
      setLists((prev) => [{ ...json.data, itemsCount: 0 }, ...prev]);
      setNewName("");
      setShowNew(false);
      setBusyId(null);
      await saveTo(json.data.id);
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guardar búsqueda en {copy.containerThe}</DialogTitle>
          <DialogDescription>
            Se añadirán los {total} {total === 1 ? copy.noun : copy.nouns} que
            salen ahora con estos filtros. Es una copia de este momento: lo que
            crees después no entra solo.
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {result ? (
          <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="size-4 shrink-0" />
            {result.message}
          </p>
        ) : null}

        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => void saveTo(list.id)}
                disabled={busyId !== null}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
                  result?.listId === list.id
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-foreground/10 hover:border-brand/40 hover:bg-brand/5"
                )}
              >
                <span className="text-xl">
                  {list.emoji ?? copy.defaultEmoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {list.name}
                  </span>
                  {list.itemsCount != null ? (
                    <span className="block text-[11px] text-muted-foreground">
                      {list.itemsCount}{" "}
                      {list.itemsCount === 1 ? copy.noun : copy.nouns}
                    </span>
                  ) : null}
                </span>
                {busyId === list.id ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : result?.listId === list.id ? (
                  <Check className="size-4 text-emerald-500" />
                ) : null}
              </button>
            ))
          )}

          {showNew ? (
            <div className="flex items-center gap-2">
              <input
                ref={newInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createAndSave();
                }}
                placeholder={`Nombre de ${copy.containerThe} nueva`}
                maxLength={80}
                className="h-10 min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-3 text-sm focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="button"
                onClick={() => void createAndSave()}
                disabled={!newName.trim() || busyId !== null}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-50"
              >
                {busyId === "new" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Crear y guardar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-foreground/20 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
            >
              <Plus className="size-4" />
              Nueva {copy.container}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Botón que abre el diálogo de guardar la búsqueda actual en una lista. */
export function SaveSearchToListButton({
  kind,
  query,
  total,
  className,
}: {
  kind: SearchListKind;
  query: string;
  total: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const copy = COPY[kind];
  if (total <= 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Guardar los resultados en ${copy.containerThe}`}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#050505]/15 bg-white px-4 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/15 dark:bg-white/[0.04]",
          className
        )}
      >
        <BookmarkPlus className="size-3.5" strokeWidth={1.8} />
        Guardar en {copy.container}
      </button>
      <SaveSearchToListDialog
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        query={query}
        total={total}
      />
    </>
  );
}
