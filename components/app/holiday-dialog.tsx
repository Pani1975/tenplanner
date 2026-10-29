"use client";

import { useState } from "react";
import { CalendarOff, Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarHolidayData } from "@/lib/calendar/holidays";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** AAAA-MM-DD en hora local. */
function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const fieldLabel =
  "text-xs font-bold uppercase tracking-wider text-muted-foreground";
const fieldInput =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[#e11d48] focus:outline-none";

export function HolidayDialog({
  open,
  onOpenChange,
  holiday,
  defaultDate,
  groups,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el diálogo edita este festivo en vez de crear uno nuevo. */
  holiday?: CalendarHolidayData | null;
  /** Día por defecto para un festivo nuevo. */
  defaultDate?: Date;
  /** Grupos del espacio actual, para limitar el festivo a uno de ellos. */
  groups: { id: string; name: string }[];
  onSaved: (holiday: CalendarHolidayData) => void;
}) {
  const base = defaultDate ?? new Date();
  const [title, setTitle] = useState(holiday?.title ?? "");
  const [description, setDescription] = useState(holiday?.description ?? "");
  const [startDate, setStartDate] = useState(
    holiday?.startDate ?? toDateInput(base)
  );
  const [endDate, setEndDate] = useState(holiday?.endDate ?? toDateInput(base));
  const [groupId, setGroupId] = useState(holiday?.groupId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeInvalid = !!startDate && !!endDate && endDate < startDate;
  const valid =
    title.trim().length > 0 && !!startDate && !!endDate && !rangeInvalid;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        holiday
          ? `/api/calendar-holidays/${holiday.id}`
          : "/api/calendar-holidays",
        {
          method: holiday ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            startDate,
            endDate,
            groupId: groupId || null,
          }),
        }
      );
      if (!res.ok) {
        setError("No se pudo guardar el festivo. Inténtalo de nuevo.");
        return;
      }
      const json = (await res.json()) as { data: CalendarHolidayData };
      onOpenChange(false);
      onSaved({ ...json.data, canEdit: true });
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {holiday ? "Editar festivo" : "Nuevo festivo"}
          </DialogTitle>
          <DialogDescription>
            Las sesiones que caigan en un festivo se marcan como «no se
            imparte», sin borrarlas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="holiday-title" className={fieldLabel}>
              Nombre
            </label>
            <input
              id="holiday-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="Ej: Vacaciones de Navidad"
              className={fieldInput}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="holiday-start" className={fieldLabel}>
                Desde
              </label>
              <input
                id="holiday-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  const next = e.target.value;
                  setStartDate(next);
                  // Un festivo de un solo día es lo habitual: arrastra el fin.
                  if (!endDate || endDate < next) setEndDate(next);
                }}
                className={fieldInput}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="holiday-end" className={fieldLabel}>
                Hasta (inclusive)
              </label>
              <input
                id="holiday-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={fieldInput}
              />
            </div>
          </div>

          {rangeInvalid && (
            <p className="text-xs text-destructive">
              La fecha final no puede ser anterior a la inicial.
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="holiday-group" className={fieldLabel}>
              Afecta a
            </label>
            <select
              id="holiday-group"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={fieldInput}
            >
              <option value="">Todo (club o calendario completo)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  Solo el grupo {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="holiday-description" className={fieldLabel}>
              Descripción
            </label>
            <textarea
              id="holiday-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Detalles (opcional)"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-[#e11d48] focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!valid || saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#e11d48] px-5 py-2 text-sm font-bold text-white hover:bg-[#be123c] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : holiday ? (
                <Save className="size-4" />
              ) : (
                <CalendarOff className="size-4" />
              )}
              {holiday ? "Guardar cambios" : "Crear festivo"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
