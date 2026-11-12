"use client";

import { useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CalendarEventData {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  clubId?: string | null;
  userId?: string;
  /** Nombre de quien lo creó, solo cuando no es del usuario actual
   * (compartido vía club). */
  authorName?: string | null;
  /** Creado desde el Modo gestión: solo lo ve el gestor. */
  management?: boolean;
  /** Si es una tarea de gestión mostrada en el calendario, su id. */
  taskId?: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Valor para <input type="datetime-local"> en hora local. */
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el diálogo edita este evento en vez de crear uno nuevo. */
  event?: CalendarEventData | null;
  /** Día por defecto para un evento nuevo. */
  defaultDate?: Date;
  onSaved: (event: CalendarEventData) => void;
}) {
  const base = defaultDate ?? new Date();
  const initialStart = event ? new Date(event.startAt) : base;
  const initialEnd = event
    ? new Date(event.endAt)
    : new Date(base.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startValue, setStartValue] = useState(toLocalInput(initialStart));
  const [endValue, setEndValue] = useState(toLocalInput(initialEnd));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = new Date(startValue);
  const end = new Date(endValue);
  const valid =
    title.trim().length > 0 &&
    !isNaN(start.getTime()) &&
    !isNaN(end.getTime()) &&
    end >= start;

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      };
      const res = await fetch(
        event ? `/api/calendar-events/${event.id}` : "/api/calendar-events",
        {
          method: event ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        setError("No se pudo guardar el evento. Inténtalo de nuevo.");
        return;
      }
      const json = (await res.json()) as { data: CalendarEventData };
      onOpenChange(false);
      onSaved(json.data);
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
          <DialogTitle>{event ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>
            Los eventos se muestran en azul, diferenciados de las sesiones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="event-title"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Título
            </label>
            <input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="Ej: Reunión con familias"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[#2563eb] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="event-start"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Fecha de inicio
              </label>
              <input
                id="event-start"
                type="datetime-local"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[#2563eb] focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="event-end"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Fecha de finalización
              </label>
              <input
                id="event-end"
                type="datetime-local"
                value={endValue}
                onChange={(e) => setEndValue(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[#2563eb] focus:outline-none"
              />
            </div>
          </div>

          {end < start && !isNaN(end.getTime()) && !isNaN(start.getTime()) && (
            <p className="text-xs text-destructive">
              La fecha de finalización debe ser posterior a la de inicio.
            </p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="event-description"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Descripción
            </label>
            <textarea
              id="event-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Detalles del evento (opcional)"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
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
              className="inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-5 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : event ? (
                <Save className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {event ? "Guardar cambios" : "Crear evento"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
