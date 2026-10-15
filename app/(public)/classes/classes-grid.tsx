"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, FileDown, Heart, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { autoriaLabel, nivelLabel } from "@/lib/exercise-taxonomy";
import { AddClassesToListDialog } from "@/components/app/add-classes-to-list-dialog";
import { ClassAnimationButton } from "@/components/app/class-animation-player";
import { hasClassAnimation } from "@/lib/classes/animation";

export interface ClassGridItem {
  id: string;
  name: string;
  duracionMinutes: number;
  alumnosTipo: string | null;
  numAlumnos: number | null;
  objetivos: string | null;
  nivel: string | null;
  niveles: string[] | null;
  aspectoJuego: string | null;
  aspectosJuego: string[] | null;
  isLibrary: boolean;
  autoria: string | null;
  status: string | null;
  favorited: boolean;
}

function classValues(values: string[] | null, fallback: string | null) {
  return Array.isArray(values) && values.length > 0
    ? values
    : fallback
      ? [fallback]
      : [];
}

export function ClassesGrid({
  items,
  navQs,
  canSelect,
}: {
  items: ClassGridItem[];
  navQs: string;
  canSelect: boolean;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  const allIds = items.map((i) => i.id);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const count = selected.size;

  // Descarga un único PDF con las clases seleccionadas, en el mismo orden
  // en que aparecen en el listado filtrado.
  async function downloadPdf() {
    const ids = allIds.filter((id) => selected.has(id));
    if (ids.length === 0 || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/classes/pdf?ids=${ids.join(",")}`);
      if (!res.ok) throw new Error("Error generando el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
        "clases.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-3">
      {canSelect && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {selecting ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <button
                  type="button"
                  onClick={() => setSelected(new Set(allIds))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-semibold hover:border-[#D6FF38]/70 hover:text-foreground",
                    allSelected
                      ? "border-[#D6FF38] bg-[#D6FF38]/20 text-foreground"
                      : "border-border text-foreground/70"
                  )}
                >
                  Todas ({allIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-full px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground"
                >
                  Ninguna
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={stopSelecting}
                  className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={count === 0 || downloading}
                  onClick={downloadPdf}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-4 py-2 text-[13px] font-bold text-foreground transition-colors hover:border-[#D6FF38]/70 disabled:opacity-40 dark:bg-white/[0.035]"
                >
                  {downloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileDown className="size-3.5" />
                  )}
                  {downloading
                    ? "Generando…"
                    : `PDF${count > 0 ? ` (${count})` : ""}`}
                </button>
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => setDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#D6FF38] px-4 py-2 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#c8f52e] disabled:opacity-40"
                >
                  <Plus className="size-3.5" />
                  Añadir a lista{count > 0 ? ` (${count})` : ""}
                </button>
              </div>
            </>
          ) : (
            <>
              <span />
              <button
                type="button"
                onClick={() => setSelecting(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-white/[0.035]"
              >
                <Check className="size-3.5" />
                Seleccionar
              </button>
            </>
          )}
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((cls) => {
          const isSelected = selected.has(cls.id);
          const animated = hasClassAnimation(cls.id);
          const cardBody = (
            <>
              <div>
                <div className="mb-4 flex items-start justify-between gap-3 bg-[#050505] px-5 py-3 text-white">
                  <span className="rounded-full bg-[#D6FF38] px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-[#050505]">
                    {cls.duracionMinutes} min
                  </span>
                  <div className="flex items-center gap-1.5">
                    {cls.status === "draft" && (
                      <span className="rounded-full border border-amber-300/60 bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                        Borrador
                      </span>
                    )}
                    {cls.isLibrary && (
                      <span className="rounded-full border border-[#D6FF38]/50 bg-[#D6FF38]/15 px-2 py-0.5 text-[10px] font-semibold text-[#D6FF38]">
                        Biblioteca
                      </span>
                    )}
                    {cls.autoria && cls.autoria !== "libre" && (
                      <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                        {autoriaLabel(cls.autoria)}
                      </span>
                    )}
                    {cls.favorited && (
                      <Heart
                        className="size-3.5 fill-pink-500 text-pink-500"
                        aria-label="Favorito"
                      />
                    )}
                  </div>
                </div>
                <div className="px-5">
                  <h3 className="line-clamp-3 font-heading text-[19px] font-semibold leading-snug text-foreground transition-colors group-hover:text-[#6D7F00] dark:group-hover:text-[#D6FF38]">
                    {cls.name}
                  </h3>
                  {cls.objetivos && (
                    <p className="mt-3 line-clamp-3 text-[13px] leading-5 text-muted-foreground">
                      {cls.objetivos}
                    </p>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "mx-5 mb-5 mt-5 flex flex-wrap gap-1.5 border-t border-border pt-4",
                  animated && "pr-12"
                )}
              >
                <span className="rounded-full border border-border px-2 py-1 text-[10.5px] text-foreground/60">
                  {cls.numAlumnos
                    ? `${cls.numAlumnos} alumnos`
                    : cls.alumnosTipo === "individual"
                      ? "1 alumno"
                      : "Grupo"}
                </span>
                {cls.alumnosTipo && (
                  <span className="rounded-full border border-border px-2 py-1 text-[10.5px] capitalize text-foreground/60">
                    {cls.alumnosTipo}
                  </span>
                )}
                {classValues(cls.niveles, cls.nivel).map((nivel) => (
                  <span
                    key={nivel}
                    className="rounded-full border border-[#D6FF38]/40 bg-[#D6FF38]/15 px-2 py-1 text-[10.5px] text-[#5E6F00] dark:text-[#D6FF38]"
                  >
                    {nivelLabel(nivel)}
                  </span>
                ))}
                {classValues(cls.aspectosJuego, cls.aspectoJuego).map(
                  (aspecto) => (
                    <span
                      key={aspecto}
                      className="rounded-full border border-border px-2 py-1 text-[10.5px] text-foreground/60"
                    >
                      {aspecto.replace(/_/g, " ")}
                    </span>
                  )
                )}
              </div>
            </>
          );

          return (
            <li key={cls.id} className="relative">
              {selecting ? (
                <button
                  type="button"
                  onClick={() => toggle(cls.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "group flex h-full w-full flex-col justify-between overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all dark:bg-white/[0.04]",
                    isSelected
                      ? "border-[#D6FF38] ring-2 ring-[#D6FF38]/40"
                      : "border-[#050505]/10 hover:border-[#D6FF38]/70 dark:border-white/10"
                  )}
                >
                  <span
                    className={cn(
                      "absolute right-3 top-3 z-10 flex size-6 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                        : "border-white/40 bg-black/20 backdrop-blur-sm"
                    )}
                  >
                    {isSelected && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  {cardBody}
                </button>
              ) : (
                <Link
                  href={`/classes/${cls.id}${navQs ? `?${navQs}` : ""}`}
                  className="group flex h-full flex-col justify-between overflow-hidden rounded-lg border border-[#050505]/10 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D6FF38] hover:shadow-[0_24px_50px_rgba(5,5,5,0.12)] dark:border-white/10 dark:bg-white/[0.04]"
                >
                  {cardBody}
                </Link>
              )}
              {animated && !selecting && (
                <ClassAnimationButton
                  classId={cls.id}
                  className="absolute bottom-4 right-4 z-10"
                />
              )}
            </li>
          );
        })}
      </ul>

      <AddClassesToListDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        classIds={Array.from(selected)}
        onDone={stopSelecting}
      />
    </div>
  );
}
