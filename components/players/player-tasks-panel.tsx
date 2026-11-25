"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PlayerTaskData } from "@/lib/players/tasks";

function formatDue(d: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${d}T00:00:00Z`));
}

/** «Mis tareas»: tareas personales del jugador, solo visibles para él. */
export function PlayerTasksPanel({ tasks }: { tasks: PlayerTaskData[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown, key = "x") {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error && res.status === 422 ? json.error : "No se ha podido guardar. Inténtalo de nuevo.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("No se ha podido guardar. Revisa la conexión.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Escribe un título.");
    const ok = await call("/api/player-tasks", "POST", { title, dueDate: dueDate || null }, "add");
    if (ok) {
      setTitle("");
      setDueDate("");
    }
  }

  return (
    <section className="tp-panel space-y-4 p-4 sm:p-6" aria-labelledby="mis-tareas">
      <div className="flex items-center gap-2">
        <ListTodo className="size-5" />
        <h2 id="mis-tareas" className="text-base font-black">
          Mis tareas
        </h2>
        <span className="text-xs text-muted-foreground">Solo las ves tú</span>
      </div>

      <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-[1fr_11rem_auto] sm:items-end" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="task-title">Nueva tarea</Label>
          <Input
            id="task-title"
            value={title}
            maxLength={255}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="task-due">
            Fecha <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" disabled={busy === "add"} className="h-11 rounded-full font-black">
          {busy === "add" && <Loader2 className="mr-2 size-4 animate-spin" />}
          Añadir
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {tasks.length === 0 ? (
        <p className="text-sm text-foreground/55">Aún no tienes tareas.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-foreground/[0.04] px-3 py-2">
              <button
                type="button"
                aria-label={t.done ? "Marcar como pendiente" : "Marcar como hecha"}
                aria-pressed={t.done}
                disabled={busy === t.id}
                onClick={() => call(`/api/player-tasks/${t.id}`, "PATCH", { done: !t.done }, t.id)}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border",
                  t.done ? "border-brand bg-brand text-brand-foreground" : "border-foreground/25"
                )}
              >
                {t.done && <Check className="size-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-semibold", t.done && "line-through opacity-60")}>
                  {t.title}
                </p>
                {t.dueDate && <p className="text-xs text-muted-foreground">{formatDue(t.dueDate)}</p>}
              </div>
              <button
                type="button"
                aria-label={`Eliminar «${t.title}»`}
                disabled={busy === t.id}
                onClick={() => call(`/api/player-tasks/${t.id}`, "DELETE", undefined, t.id)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-foreground/60 hover:bg-foreground/10"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
