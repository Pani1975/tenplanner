"use client";

import { useState } from "react";
import { Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManagementTaskData } from "@/lib/management-tasks";

type Kind = ManagementTaskData["responsibleKind"];

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[#b45309] focus:outline-none";
const LABEL = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

/**
 * Crear o editar una tarea del Modo gestión: descripción, fecha de
 * finalización (opcional), aviso por correo (opcional) y responsable (un
 * monitor del club, el club u otra persona escrita a mano).
 */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultDate,
  coaches,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ManagementTaskData | null;
  /** AAAA-MM-DD para una tarea nueva creada desde un día del calendario. */
  defaultDate?: string | null;
  coaches: { id: string; name: string }[];
  onSaved: (task: ManagementTaskData) => void;
  onDeleted?: (id: string) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDate ?? "");
  const [notifyEmail, setNotifyEmail] = useState(task?.notifyEmail ?? false);
  const [kind, setKind] = useState<Kind>(task?.responsibleKind ?? "club");
  const [coachId, setCoachId] = useState(
    task?.responsibleUserId ?? coaches[0]?.id ?? ""
  );
  const [otherText, setOtherText] = useState(task?.responsibleText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    title.trim().length > 0 &&
    (kind !== "coach" || !!coachId) &&
    (kind !== "other" || otherText.trim().length > 0);

  async function request(method: "POST" | "PATCH" | "DELETE") {
    return fetch(
      task && method !== "POST"
        ? `/api/management-tasks/${task.id}`
        : "/api/management-tasks",
      {
        method,
        headers: { "Content-Type": "application/json" },
        body:
          method === "DELETE"
            ? undefined
            : JSON.stringify({
                title: title.trim(),
                description: description.trim() || null,
                dueDate: dueDate || null,
                notifyEmail: notifyEmail && !!dueDate,
                responsibleKind: kind,
                responsibleUserId: kind === "coach" ? coachId : null,
                responsibleText: kind === "other" ? otherText.trim() : null,
                done: task?.done ?? false,
              }),
      }
    );
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await request(task ? "PATCH" : "POST");
      if (!res.ok) {
        setError("No se pudo guardar la tarea. Inténtalo de nuevo.");
        return;
      }
      const json = (await res.json()) as { data: ManagementTaskData };
      onOpenChange(false);
      onSaved(json.data);
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      const res = await request("DELETE");
      if (!res.ok) {
        setError("No se pudo eliminar la tarea. Inténtalo de nuevo.");
        return;
      }
      onOpenChange(false);
      onDeleted?.(task.id);
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
          <DialogTitle>{task ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
          <DialogDescription>
            Las tareas son solo del Modo gestión: los monitores no las ven.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="task-title" className={LABEL}>
              Tarea
            </label>
            <input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="Ej: Renovar el seguro de la escuela"
              className={FIELD}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-description" className={LABEL}>
              Descripción
            </label>
            <textarea
              id="task-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Detalles (opcional)"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-[#b45309] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-due" className={LABEL}>
              Fecha de finalización (opcional)
            </label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                if (!e.target.value) setNotifyEmail(false);
              }}
              className={FIELD}
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifyEmail && !!dueDate}
                disabled={!dueDate}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="size-4"
              />
              <span className={dueDate ? "" : "text-muted-foreground"}>
                Avisarme por correo el día de la fecha
              </span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-responsible" className={LABEL}>
              Responsable
            </label>
            <select
              id="task-responsible"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className={FIELD}
            >
              <option value="club">El club</option>
              {coaches.length > 0 && <option value="coach">Un monitor</option>}
              <option value="other">Otra persona</option>
            </select>
            {kind === "coach" && (
              <select
                aria-label="Monitor responsable"
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className={FIELD}
              >
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {kind === "other" && (
              <input
                aria-label="Nombre del responsable"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                maxLength={255}
                placeholder="Nombre o empresa (p. ej. la gestoría)"
                className={FIELD}
              />
            )}
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex items-center justify-between gap-2">
            {task ? (
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Eliminar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
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
                className="inline-flex items-center gap-2 rounded-full bg-[#b45309] px-5 py-2 text-sm font-bold text-white hover:bg-[#92400e] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : task ? (
                  <Save className="size-4" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {task ? "Guardar cambios" : "Crear tarea"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
