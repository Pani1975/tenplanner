"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ClipboardList,
  Heart,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddToSessionDialog } from "@/components/app/add-to-session-dialog";
import {
  AddExercisesToListDialog,
  type ListableExercise,
} from "@/components/app/add-exercises-to-list-dialog";

interface ListedExercise {
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
  isDefault: boolean;
  createdAt: string;
  itemsCount: number;
  items: ListedExercise[];
}

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

const ACCENT_PALETTE = [
  {
    bg: "bg-brand/8",
    border: "border-brand/20",
    text: "text-brand",
    dot: "bg-brand",
  },
  {
    bg: "bg-violet-500/8",
    border: "border-violet-500/20",
    text: "text-violet-400",
    dot: "bg-violet-400",
  },
  {
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  {
    bg: "bg-rose-500/8",
    border: "border-rose-500/20",
    text: "text-rose-400",
    dot: "bg-rose-400",
  },
  {
    bg: "bg-cyan-500/8",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
    dot: "bg-cyan-400",
  },
  {
    bg: "bg-sky-500/8",
    border: "border-sky-500/20",
    text: "text-sky-400",
    dot: "bg-sky-400",
  },
];

function CollectionCard({
  list,
  index,
  onDelete,
  onRename,
  onRemoveItem,
  onItemAdded,
  onItemRemoved,
  deletingId,
  removingKey,
}: {
  list: ExerciseListWithItems;
  index: number;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemoveItem: (listId: string, exerciseId: string) => void;
  onItemAdded: (listId: string, exercise: ListableExercise) => void;
  onItemRemoved: (listId: string, exerciseId: string) => void;
  deletingId: string | null;
  removingKey: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addToSessionOpen, setAddToSessionOpen] = useState(false);
  const [addExercisesOpen, setAddExercisesOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(list.name);
  const [renameSaving, setRenameSaving] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const accent = ACCENT_PALETTE[index % ACCENT_PALETTE.length];
  const chapterNum = String(index + 1).padStart(2, "0");
  const sessionHref =
    list.items.length > 0
      ? `/sessions/new?exercises=${list.items.map((i) => i.id).join(",")}`
      : "/sessions/new";

  useEffect(() => {
    if (renaming) setTimeout(() => renameRef.current?.focus(), 40);
  }, [renaming]);

  async function saveRename() {
    const name = renameVal.trim();
    if (!name || name === list.name) {
      setRenaming(false);
      return;
    }
    setRenameSaving(true);
    try {
      const res = await fetch(`/api/exercise-lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        onRename(list.id, name);
        setRenaming(false);
      }
    } finally {
      setRenameSaving(false);
    }
  }

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-lg border border-foreground/10 bg-card shadow-sm shadow-black/5 transition-all duration-300",
        expanded
          ? "shadow-lg shadow-foreground/5"
          : "hover:border-foreground/20"
      )}
    >
      {/* Chapter header */}
      <div
        className={cn(
          "relative flex items-stretch cursor-pointer select-none transition-colors",
          expanded ? "bg-foreground/[0.03]" : "hover:bg-foreground/[0.015]"
        )}
        onClick={() => !renaming && setExpanded((v) => !v)}
      >
        {/* Oversized chapter number — decorative bleed */}
        <div className="relative w-16 shrink-0 flex items-center justify-center border-r border-foreground/8 overflow-hidden">
          <span
            className="font-heading font-bold leading-none select-none pointer-events-none"
            style={{
              fontSize: "4.5rem",
              color: "var(--foreground)",
              opacity: 0.04,
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {chapterNum}
          </span>
          <span className="relative z-10 font-sans text-[9px] tabular-nums tracking-[0.3em] text-foreground/30">
            {chapterNum}
          </span>
        </div>

        {/* Main header content */}
        <div className="flex-1 min-w-0 px-5 py-4">
          <div className="flex items-start gap-3">
            {/* Emoji */}
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-xl border transition-colors",
                accent.bg,
                accent.border
              )}
            >
              {list.emoji ?? "📋"}
            </span>

            <div className="flex-1 min-w-0">
              {renaming ? (
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={renameRef}
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveRename();
                      if (e.key === "Escape") {
                        setRenaming(false);
                        setRenameVal(list.name);
                      }
                    }}
                    className="h-8 flex-1 min-w-0 rounded-lg border border-brand/40 bg-background px-3 text-sm text-foreground focus:outline-none focus:border-brand"
                  />
                  <button
                    onClick={() => void saveRename()}
                    disabled={renameSaving}
                    className="text-[11px] font-semibold text-brand hover:text-brand/80 disabled:opacity-50 shrink-0"
                  >
                    {renameSaving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      "OK"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setRenaming(false);
                      setRenameVal(list.name);
                    }}
                    className="text-[11px] text-foreground/40 hover:text-foreground shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading italic text-[17px] leading-tight text-foreground">
                    {list.name}
                  </h3>
                  {list.isDefault && (
                    <span className="font-sans text-[8px] uppercase tracking-[0.18em] text-brand/60 border border-brand/25 rounded px-1.5 py-0.5">
                      principal
                    </span>
                  )}
                </div>
              )}

              <div className="mt-1 flex items-center gap-3">
                <span
                  className={cn(
                    "font-sans text-[10px] tabular-nums",
                    accent.text
                  )}
                >
                  {list.itemsCount} ejercicio{list.itemsCount !== 1 ? "s" : ""}
                </span>
                {!renaming && (
                  <span className="font-sans text-[10px] text-foreground/30">
                    {expanded ? "— colapsar" : "— ver colección"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 px-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Añadir ejercicios a la colección"
            onClick={() => setAddExercisesOpen(true)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold transition-colors hover:opacity-80",
              accent.border,
              accent.text,
              accent.bg
            )}
          >
            <Plus className="size-3" />
            <span className="hidden sm:inline">Ejercicios</span>
          </button>

          <Link
            href={sessionHref}
            title="Crear sesión"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] font-semibold transition-colors",
              list.items.length > 0
                ? cn(
                    "border",
                    accent.border,
                    accent.text,
                    accent.bg,
                    "hover:opacity-80"
                  )
                : "border border-foreground/10 text-foreground/25 cursor-default pointer-events-none"
            )}
          >
            <ClipboardList className="size-3" /> Sesión
          </Link>

          <button
            title="Renombrar"
            onClick={() => {
              setRenaming(true);
              setRenameVal(list.name);
            }}
            className="p-2 rounded-xl text-foreground/25 hover:text-foreground hover:bg-foreground/8 transition-colors"
          >
            <Pencil className="size-3.5" />
          </button>

          {!list.isDefault && (
            <button
              title="Eliminar colección"
              onClick={() => onDelete(list.id)}
              disabled={deletingId === list.id}
              className="p-2 rounded-xl text-foreground/25 hover:text-red-400 hover:bg-red-400/8 transition-colors disabled:opacity-40"
            >
              {deletingId === list.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Exercise mosaic */}
      {expanded && (
        <div className="border-t border-foreground/8">
          {list.items.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-foreground/30">
                Colección vacía
              </p>
              <p className="mt-1 text-[13px] text-foreground/40">
                Añade ejercicios aquí mismo o guárdalos desde su ficha pulsando{" "}
                <Heart className="inline size-3 fill-current text-red-400/60" />
              </p>
              <button
                type="button"
                onClick={() => setAddExercisesOpen(true)}
                className={cn(
                  "mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors hover:opacity-80",
                  accent.border,
                  accent.text,
                  accent.bg
                )}
              >
                <Plus className="size-3.5" /> Añadir ejercicios
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 divide-x divide-y divide-foreground/8">
                {list.items.map((item) => {
                  const removeKey = `${list.id}:${item.id}`;
                  return (
                    <div
                      key={item.id}
                      className="group/item relative overflow-hidden bg-background hover:bg-foreground/[0.02] transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-24 w-full bg-foreground/5 overflow-hidden">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover/item:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-heading italic text-2xl text-foreground/10">
                              {CATEGORY_LABELS[item.category]?.[0] ?? "·"}
                            </span>
                          </div>
                        )}
                        {/* Remove overlay */}
                        <button
                          onClick={() => onRemoveItem(list.id, item.id)}
                          disabled={removingKey === removeKey}
                          className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-red-500/80 opacity-0 group-hover/item:opacity-100 transition-all duration-200 disabled:opacity-50"
                        >
                          {removingKey === removeKey ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <X className="size-3" />
                          )}
                        </button>
                      </div>

                      {/* Exercise info */}
                      <div className="px-3 py-2.5">
                        <Link
                          href={`/exercises/${item.id}`}
                          className="block font-sans text-[12px] font-medium text-foreground hover:text-brand transition-colors leading-tight line-clamp-1"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "font-sans text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded",
                              accent.bg,
                              accent.text
                            )}
                          >
                            {CATEGORY_LABELS[item.category] ?? item.category}
                          </span>
                          <span className="font-sans text-[9px] text-foreground/30 tabular-nums">
                            {item.durationMinutes}′
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Collection footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-foreground/8 bg-foreground/[0.01]">
                <span className="font-sans text-[10px] text-foreground/35">
                  {list.itemsCount} ejercicio{list.itemsCount !== 1 ? "s" : ""}{" "}
                  en esta colección
                </span>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setAddExercisesOpen(true)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors",
                      accent.text,
                      "hover:opacity-70"
                    )}
                  >
                    Añadir ejercicios <Plus className="size-3" />
                  </button>
                  {list.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setAddToSessionOpen(true)}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors",
                        accent.text,
                        "hover:opacity-70"
                      )}
                    >
                      Añadir a sesión <Plus className="size-3" />
                    </button>
                  )}
                  <Link
                    href={sessionHref}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors",
                      list.items.length > 0
                        ? cn(accent.text, "hover:opacity-70")
                        : "text-foreground/25 pointer-events-none"
                    )}
                  >
                    Crear sesión <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
              <AddToSessionDialog
                open={addToSessionOpen}
                onOpenChange={setAddToSessionOpen}
                exerciseIds={list.items.map((i) => i.id)}
                label={list.name}
              />
            </>
          )}
        </div>
      )}
      <AddExercisesToListDialog
        open={addExercisesOpen}
        onOpenChange={setAddExercisesOpen}
        listId={list.id}
        listName={list.name}
        currentIds={list.items.map((i) => i.id)}
        onAdded={(ex) => onItemAdded(list.id, ex)}
        onRemoved={(exerciseId) => onItemRemoved(list.id, exerciseId)}
      />
    </article>
  );
}

export function ExerciseListsSection({
  inClub = false,
}: {
  /** Trabajando como un club: listas comunes de "Favoritos club". */
  inClub?: boolean;
} = {}) {
  const [lists, setLists] = useState<ExerciseListWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const totalSaved = useMemo(
    () => lists.reduce((sum, l) => sum + l.itemsCount, 0),
    [lists]
  );

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

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadLists(), 0);
    const refresh = () => {
      if (document.visibilityState !== "hidden") void loadLists();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (showCreate) setTimeout(() => createInputRef.current?.focus(), 40);
  }, [showCreate]);

  async function createList() {
    const name = newListName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/exercise-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as {
        data?: {
          id: string;
          name: string;
          emoji: string | null;
          isDefault: boolean;
          createdAt: string;
        };
      };
      if (!payload.data) return;
      setLists((prev) => [
        { ...payload.data!, itemsCount: 0, items: [] },
        ...prev,
      ]);
      setNewListName("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function deleteList(listId: string) {
    setDeletingId(listId);
    try {
      const res = await fetch(`/api/exercise-lists/${listId}`, {
        method: "DELETE",
      });
      if (res.ok) setLists((prev) => prev.filter((l) => l.id !== listId));
    } finally {
      setDeletingId(null);
    }
  }

  function handleRename(listId: string, name: string) {
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)));
  }

  function applyItemAdded(listId: string, exercise: ListableExercise) {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId && !l.items.some((i) => i.id === exercise.id)
          ? {
              ...l,
              itemsCount: l.itemsCount + 1,
              items: [
                ...l.items,
                {
                  id: exercise.id,
                  name: exercise.name,
                  category: exercise.category,
                  difficulty: exercise.difficulty,
                  durationMinutes: exercise.durationMinutes,
                  imageUrl: exercise.imageUrl,
                },
              ],
            }
          : l
      )
    );
  }

  function applyItemRemoved(listId: string, exerciseId: string) {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              itemsCount: Math.max(l.itemsCount - 1, 0),
              items: l.items.filter((i) => i.id !== exerciseId),
            }
          : l
      )
    );
  }

  async function removeFromList(listId: string, exerciseId: string) {
    const key = `${listId}:${exerciseId}`;
    setRemovingKey(key);
    try {
      const res = await fetch(`/api/exercise-lists/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });
      if (res.ok) {
        setLists((prev) =>
          prev.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  itemsCount: Math.max(l.itemsCount - 1, 0),
                  items: l.items.filter((i) => i.id !== exerciseId),
                }
              : l
          )
        );
      }
    } finally {
      setRemovingKey(null);
    }
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="pt-10 pb-6 space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-2xl border border-foreground/8 bg-foreground/[0.02] animate-pulse"
          />
        ))}
      </div>
    );
  }

  /* ── Empty state ── */
  if (lists.length === 0 && !showCreate) {
    return (
      <div className="pt-10 pb-6">
        <div className="relative overflow-hidden rounded-lg border border-dashed border-foreground/15 bg-card">
          <div className="relative px-8 py-16 text-center">
            {/* Decorative heart */}
            <div className="mx-auto mb-6 size-14 rounded-2xl border border-red-400/20 bg-red-400/8 flex items-center justify-center">
              <Heart className="size-6 text-red-400/60 fill-red-400/20" />
            </div>

            <h3 className="font-heading italic text-2xl text-foreground/70">
              Tu cuaderno está vacío.
            </h3>
            <p className="mt-2 text-[14px] text-foreground/40 max-w-xs mx-auto leading-relaxed">
              Crea tu primera colección y guarda ejercicios pulsando{" "}
              <Heart className="inline size-3 fill-current text-red-400/50" />{" "}
              en cualquier ejercicio.
            </p>

            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-5 py-2.5 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#c8f52e]"
            >
              <Plus className="size-4" /> Nueva colección
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-8 pb-6 space-y-8">
      {/* ── Section header ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[9px] uppercase tracking-[0.28em] text-foreground/35 mb-1">
            {inClub
              ? "Favoritos club · comunes a todo el club"
              : "Método · Colecciones"}
          </p>
          <h2 className="font-heading italic text-[22px] leading-tight text-foreground">
            {lists.length === 1
              ? "Una colección guardada"
              : `${lists.length} colecciones · ${totalSaved} ejercicios`}
          </h2>
        </div>

        <button
          onClick={() => setShowCreate((v) => !v)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-all",
            showCreate
              ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
              : "border-foreground/15 text-foreground/50 hover:border-[#D6FF38]/40 hover:bg-[#D6FF38]/10 hover:text-foreground"
          )}
        >
          <Plus
            className={cn(
              "size-3.5 transition-transform duration-200",
              showCreate && "rotate-45"
            )}
          />
          Nueva colección
        </button>
      </div>

      {/* ── Create new collection ── */}
      {showCreate && (
        <div className="rounded-lg border border-[#D6FF38]/30 bg-[#D6FF38]/10 p-4">
          <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-brand/60 mb-2.5">
            Nombre de la colección
          </p>
          <div className="flex gap-2">
            <input
              ref={createInputRef}
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createList();
                if (e.key === "Escape") {
                  setShowCreate(false);
                  setNewListName("");
                }
              }}
              placeholder="Ej: Técnica de volea, Calentamiento tipo A…"
              maxLength={100}
              className="h-10 flex-1 rounded-lg border border-foreground/15 bg-background/70 px-3.5 text-sm text-foreground transition-colors placeholder:text-foreground/30 focus:border-[#D6FF38]/70 focus:outline-none"
            />
            <button
              onClick={() => void createList()}
              disabled={!newListName.trim() || creating}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#D6FF38] px-4 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#c8f52e] disabled:opacity-50"
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

      {/* ── Collection cards ── */}
      <div className="space-y-3">
        {lists.map((list, i) => (
          <CollectionCard
            key={list.id}
            list={list}
            index={i}
            onDelete={(id) => setDeleteTarget(id)}
            onRename={handleRename}
            onRemoveItem={removeFromList}
            onItemAdded={applyItemAdded}
            onItemRemoved={applyItemRemoved}
            deletingId={deletingId}
            removingKey={removingKey}
          />
        ))}
      </div>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="¿Eliminar esta colección?"
        description="Se eliminará la colección y todos sus ejercicios guardados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (deleteTarget) void deleteList(deleteTarget);
        }}
      />
    </div>
  );
}
