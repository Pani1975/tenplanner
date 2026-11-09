"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { retitleForDate, titleForCopy } from "@/lib/sessions/retitle";

export interface DialogSession {
  id: string;
  title: string;
  scheduledAt: string;
}

export interface DialogResult {
  id: string;
  title: string;
  scheduledAt: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Valor para <input type="datetime-local"> en hora local. */
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Diálogo para mover una sesión a otra fecha/hora o duplicarla.
 * - "move": cambia la fecha; si el nombre es un código AAMMDD_Grupo, se actualiza.
 * - "duplicate": copia completa (plan, textos libres, alumnos) en la fecha elegida;
 *   por defecto, una semana después. Desde aquí también se puede abrir el
 *   asistente con la sesión cargada para cambiarla antes de guardar.
 */
export function SessionDateDialog({
  mode,
  session,
  open,
  onOpenChange,
  onDone,
}: {
  mode: "move" | "duplicate";
  session: DialogSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: DialogResult) => void;
}) {
  const original = new Date(session.scheduledAt);
  const initial = new Date(original);
  if (mode === "duplicate") initial.setDate(initial.getDate() + 7);

  const [value, setValue] = useState(toLocalInput(initial));
  const [title, setTitle] = useState(() =>
    mode === "duplicate" ? titleForCopy(session.title, original, initial) : ""
  );
  const [titleTouched, setTitleTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = new Date(value);
  const valid = !isNaN(target.getTime());
  const movedTitle =
    mode === "move" && valid
      ? retitleForDate(session.title, original, target)
      : null;

  function onDateChange(next: string) {
    setValue(next);
    const d = new Date(next);
    if (mode === "duplicate" && !titleTouched && !isNaN(d.getTime())) {
      setTitle(titleForCopy(session.title, original, d));
    }
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const scheduledAt = target.toISOString();
      const res =
        mode === "move"
          ? await fetch(`/api/sessions/${session.id}/schedule`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scheduledAt,
                ...(movedTitle ? { title: movedTitle } : {}),
              }),
            })
          : await fetch(`/api/sessions/${session.id}/duplicate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scheduledAt,
                ...(title.trim() ? { title: title.trim() } : {}),
              }),
            });
      if (!res.ok) {
        setError("No se pudo guardar. Inténtalo de nuevo.");
        return;
      }
      const json = (await res.json()) as { data: { id: string } };
      onOpenChange(false);
      onDone({
        id: json.data.id,
        title:
          mode === "move"
            ? (movedTitle ?? session.title)
            : title.trim() || session.title,
        scheduledAt,
      });
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const Icon = mode === "move" ? CalendarDays : Copy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "move" ? "Mover sesión" : "Duplicar sesión"}
          </DialogTitle>
          <DialogDescription>“{session.title}”</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="session-date-input"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              {mode === "move"
                ? "Nueva fecha y hora"
                : "Fecha y hora de la copia"}
            </label>
            <input
              id="session-date-input"
              type="datetime-local"
              value={value}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[#D6FF38] focus:outline-none"
            />
          </div>

          {mode === "duplicate" && (
            <div className="space-y-1.5">
              <label
                htmlFor="session-copy-title"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Nombre de la copia
              </label>
              <input
                id="session-copy-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                maxLength={255}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[#D6FF38] focus:outline-none"
              />
              <p className="text-xs text-muted-foreground">
                Se copia el plan completo y los alumnos. No se copian las notas
                ni la asistencia de la sesión original.
              </p>
            </div>
          )}

          {movedTitle && (
            <p className="text-xs text-muted-foreground">
              El nombre pasará a <strong>{movedTitle}</strong>.
            </p>
          )}

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          {mode === "duplicate" && (
            <p className="text-xs text-muted-foreground">
              ¿Quieres cambiar ejercicios, grupo o repetirla varias semanas?{" "}
              <Link
                href={`/sessions/new?from=${session.id}`}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Editar antes de guardar
              </Link>
            </p>
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
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-5 py-2 text-sm font-bold text-[#050505] hover:bg-[#c8ef2f] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
              {mode === "move" ? "Mover" : "Duplicar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
