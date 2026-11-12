"use client";

import { cn } from "@/lib/utils";
import {
  addMinutesToTime,
  WEEKDAY_LABELS,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";

// Lunes primero en el selector (más natural aquí), aunque weekday sigue
// siendo 0=domingo..6=sábado por debajo (igual que el resto de la app).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Hora de inicio que se propone al marcar un día, y duración inicial. */
export const DEFAULT_CLASS_TIME = "17:00";
export const DEFAULT_CLASS_MINUTES = 60;

/** Hora de inicio y de finalización de la clase de un día. */
export interface ScheduleSlot {
  time: string;
  endTime: string;
}

/** Horario del grupo → estado del selector. Sin hora de fin, propone 1 hora. */
export function scheduleToSlots(
  schedule: GroupScheduleEntry[] | null | undefined
): Map<number, ScheduleSlot> {
  return new Map(
    (schedule ?? []).map((e) => [
      e.weekday,
      {
        time: e.time,
        endTime: e.endTime ?? addMinutesToTime(e.time, DEFAULT_CLASS_MINUTES),
      },
    ])
  );
}

/** Estado del selector → horario para la API. */
export function slotsToSchedule(
  slots: Map<number, ScheduleSlot>
): GroupScheduleEntry[] {
  return Array.from(slots.entries()).map(([weekday, s]) => ({
    weekday,
    time: s.time,
    endTime: s.endTime,
  }));
}

/** ¿Todos los días marcados tienen la hora de fin después de la de inicio? */
export function slotsAreValid(slots: Map<number, ScheduleSlot>): boolean {
  if (slots.size === 0) return false;
  return Array.from(slots.values()).every(
    (s) => !!s.time && !!s.endTime && s.endTime > s.time
  );
}

/**
 * Selector de los días de la semana en que un grupo tiene clase, con la hora
 * de inicio y de finalización de cada uno. El estado lo lleva quien lo usa.
 */
export function WeeklySchedulePicker({
  value,
  onChange,
}: {
  value: Map<number, ScheduleSlot>;
  onChange: (next: Map<number, ScheduleSlot>) => void;
}) {
  function toggleDay(weekday: number) {
    const next = new Map(value);
    if (next.has(weekday)) next.delete(weekday);
    else
      next.set(weekday, {
        time: DEFAULT_CLASS_TIME,
        endTime: addMinutesToTime(DEFAULT_CLASS_TIME, DEFAULT_CLASS_MINUTES),
      });
    onChange(next);
  }

  // Al cambiar el inicio se mueve también el final para mantener la duración.
  function setStart(weekday: number, time: string) {
    const current = value.get(weekday);
    if (!current || !time) return;
    const [h1, m1] = current.time.split(":").map(Number);
    const [h2, m2] = current.endTime.split(":").map(Number);
    const minutes = Math.max(h2 * 60 + m2 - (h1 * 60 + m1), 15);
    const next = new Map(value);
    next.set(weekday, { time, endTime: addMinutesToTime(time, minutes) });
    onChange(next);
  }

  function setEnd(weekday: number, endTime: string) {
    const current = value.get(weekday);
    if (!current) return;
    const next = new Map(value);
    next.set(weekday, { ...current, endTime });
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {DISPLAY_ORDER.map((weekday) => {
        const label = WEEKDAY_LABELS[weekday];
        const slot = value.get(weekday);
        const invalid = !!slot && !(slot.endTime > slot.time);
        return (
          <div
            key={weekday}
            className={cn(
              "rounded-2xl border px-4 py-2.5 transition-colors",
              slot ? "border-[#D6FF38] bg-[#D6FF38]/10" : "border-foreground/10"
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!slot}
                  onChange={() => toggleDay(weekday)}
                  className="size-4 accent-[#D6FF38]"
                />
                <span className="text-sm font-bold text-foreground">
                  {label}
                </span>
              </label>
              {slot && (
                <div className="flex items-center gap-2 text-xs text-foreground/55">
                  <input
                    type="time"
                    aria-label={`Hora de inicio del ${label}`}
                    value={slot.time}
                    onChange={(e) => setStart(weekday, e.target.value)}
                    className="h-9 rounded-lg border border-foreground/15 bg-background px-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
                  />
                  <span>a</span>
                  <input
                    type="time"
                    aria-label={`Hora de finalización del ${label}`}
                    value={slot.endTime}
                    onChange={(e) => setEnd(weekday, e.target.value)}
                    className={cn(
                      "h-9 rounded-lg border bg-background px-2 text-sm text-foreground focus:outline-none",
                      invalid
                        ? "border-destructive"
                        : "border-foreground/15 focus:border-brand/50"
                    )}
                  />
                </div>
              )}
            </div>
            {invalid && (
              <p className="mt-1 text-xs text-destructive">
                La hora de finalización debe ser posterior a la de inicio.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
