"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Copy,
  Folder,
  Pencil,
  PenTool,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ResourceFormDialog,
  type ResourceData,
} from "@/components/app/resource-form-dialog";
import { CourtBoardDialog } from "@/components/app/court-board-dialog";
import { isDrawingUrl } from "@/lib/court-board";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type SubTab = "all" | "favorites";

export function ResourcesPanel({
  userId,
  inClub = false,
  canManageClub = false,
  canCopyToParticular = false,
}: {
  userId: string;
  /** Trabajando como un club: se ven los recursos de todos, en carpetas. */
  inClub?: boolean;
  /** Es el gestor del club activo (puede borrar recursos de cualquiera). */
  canManageClub?: boolean;
  canCopyToParticular?: boolean;
}) {
  const tx = useTranslations("ui.s_app_resourcespanel");
  const [resources, setResources] = useState<ResourceData[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [dialogState, setDialogState] = useState<{
    resource: ResourceData | null;
  } | null>(null);
  const [boardState, setBoardState] = useState<{
    resource: ResourceData | null;
  } | null>(null);
  const [toDelete, setToDelete] = useState<ResourceData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/resources");
        if (!res.ok) throw new Error("failed");
        const json = (await res.json()) as { data: ResourceData[] };
        if (active) setResources(json.data);
      } catch {
        if (active) setLoadError(tx("noSePudieronCargar"));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function handleSaved(saved: ResourceData) {
    setResources((prev) => {
      const list = prev ?? [];
      const exists = list.some((r) => r.id === saved.id);
      return exists
        ? list.map((r) => (r.id === saved.id ? saved : r))
        : [saved, ...list];
    });
  }

  async function toggleFavorite(resource: ResourceData) {
    setTogglingId(resource.id);
    setActionError(null);
    const next = !resource.isFavorite;
    setResources(
      (prev) =>
        prev?.map((r) =>
          r.id === resource.id ? { ...r, isFavorite: next } : r
        ) ?? prev
    );
    try {
      const res = await fetch(`/api/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setResources(
        (prev) =>
          prev?.map((r) =>
            r.id === resource.id ? { ...r, isFavorite: !next } : r
          ) ?? prev
      );
      setActionError(tx("noSePudoActualizar"));
    } finally {
      setTogglingId(null);
    }
  }

  async function copyToParticular(resource: ResourceData) {
    setCopyingId(resource.id);
    setActionError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/resources/${resource.id}/copy`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("failed");
      setNotice(tx("v1SeCopioA", { v1: resource.title }));
    } catch {
      setActionError(tx("noSePudoCopiar"));
    } finally {
      setCopyingId(null);
    }
  }

  async function deleteResource(resource: ResourceData) {
    setDeletingId(resource.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/resources/${resource.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      setResources((prev) => prev?.filter((r) => r.id !== resource.id) ?? prev);
    } catch {
      setActionError(tx("noSePudoEliminar"));
    } finally {
      setDeletingId(null);
    }
  }

  const list = resources ?? [];
  const visible =
    !inClub && subTab === "favorites" ? list.filter((r) => r.isFavorite) : list;

  // Espacio del club: una carpeta por monitor, la propia primero.
  const folders = inClub
    ? Array.from(
        visible.reduce((map, r) => {
          const key = r.userId ?? userId;
          map.set(key, [...(map.get(key) ?? []), r]);
          return map;
        }, new Map<string, ResourceData[]>())
      ).sort(([a], [b]) => (a === userId ? -1 : b === userId ? 1 : 0))
    : [];

  function renderCard(r: ResourceData) {
    const isMine = !r.userId || r.userId === userId;
    const canDelete = isMine || canManageClub;
    return (
      <div key={r.id} className="tp-panel space-y-3 p-4">
        <div className="flex items-start gap-3">
          {r.imageUrl ? (
            <a
              href={r.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={tx("verImagen")}
              className="shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- stored/external url preview */}
              <img
                src={r.imageUrl}
                alt={r.title}
                className="size-12 rounded-xl object-cover border border-foreground/10"
              />
            </a>
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-background text-muted-foreground">
              {r.documentUrl ? (
                <FileText className="size-5" />
              ) : (
                <Link2 className="size-5" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">
              {r.title}
            </p>
            {r.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {r.description}
              </p>
            )}
          </div>
          {!inClub && (
            <button
              type="button"
              onClick={() => void toggleFavorite(r)}
              disabled={togglingId === r.id}
              aria-label={
                r.isFavorite ? tx("quitarDeFavoritos") : tx("anadirAFavoritos")
              }
              title={
                r.isFavorite ? tx("quitarDeFavoritos") : tx("anadirAFavoritos")
              }
              className="shrink-0 text-muted-foreground transition-colors hover:text-brand disabled:opacity-50"
            >
              {r.isFavorite ? (
                <Star className="size-4.5 fill-brand text-brand" />
              ) : (
                <Star className="size-4.5" />
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              <Link2 className="size-3.5" />
              {tx("enlace")}
              <ExternalLink className="size-3" />
            </a>
          )}
          {r.documentUrl && (
            <a
              href={r.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              <FileText className="size-3.5" />
              {r.documentName ?? "Documento"}
            </a>
          )}
          {!r.url && !r.documentUrl && r.imageUrl && (
            <a
              href={r.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              <ImageIcon className="size-3.5" />
              {isDrawingUrl(r.imageUrl) ? "Ver dibujo" : "Ver imagen"}
              <ExternalLink className="size-3" />
            </a>
          )}
          {isMine && isDrawingUrl(r.imageUrl) && (
            <button
              type="button"
              onClick={() => setBoardState({ resource: r })}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:bg-brand/10"
            >
              <PenTool className="size-3.5" />
              {tx("editarDibujo")}
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            {isMine && (
              <button
                type="button"
                onClick={() =>
                  isDrawingUrl(r.imageUrl)
                    ? setBoardState({ resource: r })
                    : setDialogState({ resource: r })
                }
                aria-label={`Editar ${r.title}`}
                title={tx("editarRecurso")}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
            )}
            {inClub && canCopyToParticular && (
              <button
                type="button"
                onClick={() => void copyToParticular(r)}
                disabled={copyingId === r.id}
                title={tx("copiarAMiEspacio")}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-foreground/10 px-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
              >
                {copyingId === r.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {tx("copiarAMiEspacio2")}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setToDelete(r)}
                disabled={deletingId === r.id}
                aria-label={`Eliminar ${r.title}`}
                title={tx("eliminarRecurso")}
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                {deletingId === r.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            "flex gap-1 rounded-full border border-foreground/10 bg-background p-1",
            inClub && "invisible"
          )}
        >
          {(
            [
              { id: "all" as SubTab, label: tx("todos") },
              { id: "favorites" as SubTab, label: tx("favoritos") },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-black transition-colors",
                subTab === id
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBoardState({ resource: null })}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-brand/40 px-4 text-sm font-black text-brand transition-colors hover:bg-brand/10"
          >
            <PenTool className="size-4" />
            {tx("nuevaPizarra")}
          </button>
          <button
            type="button"
            onClick={() => setDialogState({ resource: null })}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground transition-colors hover:bg-brand/90"
          >
            <Plus className="size-4" />
            {tx("nuevoRecurso")}
          </button>
        </div>
      </div>

      {loadError && (
        <p className="text-sm font-medium text-destructive">{loadError}</p>
      )}
      {notice && (
        <p className="text-sm font-medium text-foreground/80">{notice}</p>
      )}
      {actionError && (
        <p className="text-sm font-medium text-destructive">{actionError}</p>
      )}

      {resources === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="tp-panel border-dashed p-8 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            {subTab === "favorites"
              ? tx("aunNoTienesRecursos")
              : tx("aunNoHasAnadido")}
          </p>
          <button
            type="button"
            onClick={() => setDialogState({ resource: null })}
            className="inline-flex items-center gap-1.5 text-sm font-black text-brand transition-colors hover:text-brand/80"
          >
            <Plus className="size-4" />
            {tx("anadirRecurso")}
          </button>
        </div>
      ) : inClub ? (
        <div className="space-y-6">
          {folders.map(([ownerId, items]) => (
            <section key={ownerId} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-black text-foreground">
                <Folder className="size-4 text-brand" />
                {ownerId === userId
                  ? "Mi carpeta"
                  : `Carpeta de ${items[0]?.authorName ?? "otro monitor"}`}
                <span className="text-xs font-semibold text-muted-foreground">
                  {items.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map(renderCard)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map(renderCard)}
        </div>
      )}

      {dialogState && (
        <ResourceFormDialog
          key={dialogState.resource?.id ?? "new"}
          open
          onOpenChange={(open) => {
            if (!open) setDialogState(null);
          }}
          userId={userId}
          resource={dialogState.resource}
          onSaved={handleSaved}
        />
      )}

      {boardState && (
        <CourtBoardDialog
          key={boardState.resource?.id ?? "new-board"}
          open
          onOpenChange={(open) => {
            if (!open) setBoardState(null);
          }}
          userId={userId}
          resource={boardState.resource}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={tx("eliminarEsteRecurso")}
        description={
          toDelete ? tx("v1SeEliminaraDe", { v1: toDelete.title }) : undefined
        }
        confirmLabel={tx("eliminar")}
        destructive
        onConfirm={() => {
          if (toDelete) void deleteResource(toDelete);
        }}
      />
    </div>
  );
}
