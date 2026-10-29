"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toInputDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 3);
  return { from: toInputDate(from), to: toInputDate(to) };
}

/**
 * Botón + diálogo para generar el informe en PDF del alumno: pregunta la
 * fecha de inicio y de fin del periodo (por defecto, los últimos 3 meses).
 */
export function ReportDialogButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(defaultRange);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = !range.from || !range.to || range.from > range.to;

  function handleOpenChange(next: boolean) {
    if (next) {
      setRange(defaultRange());
      setError(null);
    }
    setOpen(next);
  }

  async function handleDownload() {
    if (invalid) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to });
      const res = await fetch(`/api/students/${studentId}/report?${params}`);
      if (!res.ok) throw new Error("report failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
        `informe-${studentName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setError("No se pudo generar el informe. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[11px] font-black uppercase text-white/70 transition-colors hover:border-[#D6FF38] hover:text-[#D6FF38]"
      >
        <FileText className="size-3" strokeWidth={1.6} />
        Informe
      </button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Informe de {studentName}</DialogTitle>
            <DialogDescription>
              Elige el periodo del informe. Incluirá las sesiones realizadas,
              las estadísticas, los objetivos por nivel y las anotaciones del
              alumno.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="report-from">Desde</Label>
              <Input
                id="report-from"
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) =>
                  setRange((r) => ({ ...r, from: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to">Hasta</Label>
              <Input
                id="report-to"
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) =>
                  setRange((r) => ({ ...r, to: e.target.value }))
                }
              />
            </div>
          </div>

          {range.from && range.to && range.from > range.to && (
            <p className="text-sm font-medium text-destructive">
              La fecha de inicio debe ser anterior a la de fin.
            </p>
          )}
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={invalid || loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Generar informe
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
