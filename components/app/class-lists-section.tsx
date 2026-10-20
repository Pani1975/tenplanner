"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  FolderPlus,
  Globe,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PickClassesForListDialog,
  type ListableClass,
} from "@/components/app/pick-classes-for-list-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { nivelLabel } from "@/lib/exercise-taxonomy";
import { spaceLabels } from "@/lib/space-labels";

interface ListedClass {
  id: string;
  name: string;
  duracionMinutes: number;
  alumnosTipo: string | null;
  nivel: string | null;
  isLibrary: boolean;
}

interface ClassListWithItems {
  id: string;
  name: string;
  emoji: string | null;
  isDefault: boolean;
  isPublic?: boolean;
  canManage?: boolean;
  createdAt: string;
  itemsCount: number;
  items: ListedClass[];
}

const ACCENT_PALETTE = [
  {
    bg: "bg-brand/8",
    border: "border-brand/20",
    text: "text-brand",
  },
  {
    bg: "bg-violet-500/8",
    border: "border-violet-500/20",
    text: "text-violet-400",
  },
  {
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
  {
    bg: "bg-rose-500/8",
    border: "border-rose-500/20",
    text: "text-rose-400",
  },
  {
    bg: "bg-cyan-500/8",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
  },
];

function ListCard({
  list,
  index,
  onDelete,
  onRename,
  onRemoveItem,
  onTogglePublic,
  isAdmin,
  deletingId,
  removingKey,
  sport,
  onItemAdded,
  onItemRemoved,
  onReload,
}: {
  list: ClassListWithItems;
  index: number;
  onTogglePublic: (id: string, isPublic: boolean) => void;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemoveItem: (listId: string, classId: string) => void;
  deletingId: string | null;
  removingKey: string | null;
  sport?: string | null;
  onItemAdded: (listId: string, cls: ListableClass) => void;
  onItemRemoved: (listId: string, classId: string) => void;
  onReload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(list.name);
  const [renameSaving, setRenameSaving] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const accent = ACCENT_PALETTE[index % ACCENT_PALETTE.length];

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
      const res = await fetch(`/api/class-lists/${list.id}`, {
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
        "overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-sm shadow-black/5 transition-all",
        expanded
          ? "shadow-lg shadow-foreground/5"
          : "hover:border-foreground/20"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-4 cursor-pointer select-none transition-colors",
          expanded ? "bg-foreground/[0.03]" : "hover:bg-foreground/[0.015]"
        )}
        onClick={() => !renaming && setExpanded((v) => !v)}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl text-base border",
            accent.bg,
            accent.border
          )}
        >
          {list.emoji && list.emoji.length <= 2 ? list.emoji : "🎓"}
        </span>

        <div className="min-w-0 flex-1">
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
              <h3 className="font-heading italic text-[16px] leading-tight text-foreground truncate">
                {list.name}
              </h3>
              {list.isDefault && (
                <span className="font-sans text-[8px] uppercase tracking-[0.18em] text-brand/60 border border-brand/25 rounded px-1.5 py-0.5">
                  principal
                </span>
              )}
              {list.isPublic && (
                <span className="font-sans text-[8px] uppercase tracking-[0.18em] text-emerald-600 border border-emerald-500/30 rounded px-1.5 py-0.5 dark:text-emerald-400">
                  pública
                </span>
              )}
            </div>
          )}
          <span
            className={cn("font-sans text-[10px] tabular-nums", accent.text)}
          >
            {list.itemsCount} clase{list.itemsCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {list.canManage !== false && (
            <button
              type="button"
              title="Añadir clases a la lista"
              onClick={() => setPickOpen(true)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold transition-colors hover:opacity-80",
                accent.border,
                accent.text,
                accent.bg
              )}
            >
              <Plus className="size-3" />
              <span className="hidden sm:inline">Clases</span>
            </button>
          )}
          {isAdmin && list.canManage !== false && (
            <button
              title={
                list.isPublic
                  ? "Quitar de la Biblioteca"
                  : "Publicar en la Biblioteca"
              }
              onClick={() => onTogglePublic(list.id, !list.isPublic)}
              className={cn(
                "p-2 rounded-xl transition-colors hover:bg-foreground/8",
                list.isPublic
                  ? "text-emerald-500 hover:text-emerald-600"
                  : "text-foreground/25 hover:text-foreground"
              )}
            >
              <Globe className="size-3.5" />
            </button>
          )}
          {list.canManage !== false && (
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
          )}
          {!list.isDefault && list.canManage !== false && (
            <button
              title="Eliminar lista"
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

      {expanded && (
        <div className="border-t border-foreground/8">
          {list.items.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-foreground/30">
                Lista vacía
              </p>
              <p className="mt-1 text-[13px] text-foreground/40">
                Añade clases aquí mismo o guárdalas desde su ficha con el botón
                de lista
              </p>
              {list.canManage !== false && (
                <button
                  type="button"
                  onClick={() => setPickOpen(true)}
                  className={cn(
                    "mt-4 inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors hover:opacity-80",
                    accent.border,
                    accent.text,
                    accent.bg
                  )}
                >
                  <Plus className="size-3.5" /> Añadir clases
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-foreground/8">
              {list.items.map((item) => {
                const removeKey = `${list.id}:${item.id}`;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-foreground/[0.015] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/classes/${item.id}`}
                        className="block font-sans text-[13px] font-medium text-foreground hover:text-brand transition-colors truncate"
                      >
                        {item.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "font-sans text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded",
                            accent.bg,
                            accent.text
                          )}
                        >
                          {item.duracionMinutes}′
                        </span>
                        {item.nivel && (
                          <span className="font-sans text-[9px] text-foreground/40 px-1.5 py-0.5 rounded border border-foreground/10">
                            {nivelLabel(item.nivel)}
                          </span>
                        )}
                        {item.alumnosTipo && (
                          <span className="font-sans text-[9px] text-foreground/40 px-1.5 py-0.5 rounded border border-foreground/10 capitalize">
                            {item.alumnosTipo}
                          </span>
                        )}
                        {item.isLibrary && (
                          <span className="font-sans text-[9px] text-brand/70 px-1.5 py-0.5 rounded border border-brand/25">
                            Biblioteca
                          </span>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/sessions/new?fromClass=${item.id}`}
                      title="Crear sesión desde esta clase"
                      className={cn(
                        "hidden sm:inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-semibold transition-colors",
                        accent.border,
                        accent.text,
                        accent.bg,
                        "hover:opacity-80"
                      )}
                    >
                      <ClipboardList className="size-3" /> Sesión
                    </Link>

                    <button
                      onClick={() => onRemoveItem(list.id, item.id)}
                      disabled={removingKey === removeKey}
                      title="Quitar de la lista"
                      className="p-2 rounded-xl text-foreground/25 hover:text-red-400 hover:bg-red-400/8 transition-colors disabled:opacity-40 shrink-0"
                    >
                      {removingKey === removeKey ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <PickClassesForListDialog
        open={pickOpen}
        onOpenChange={setPickOpen}
        listId={list.id}
        listName={list.name}
        currentIds={list.items.map((i) => i.id)}
        sport={sport}
        onAdded={(cls) => onItemAdded(list.id, cls)}
        onRemoved={(classId) => onItemRemoved(list.id, classId)}
        onBulkAdded={onReload}
      />
    </article>
  );
}

export function ClassListsSection({
  isAdmin = false,
  spaceLabel = null,
  inClub = false,
  sport,
}: {
  isAdmin?: boolean;
  /** Trabajando como un club: "Listas club" en vez de "Mis listas". */
  inClub?: boolean;
  /** "Espacio particular" o el nombre del club del modo de trabajo. */
  spaceLabel?: string | null;
  /** Deporte activo (para los niveles del filtro al añadir clases). */
  sport?: string | null;
} = {}) {
  const [lists, setLists] = useState<ClassListWithItems[]>([]);
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

  async function loadLists(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/class-lists?includeClasses=true", {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: ClassListWithItems[];
      };
      setLists(Array.isArray(payload.data) ? payload.data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadLists(), 0);
    const refresh = () => {
      if (document.visibilityState !== "hidden") void loadLists(true);
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
      const res = await fetch("/api/class-lists", {
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
      const res = await fetch(`/api/class-lists/${listId}`, {
        method: "DELETE",
      });
      if (res.ok) setLists((prev) => prev.filter((l) => l.id !== listId));
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePublic(listId: string, isPublic: boolean) {
    const res = await fetch(`/api/class-lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic }),
    });
    if (res.ok)
      setLists((prev) =>
        prev.map((l) => (l.id === listId ? { ...l, isPublic } : l))
      );
  }

  function handleRename(listId: string, name: string) {
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name } : l)));
  }

  function applyItemAdded(listId: string, cls: ListableClass) {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId && !l.items.some((i) => i.id === cls.id)
          ? {
              ...l,
              itemsCount: l.itemsCount + 1,
              items: [
                ...l.items,
                {
                  id: cls.id,
                  name: cls.name,
                  duracionMinutes: cls.duracionMinutes,
                  alumnosTipo: cls.alumnosTipo,
                  nivel: cls.nivel,
                  isLibrary: cls.isLibrary,
                },
              ],
            }
          : l
      )
    );
  }

  function applyItemRemoved(listId: string, classId: string) {
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              itemsCount: Math.max(l.itemsCount - 1, 0),
              items: l.items.filter((i) => i.id !== classId),
            }
          : l
      )
    );
  }

  async function removeFromList(listId: string, classId: string) {
    const key = `${listId}:${classId}`;
    setRemovingKey(key);
    try {
      const res = await fetch(`/api/class-lists/${listId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      if (res.ok) {
        setLists((prev) =>
          prev.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  itemsCount: Math.max(l.itemsCount - 1, 0),
                  items: l.items.filter((i) => i.id !== classId),
                }
              : l
          )
        );
      }
    } finally {
      setRemovingKey(null);
    }
  }

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

  if (lists.length === 0 && !showCreate) {
    return (
      <div className="pt-10 pb-6">
        <div className="relative overflow-hidden rounded-lg border border-dashed border-foreground/15 bg-card">
          <div className="relative px-8 py-16 text-center">
            <div className="mx-auto mb-6 size-14 rounded-2xl border border-brand/20 bg-brand/8 flex items-center justify-center">
              <GraduationCap className="size-6 text-brand/60" />
            </div>
            <h3 className="font-heading italic text-2xl text-foreground/70">
              Aún no tienes listas de clases.
            </h3>
            <p className="mt-2 text-[14px] text-foreground/40 max-w-xs mx-auto leading-relaxed">
              Crea tu primera lista y guarda clases desde su ficha con el botón
              de lista.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-5 py-2.5 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#c8f52e]"
            >
              <Plus className="size-4" /> Nueva lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-8 pb-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[9px] uppercase tracking-[0.28em] text-foreground/35 mb-1 flex items-center gap-1.5">
            <FolderPlus className="size-3" /> {spaceLabels(inClub).lists}
            {spaceLabel ? ` · ${spaceLabel}` : ""}
          </p>
          <h2 className="font-heading italic text-[20px] leading-tight text-foreground">
            {lists.length === 1
              ? "Una lista guardada"
              : `${lists.length} listas · ${totalSaved} clases`}
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
          Nueva lista
        </button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-[#D6FF38]/30 bg-[#D6FF38]/10 p-4">
          <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-brand/60 mb-2.5">
            Nombre de la lista
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
              placeholder="Ej: Adultos iniciación, Pistas cubiertas…"
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

      <div className="space-y-3">
        {lists.map((list, i) => (
          <ListCard
            key={list.id}
            list={list}
            index={i}
            onDelete={(id) => setDeleteTarget(id)}
            onRename={handleRename}
            onRemoveItem={removeFromList}
            onTogglePublic={(id, value) => void togglePublic(id, value)}
            isAdmin={isAdmin}
            deletingId={deletingId}
            removingKey={removingKey}
            sport={sport}
            onItemAdded={applyItemAdded}
            onItemRemoved={applyItemRemoved}
            onReload={() => void loadLists(true)}
          />
        ))}
      </div>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="¿Eliminar esta lista?"
        description="Se eliminará la lista y todas sus clases guardadas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (deleteTarget) void deleteList(deleteTarget);
        }}
      />
    </div>
  );
}
