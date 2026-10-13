"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Plus, Loader2, FileDown, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassListPicker } from "./class-list-picker";
import { ShareButton } from "@/components/app/share-button";

interface ClassActionsProps {
  classId: string;
  initialFavorite: boolean;
  /** Nombre de la clase, mostrado en el diálogo de confirmación. */
  className?: string;
  /** Solo el creador puede eliminarla. */
  canDelete?: boolean;
}

export function ClassActions({
  classId,
  initialFavorite,
  className,
  canDelete = false,
}: ClassActionsProps) {
  const router = useRouter();
  const [fav, setFav] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/classes/${classId}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleteError("No se pudo eliminar la clase. Inténtalo de nuevo.");
      setDeleting(false);
      return;
    }
    router.push("/classes");
    router.refresh();
  }

  async function toggleFavorite() {
    setBusy(true);
    const method = fav ? "DELETE" : "POST";
    const res = await fetch(`/api/classes/${classId}/favorite`, { method });
    if (res.ok) setFav(!fav);
    setBusy(false);
  }

  function addToSession() {
    // De momento redirige a /sessions/new con un parámetro fromClass.
    // El wizard de sesión usará el parámetro para precargar bloques.
    router.push(`/sessions/new?fromClass=${classId}`);
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/classes/${classId}/pdf`);
      if (!res.ok) throw new Error("Error generando PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
        `clase-${classId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silencioso — el botón vuelve a su estado normal
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addToSession}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#D6FF38] px-4 py-2.5 text-sm font-black text-[#050505] transition hover:bg-white active:scale-95"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Añadir a mis sesiones</span>
          <span className="sm:hidden">Añadir</span>
        </button>
        <ClassListPicker classId={classId} />
        <ShareButton
          title="Clase"
          text="Mira esta clase en Ten Planner"
          iconOnly
          className="flex size-10 items-center justify-center rounded-full border border-white/16 text-white/55 transition-colors hover:border-[#D6FF38] hover:text-[#D6FF38]"
        />
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          aria-label="Descargar PDF"
          title="Descargar PDF"
          className={cn(
            "flex size-10 items-center justify-center rounded-full border border-white/16 text-white/55 transition-colors hover:border-[#D6FF38] hover:text-[#D6FF38]",
            downloadingPdf && "opacity-60"
          )}
        >
          {downloadingPdf ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileDown className="size-4" strokeWidth={1.6} />
          )}
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          disabled={busy}
          aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border transition-colors",
            fav
              ? "border-[#D6FF38]/60 bg-[#D6FF38]/15 text-[#D6FF38]"
              : "border-white/16 text-white/55 hover:border-[#D6FF38] hover:text-[#D6FF38]",
            busy && "opacity-60"
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Heart
              className={cn("size-4", fav && "fill-current")}
              strokeWidth={1.6}
            />
          )}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Eliminar clase"
            title="Eliminar clase"
            className="flex size-10 items-center justify-center rounded-full border border-white/16 text-white/55 transition-colors hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" strokeWidth={1.6} />
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">
                  Eliminar clase
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  ¿Seguro que quieres eliminar{" "}
                  <span className="font-medium text-foreground">
                    {className ?? "esta clase"}
                  </span>
                  ? Esta acción no se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => !deleting && setShowDeleteConfirm(false)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>

            {deleteError && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <p className="text-xs text-destructive">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => !deleting && setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 text-sm font-medium text-muted-foreground border border-border px-4 py-2.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-destructive/90 active:scale-95 transition-all duration-150 disabled:opacity-60"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
