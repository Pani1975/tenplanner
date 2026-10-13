"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";

// Lunes primero en el selector (más natural aquí), aunque weekday sigue
// siendo 0=domingo..6=sábado por debajo (igual que el resto de la app).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Días (y hora) en que el grupo tiene clase habitualmente. Esto es lo que
 * "Asignar clase" usa para proponer sola la próxima fecha que le toca al
 * grupo, en vez de preguntarla siempre a mano.
 */
export function GroupScheduleEditor({
  groupId,
  initialSchedule,
}: {
  groupId: string;
  initialSchedule: GroupScheduleEntry[] | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<Map<number, string>>(
    new Map((initialSchedule ?? []).map((e) => [e.weekday, e.time]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentEntries = [...(initialSchedule ?? [])].sort(
    (a, b) => a.weekday - b.weekday
  );

  function openEditor() {
    setSchedule(
      new Map((initialSchedule ?? []).map((e) => [e.weekday, e.time]))
    );
    setError(null);
    setOpen(true);
  }

  function toggleDay(weekday: number) {
    setSchedule((prev) => {
      const next = new Map(prev);
      if (next.has(weekday)) next.delete(weekday);
      else next.set(weekday, "17:00");
      return next;
    });
  }

  function setTime(weekday: number, time: string) {
    setSchedule((prev) => {
      const next = new Map(prev);
      next.set(weekday, time);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const weeklySchedule: GroupScheduleEntry[] = Array.from(
        schedule.entries()
      ).map(([weekday, time]) => ({ weekday, time }));
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklySchedule }),
      });
      if (!res.ok) {
        setError("No se pudo guardar el horario.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#050505]/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <CalendarClock className="size-4 shrink-0 text-brand" />
      {currentEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este grupo aún no tiene días de clase fijados.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {currentEntries.map((e) => (
            <span
              key={e.weekday}
              className="rounded-full bg-[#D6FF38]/20 px-2.5 py-1 text-xs font-bold text-foreground"
            >
              {WEEKDAY_LABELS[e.weekday]} {e.time}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={openEditor}
        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-3.5" />
        {currentEntries.length === 0 ? "Fijar días" : "Editar"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !saving && setOpen(false)}
          />
          <div className="relative w-full overflow-hidden rounded-t-3xl border border-foreground/15 bg-background shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-foreground/10 px-5 pb-4 pt-5">
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
                  Horario habitual
                </p>
                <h2 className="truncate text-lg font-black text-foreground">
                  Días de clase del grupo
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-xl text-foreground/40 hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
              <p className="mb-1 text-xs text-foreground/50">
                Elige los días en que este grupo tiene clase y a qué hora.
                &ldquo;Asignar clase&rdquo; propondrá sola la próxima fecha a
                partir de esto, aunque siempre podrás cambiarla o añadir un
                día suelto.
              </p>
              {DISPLAY_ORDER.map((weekday) => {
                const label = WEEKDAY_LABELS[weekday];
                const active = schedule.has(weekday);
                return (
                  <div
                    key={weekday}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-2.5 transition-colors",
                      active
                        ? "border-[#D6FF38] bg-[#D6FF38]/10"
                        : "border-foreground/10"
                    )}
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleDay(weekday)}
                        className="size-4 accent-[#D6FF38]"
                      />
                      <span className="text-sm font-bold text-foreground">
                        {label}
                      </span>
                    </label>
                    {active && (
                      <input
                        type="time"
                        value={schedule.get(weekday)}
                        onChange={(e) => setTime(weekday, e.target.value)}
                        className="h-9 rounded-lg border border-foreground/15 bg-background px-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
                      />
                    )}
                  </div>
                );
              })}
              {error && (
                <p className="text-sm font-medium text-destructive">{error}</p>
              )}
            </div>

            <div className="border-t border-foreground/10 px-4 py-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D6FF38] py-2.5 text-sm font-bold text-[#050505] disabled:opacity-60"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
