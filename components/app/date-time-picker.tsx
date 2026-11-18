"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerm } from "@/lib/i18n-terms";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";

const DAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0=Sun→6, convert to Mon=0..Sun=6
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

interface DateTimePickerProps {
  value: string; // "YYYY-MM-DDTHH:mm" local format
  onChange: (value: string) => void;
  error?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  error,
}: DateTimePickerProps) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_app_datetimepicker");
  const term = useTerm();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const rawParsed = value
    ? new Date(value.includes("T") ? value : `${value}T00:00`)
    : null;
  const parsed = rawParsed && !isNaN(rawParsed.getTime()) ? rawParsed : null;

  const [viewYear, setViewYear] = useState(
    parsed?.getFullYear() ?? new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    parsed?.getMonth() ?? new Date().getMonth()
  );
  const [hour, setHour] = useState(
    parsed ? String(parsed.getHours()).padStart(2, "0") : "10"
  );
  const [minute, setMinute] = useState(
    parsed ? String(parsed.getMinutes()).padStart(2, "0") : "00"
  );

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function selectDay(day: number) {
    const h = hour.padStart(2, "0");
    const m = minute.padStart(2, "0");
    const mo = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mo}-${d}T${h}:${m}`);
  }

  function applyTime(h: string, m: string) {
    if (!parsed) return;
    const hNum = Math.min(23, Math.max(0, parseInt(h, 10) || 0));
    const mNum = Math.min(59, Math.max(0, parseInt(m, 10) || 0));
    const mo = String(viewMonth + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    onChange(
      `${viewYear}-${mo}-${dd}T${String(hNum).padStart(2, "0")}:${String(mNum).padStart(2, "0")}`
    );
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  const selectedDay = parsed?.getDate();
  const selectedMonth = parsed?.getMonth();
  const selectedYear = parsed?.getFullYear();
  const isSelectedInView =
    selectedYear === viewYear && selectedMonth === viewMonth;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

  const displayValue = parsed
    ? new Intl.DateTimeFormat(intlLocale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed)
    : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 h-10 px-3 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors",
          error ? "border-destructive" : "border-border",
          displayValue ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
        {displayValue ?? term("Selecciona fecha y hora")}
      </button>

      {open && (
        <div className="absolute z-50 top-12 left-0 bg-card border border-border rounded-2xl shadow-xl p-4 w-72">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">
              {term(MONTHS[viewMonth])} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold text-muted-foreground py-1"
              >
                {term(d)}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = isSelectedInView && selectedDay === day;
              const today = new Date();
              const isToday =
                today.getDate() === day &&
                today.getMonth() === viewMonth &&
                today.getFullYear() === viewYear;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "h-8 w-full flex items-center justify-center rounded-lg text-sm transition-colors font-medium",
                    isSelected
                      ? "bg-brand text-brand-foreground"
                      : isToday
                        ? "border border-brand/40 text-brand hover:bg-brand/10"
                        : "text-foreground hover:bg-muted"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time picker */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">
                {tx("hora")}
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setHour(raw);
                    const clamped = String(
                      Math.min(23, Math.max(0, parseInt(raw, 10) || 0))
                    ).padStart(2, "0");
                    applyTime(clamped, minute);
                  }}
                  onBlur={(e) => {
                    const clamped = String(
                      Math.min(
                        23,
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    ).padStart(2, "0");
                    setHour(clamped);
                  }}
                  className="w-12 h-8 text-center text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/50 text-foreground"
                />
                <span className="text-muted-foreground font-bold">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setMinute(raw);
                    const clamped = String(
                      Math.min(59, Math.max(0, parseInt(raw, 10) || 0))
                    ).padStart(2, "0");
                    applyTime(hour, clamped);
                  }}
                  onBlur={(e) => {
                    const clamped = String(
                      Math.min(
                        59,
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    ).padStart(2, "0");
                    setMinute(clamped);
                  }}
                  className="w-12 h-8 text-center text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/40 focus:border-brand/50 text-foreground"
                />
              </div>
            </div>
          </div>

          {parsed && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full bg-brand text-brand-foreground text-sm font-semibold py-2 rounded-xl hover:bg-brand/90 transition-colors"
            >
              {tx("confirmar")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
