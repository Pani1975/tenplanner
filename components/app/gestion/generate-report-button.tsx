"use client";

import { useState } from "react";
import { FileDown, Loader2, X } from "lucide-react";

export type ReportSectionOption = { id: string; label: string };

/**
 * Botón verde "Generar informe": abre un panel para elegir qué datos incluir
 * y descarga el PDF del periodo que se está viendo.
 */
export function GenerateReportButton({
  sections,
  periodQuery,
  periodLabel,
}: {
  sections: ReportSectionOption[];
  /** Parámetros del periodo ya codificados (periodo, desde, hasta). */
  periodQuery: string;
  periodLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sections.map((s) => s.id))
  );
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams(periodQuery);
      params.set(
        "secciones",
        sections
          .filter((s) => selected.has(s.id))
          .map((s) => s.id)
          .join(",")
      );
      const res = await fetch(`/api/gestion/informe/pdf?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo generar el informe");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "informe-gestion.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505] shadow-sm transition-transform hover:scale-[1.02]"
      >
        <FileDown className="size-4" />
        Generar informe
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !downloading && setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Generar informe"
            className="relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-[28px] border border-[#050505]/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#10100e]"
          >
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-base font-black text-foreground">
                Generar informe
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="ml-auto flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Periodo: <span className="font-semibold">{periodLabel}</span>.
              Elige los datos que quieres que aparezcan en el PDF.
            </p>

            <div className="mb-2 flex gap-3 text-xs font-semibold">
              <button
                type="button"
                className="text-brand"
                onClick={() => setSelected(new Set(sections.map((s) => s.id)))}
              >
                Seleccionar todo
              </button>
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => setSelected(new Set())}
              >
                Quitar todo
              </button>
            </div>

            <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto px-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="size-4 accent-[#6D7F00]"
                    />
                    <span className="text-foreground">{s.label}</span>
                  </label>
                </li>
              ))}
            </ul>

            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

            <button
              type="button"
              onClick={download}
              disabled={downloading || selected.size === 0}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#D6FF38] text-sm font-black text-[#050505] disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              {downloading ? "Generando…" : "Descargar PDF"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
