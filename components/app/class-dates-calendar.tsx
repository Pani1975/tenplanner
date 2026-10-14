"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  sortSchedule,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";

const MONTH_FORMAT = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
});
const WEEKDAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

function dateKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calendario para elegir una o varias fechas al asignar una clase a un
 * grupo: si el grupo tiene horario habitual, esos días llevan un punto que
 * los distingue (y proponen su hora), pero se puede elegir cualquier otro
 * día igualmente — y más de uno, para repetir la clase varias veces.
 */
export function ClassDatesCalendar({
  schedule,
  busy,
  error,
  onConfirm,
}: {
  schedule: GroupScheduleEntry[];
  busy?: boolean;
  error?: string | null;
  onConfirm: (dates: Date[]) => void;
}) {
  const today = startOfToday();
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const scheduleByWeekday = useMemo(() => {
    const map = new Map<number, string>();
    for (const entry of schedule) map.set(entry.weekday, entry.time);
    return map;
  }, [schedule]);
  const [time, setTime] = useState(
    () => schedule[0]?.time ?? "17:00"
  );

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth(),
      1
    );
    // Offset para que la semana empiece en lunes.
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - leading);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [viewMonth]);

  function toggleDay(d: Date) {
    const key = dateKey(d);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function changeMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function confirm() {
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    const dates = Array.from(selected)
      .map((key) => {
        const [y, m, d] = key.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        date.setHours(hh || 0, mm || 0, 0, 0);
        return date;
      })
      .sort((a, b) => a.getTime() - b.getTime());
    onConfirm(dates);
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Mes anterior"
          className="flex size-8 items-center justify-center rounded-lg text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-bold capitalize text-foreground">
          {MONTH_FORMAT.format(viewMonth)}
        </p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Mes siguiente"
          className="flex size-8 items-center justify-center rounded-lg text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase text-foreground/35">
          {WEEKDAY_HEADERS.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((d) => {
            const key = dateKey(d);
            const inMonth = d.getMonth() === viewMonth.getMonth();
            const isHabitual = scheduleByWeekday.has(d.getDay());
            const isSelected = selected.has(key);
            const isPast = d.getTime() < today.getTime();
            return (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => toggleDay(d)}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  !inMonth && "text-foreground/20",
                  inMonth && !isSelected && "text-foreground/80 hover:bg-foreground/10",
                  isPast && inMonth && !isSelected && "text-foreground/35",
                  isSelected && "bg-[#D6FF38] text-[#050505]"
                )}
              >
                {d.getDate()}
                {isHabitual && !isSelected && (
                  <span className="absolute bottom-1 size-1 rounded-full bg-brand" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 px-3 py-2.5">
        <span className="text-sm font-semibold text-foreground">
          {selected.size === 0
            ? "Ninguna fecha elegida"
            : `${selected.size} fecha${selected.size !== 1 ? "s" : ""} elegida${selected.size !== 1 ? "s" : ""}`}
        </span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-9 rounded-lg border border-foreground/15 bg-background px-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
        />
      </div>

      {schedule.length > 0 && (
        <p className="text-[11px] text-foreground/45">
          <span className="mr-1 inline-block size-1.5 rounded-full bg-brand" />
          Días habituales de este grupo:{" "}
          {sortSchedule(schedule)
            .map((e) => `${WEEKDAY_LABELS[e.weekday]} ${e.time}`)
            .join(" · ")}
        </p>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={busy || selected.size === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D6FF38] py-2.5 text-sm font-bold text-[#050505] disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {selected.size > 1 ? "Crear sesiones" : "Continuar"}
      </button>
    </div>
  );
}
