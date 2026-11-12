"use client";

import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS } from "@/lib/groups/schedule";

// Lunes primero en el selector (más natural aquí), aunque weekday sigue
// siendo 0=domingo..6=sábado por debajo (igual que el resto de la app).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Hora que se propone al marcar un día. */
export const DEFAULT_CLASS_TIME = "17:00";

/**
 * Selector de los días de la semana en que un grupo tiene clase y la hora de
 * cada uno. El estado (weekday → "HH:MM") lo lleva quien lo usa.
 */
export function WeeklySchedulePicker({
  value,
  onChange,
}: {
  value: Map<number, string>;
  onChange: (next: Map<number, string>) => void;
}) {
  function toggleDay(weekday: number) {
    const next = new Map(value);
    if (next.has(weekday)) next.delete(weekday);
    else next.set(weekday, DEFAULT_CLASS_TIME);
    onChange(next);
  }

  function setTime(weekday: number, time: string) {
    const next = new Map(value);
    next.set(weekday, time);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {DISPLAY_ORDER.map((weekday) => {
        const label = WEEKDAY_LABELS[weekday];
        const active = value.has(weekday);
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
              <span className="text-sm font-bold text-foreground">{label}</span>
            </label>
            {active && (
              <input
                type="time"
                aria-label={`Hora del ${label}`}
                value={value.get(weekday)}
                onChange={(e) => setTime(weekday, e.target.value)}
                className="h-9 rounded-lg border border-foreground/15 bg-background px-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
