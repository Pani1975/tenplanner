"use client";

import { useEffect, useState } from "react";
import { Check, FileDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

type SessionOption = {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
};

function formatTime(iso: string, loc: string = "es-ES") {
  return new Date(iso).toLocaleTimeString(loc, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function downloadPdf(ids: string[], fallbackName: string) {
  const res = await fetch(`/api/sessions/pdf?ids=${ids.join(",")}`);
  if (!res.ok) throw new Error("Error generando el PDF");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
    fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Diálogo para generar el PDF de las sesiones de un día: si solo hay
 * una, se descarga directamente sin mostrar el diálogo (ver
 * `DayPdfButton`); si hay varias, permite elegir cuáles incluir.
 */
export function DayPdfDialog({
  open,
  onOpenChange,
  sessions,
  dayLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: SessionOption[];
  /** Ej. "lunes 6 de octubre" — para el título del diálogo. */
  dayLabel: string;
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_app_daypdfdialog");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(sessions.map((s) => s.id))
  );
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set(sessions.map((s) => s.id)));
      setError(null);
    }
    // Solo al abrir: no queremos resetear la selección mientras el
    // usuario está marcando casillas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = selected.size === sessions.length;

  async function handleDownload() {
    if (selected.size === 0) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadPdf(Array.from(selected), `sesiones-${dayLabel}.pdf`);
      onOpenChange(false);
    } catch {
      setError(tx("noSePudoGenerar"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tx("generarPdf")}</DialogTitle>
          <DialogDescription>
            {tx("eligeLasSesionesDe", { v1: dayLabel })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(sessions.map((s) => s.id))
              )
            }
            className="text-xs font-semibold text-brand hover:underline"
          >
            {allSelected ? "Deseleccionar todas" : "Seleccionar todas"}
          </button>

          <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {sessions.map((session) => {
              const isSelected = selected.has(session.id);
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => toggle(session.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    isSelected ? "bg-brand/10" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border"
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {session.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {tx("v1V2Min", { v1: formatTime(session.scheduledAt, intlLocale), v2: session.durationMinutes })}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              {tx("cancelar")}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={selected.size === 0 || downloading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" />
              )}
              {tx("descargarPdf")}
              {selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botón "PDF" para un día con sesiones: descarga directa si solo hay
 * una sesión, o abre el diálogo de selección si hay varias.
 */
export function DayPdfButton({
  sessions,
  dayLabel,
  className,
}: {
  sessions: SessionOption[];
  dayLabel: string;
  className?: string;
}) {
  const tx = useTranslations("ui.s_app_daypdfdialog");
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (sessions.length === 0) return null;

  async function handleClick() {
    if (sessions.length === 1) {
      setDownloading(true);
      try {
        await downloadPdf([sessions[0].id], `sesion-${dayLabel}.pdf`);
      } catch {
        // silencioso — el botón vuelve a su estado normal
      } finally {
        setDownloading(false);
      }
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={downloading}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border border-brand/30 px-3 text-xs font-black text-brand transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-50",
          className
        )}
      >
        {downloading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileDown className="size-3.5" />
        )}
        {tx("pdf")}
      </button>
      <DayPdfDialog
        open={open}
        onOpenChange={setOpen}
        sessions={sessions}
        dayLabel={dayLabel}
      />
    </>
  );
}
