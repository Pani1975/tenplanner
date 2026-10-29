"use client";

import { useState } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  holidayAppliesTo,
  type CalendarHolidayData,
} from "@/lib/calendar/holidays";
import { cn } from "@/lib/utils";

interface SessionData {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled";
  objective: string | null;
  location: string | null;
  groupId: string | null;
  attended: boolean | null;
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const pad2 = (n: number) => n.toString().padStart(2, "0");
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const timeLabel = (d: Date) =>
  new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/**
 * Calendario de solo lectura para las familias: clases del jugador (con el
 * objetivo, sin los ejercicios), festivos y sesiones que no se imparten.
 * Los días se calculan en la hora del navegador, como en el calendario del
 * monitor.
 */
export function FamilyCalendarClient({
  sessions,
  holidays,
  groupNames,
}: {
  sessions: SessionData[];
  holidays: CalendarHolidayData[];
  groupNames: Record<string, string>;
}) {
  const today = new Date();
  const todayKey = dateKey(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string>(todayKey);

  const sessionsByDay = new Map<string, SessionData[]>();
  for (const s of sessions) {
    const k = dateKey(new Date(s.scheduledAt));
    if (!sessionsByDay.has(k)) sessionsByDay.set(k, []);
    sessionsByDay.get(k)!.push(s);
  }

  function holidaysOn(k: string) {
    return holidays.filter((h) => k >= h.startDate && k <= h.endDate);
  }
  function notTaught(s: SessionData) {
    const k = dateKey(new Date(s.scheduledAt));
    return holidays.some((h) => holidayAppliesTo(h, k, s.groupId));
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelected(todayKey);
  }

  const selectedSessions = sessionsByDay.get(selected) ?? [];
  const selectedHolidays = holidaysOn(selected);
  const [sy, sm, sd] = selected.split("-").map(Number);
  const selectedLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(sy, sm - 1, sd));

  return (
    <div className="space-y-6">
      <div className="tp-panel flex items-center justify-between gap-3 p-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Mes anterior"
          className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 bg-white hover:bg-brand dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-brand-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="flex-1 text-center text-xl font-black text-foreground">
          {MONTHS[month]} {year}
        </h2>
        <button
          type="button"
          onClick={goToday}
          className="h-10 rounded-full border border-[#050505]/10 bg-white px-4 text-sm font-black text-foreground/62 hover:bg-muted dark:border-white/10 dark:bg-white/[0.04]"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Mes siguiente"
          className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 bg-white hover:bg-brand dark:border-white/10 dark:bg-white/[0.04] dark:hover:text-brand-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-[#050505]/10 bg-white dark:border-white/10 dark:bg-[#10100e]">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-7 border-b border-[#050505]/10 bg-[#F4F4F1] dark:border-white/10 dark:bg-white/[0.04]">
            {DAYS.map((d) => (
              <div
                key={d}
                className="py-3 text-center text-xs font-black uppercase text-foreground/52"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: cells }).map((_, idx) => {
              const dayNum = idx - firstDay + 1;
              if (dayNum < 1 || dayNum > daysInMonth)
                return (
                  <div
                    key={idx}
                    className="min-h-[72px] border-b border-r border-[#050505]/10 bg-[#F4F4F1]/70 dark:border-white/10 dark:bg-white/[0.025] sm:min-h-[96px]"
                  />
                );
              const k = dateKey(new Date(year, month, dayNum));
              const daySessions = sessionsByDay.get(k) ?? [];
              const dayHolidays = holidaysOn(k);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelected(k)}
                  aria-label={`${dayNum} de ${MONTHS[month]}`}
                  aria-pressed={selected === k}
                  className={cn(
                    "min-h-[72px] border-b border-r border-[#050505]/10 p-1.5 text-left transition-colors dark:border-white/10 sm:min-h-[96px] sm:p-2",
                    dayHolidays.length > 0 && "bg-[#e11d48]/[0.06]",
                    selected === k && "bg-brand/15",
                    "hover:bg-[#F4F4F1] dark:hover:bg-white/[0.04]"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm font-black",
                      k === todayKey
                        ? "bg-brand text-brand-foreground"
                        : "text-foreground"
                    )}
                  >
                    {dayNum}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayHolidays.slice(0, 1).map((h) => (
                      <div
                        key={h.id}
                        className="truncate rounded-full bg-[#e11d48]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#be123c] dark:text-[#fda4af]"
                      >
                        {h.title}
                      </div>
                    ))}
                    {daySessions.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "truncate rounded-full bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-foreground",
                          (s.status === "cancelled" || notTaught(s)) &&
                            "line-through opacity-60"
                        )}
                      >
                        {timeLabel(new Date(s.scheduledAt))} {s.title}
                      </div>
                    ))}
                    {daySessions.length > 2 && (
                      <div className="px-1.5 text-[10px] text-muted-foreground">
                        +{daySessions.length - 2} más
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-black capitalize text-foreground">
          {selectedLabel}
          {selectedSessions.length === 0 && selectedHolidays.length === 0 && (
            <span className="ml-2 text-sm font-semibold normal-case text-muted-foreground">
              — Sin clases
            </span>
          )}
        </h3>

        {selectedHolidays.map((h) => (
          <div
            key={h.id}
            className="tp-panel flex items-center gap-4 border-[#e11d48]/25 bg-[#e11d48]/[0.05] p-4"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e11d48]/15">
              <CalendarOff className="size-5 text-[#be123c] dark:text-[#fda4af]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {h.title}
                {h.groupId && groupNames[h.groupId]
                  ? ` · ${groupNames[h.groupId]}`
                  : ""}
              </p>
              {h.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {h.description}
                </p>
              )}
            </div>
            <span className="ml-auto rounded-full bg-[#e11d48]/15 px-3 py-1.5 text-xs font-black text-[#be123c] dark:text-[#fda4af]">
              Festivo
            </span>
          </div>
        ))}

        {selectedSessions.map((s) => {
          const start = new Date(s.scheduledAt);
          const end = new Date(start.getTime() + s.durationMinutes * 60_000);
          const off = s.status === "cancelled" || notTaught(s);
          return (
            <div key={s.id} className="tp-panel space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-black text-brand">
                  {timeLabel(start)} – {timeLabel(end)}
                </span>
                <p
                  className={cn(
                    "text-sm font-semibold text-foreground",
                    off && "line-through opacity-60"
                  )}
                >
                  {s.title}
                </p>
                {s.groupId && groupNames[s.groupId] && (
                  <span className="text-xs text-muted-foreground">
                    Grupo {groupNames[s.groupId]}
                  </span>
                )}
                {off && (
                  <span className="rounded-full bg-[#e11d48]/15 px-2.5 py-1 text-[11px] font-black text-[#be123c] dark:text-[#fda4af]">
                    {s.status === "cancelled"
                      ? "Cancelada"
                      : "No se imparte (festivo)"}
                  </span>
                )}
              </div>
              {s.location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {s.location}
                </p>
              )}
              {s.objective && !off && (
                <p className="text-sm leading-6 text-foreground/75">
                  <span className="font-black text-foreground">Objetivo: </span>
                  {s.objective}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
