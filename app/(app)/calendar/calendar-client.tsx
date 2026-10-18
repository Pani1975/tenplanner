"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SessionDateDialog,
  type DialogResult,
} from "@/components/app/session-date-dialog";
import {
  EventDialog,
  type CalendarEventData,
} from "@/components/app/event-dialog";
import { HolidayDialog } from "@/components/app/holiday-dialog";
import { DayAgenda } from "@/components/app/day-agenda";
import {
  holidayAppliesTo,
  type CalendarHolidayData,
} from "@/lib/calendar/holidays";
import { retitleForDate } from "@/lib/sessions/retitle";
import { cn } from "@/lib/utils";

interface SessionData {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  userId?: string;
  groupId?: string | null;
  /** Nombre de quien la creó, solo cuando no es del usuario actual
   * (compartida vía club). */
  authorName?: string | null;
}

interface CalendarClientProps {
  sessions: SessionData[];
  events?: CalendarEventData[];
  holidays?: CalendarHolidayData[];
  /** Grupos del espacio actual, para limitar un festivo a un grupo. */
  groups?: { id: string; name: string }[];
  /** Id del usuario actual — una sesión/evento de otro monitor (compartido
   * vía club) no se puede arrastrar ni editar desde aquí, solo abrir. */
  currentUserId?: string;
}

type DayItem =
  | { kind: "session"; time: Date; session: SessionData }
  | { kind: "event"; time: Date; event: CalendarEventData };

type ViewMode = "day" | "week" | "month" | "year";

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  year: "Año",
};

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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  // 0=Sun, adjust to Mon-start: Mon=0 ... Sun=6
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function startOfWeek(d: Date) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (copy.getDay() + 6) % 7; // Mon=0 ... Sun=6
  copy.setDate(copy.getDate() - dow);
  return copy;
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayTitle(d: Date) {
  const s = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CalendarClient({
  sessions: initialSessions,
  events: initialEvents = [],
  holidays: initialHolidays = [],
  groups = [],
  currentUserId,
}: CalendarClientProps) {
  const router = useRouter();
  const today = new Date();
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const [sessions, setSessions] = useState(initialSessions);
  const [events, setEvents] = useState(initialEvents);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [toDelete, setToDelete] = useState<SessionData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    mode: "move" | "duplicate";
    session: SessionData;
  } | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("month");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [focusDate, setFocusDate] = useState<Date>(todayMidnight);

  // Eventos (zona azul del calendario, distintos de las sesiones)
  const [eventDialog, setEventDialog] = useState<{
    event: CalendarEventData | null;
  } | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarEventData | null>(
    null
  );
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  // Festivos (zona rosa del calendario): rango de fechas, sin hora.
  const [holidayDialog, setHolidayDialog] = useState<{
    holiday: CalendarHolidayData | null;
  } | null>(null);
  const [holidayToDelete, setHolidayToDelete] =
    useState<CalendarHolidayData | null>(null);
  const [deletingHolidayId, setDeletingHolidayId] = useState<string | null>(
    null
  );
  const [holidayError, setHolidayError] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  // Índices por día (clave AAAA-MM-DD) — cubren toda la ventana cargada,
  // no solo el mes visible, para poder alimentar las vistas de semana y
  // año sin volver a pedir datos al servidor.
  const sessionsByDateKey = new Map<string, SessionData[]>();
  for (const s of sessions) {
    const k = dateKey(new Date(s.scheduledAt));
    if (!sessionsByDateKey.has(k)) sessionsByDateKey.set(k, []);
    sessionsByDateKey.get(k)!.push(s);
  }
  const eventsByDateKey = new Map<string, CalendarEventData[]>();
  for (const e of events) {
    const k = dateKey(new Date(e.startAt));
    if (!eventsByDateKey.has(k)) eventsByDateKey.set(k, []);
    eventsByDateKey.get(k)!.push(e);
  }

  // Cada festivo se expande a sus días (con tope por si el rango es absurdo).
  const holidaysByDateKey = new Map<string, CalendarHolidayData[]>();
  for (const h of holidays) {
    const cursor = new Date(`${h.startDate}T00:00:00`);
    const last = new Date(`${h.endDate}T00:00:00`);
    for (let i = 0; i < 400 && cursor <= last; i++) {
      const k = dateKey(cursor);
      if (!holidaysByDateKey.has(k)) holidaysByDateKey.set(k, []);
      holidaysByDateKey.get(k)!.push(h);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  function holidaysForDate(d: Date): CalendarHolidayData[] {
    return holidaysByDateKey.get(dateKey(d)) ?? [];
  }

  /** La sesión cae en un festivo que le afecta: no se imparte (no se borra). */
  function isNotTaught(session: SessionData) {
    const k = dateKey(new Date(session.scheduledAt));
    return (holidaysByDateKey.get(k) ?? []).some((h) =>
      holidayAppliesTo(h, k, session.groupId)
    );
  }

  function sessionIdNotTaught(id: string) {
    const session = sessions.find((x) => x.id === id);
    return session ? isNotTaught(session) : false;
  }

  function holidayLabel(h: CalendarHolidayData) {
    const group = h.groupId ? groupNameById.get(h.groupId) : null;
    return group ? `${h.title} · ${group}` : h.title;
  }

  function itemsForDate(d: Date): DayItem[] {
    const k = dateKey(d);
    const daySessions = sessionsByDateKey.get(k) ?? [];
    const dayEvents = eventsByDateKey.get(k) ?? [];
    return [
      ...daySessions.map((session) => ({
        kind: "session" as const,
        time: new Date(session.scheduledAt),
        session,
      })),
      ...dayEvents.map((event) => ({
        kind: "event" as const,
        time: new Date(event.startAt),
        event,
      })),
    ].sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  function switchView(next: ViewMode) {
    if (next === view) return;
    if ((next === "day" || next === "week") && view === "month") {
      setFocusDate(
        selectedDay !== null
          ? new Date(viewYear, viewMonth, selectedDay)
          : focusDate
      );
    }
    if (next === "month" && (view === "day" || view === "week")) {
      setViewYear(focusDate.getFullYear());
      setViewMonth(focusDate.getMonth());
      setSelectedDay(focusDate.getDate());
    }
    if (next === "year") {
      setViewYear(
        view === "day" || view === "week" ? focusDate.getFullYear() : viewYear
      );
    }
    setView(next);
  }

  function goToPrev() {
    if (view === "day") {
      setFocusDate((d) => addDays(d, -1));
      return;
    }
    if (view === "week") {
      setFocusDate((d) => addDays(d, -7));
      return;
    }
    if (view === "year") {
      setViewYear((y) => y - 1);
      return;
    }
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDay(null);
  }

  function goToNext() {
    if (view === "day") {
      setFocusDate((d) => addDays(d, 1));
      return;
    }
    if (view === "week") {
      setFocusDate((d) => addDays(d, 7));
      return;
    }
    if (view === "year") {
      setViewYear((y) => y + 1);
      return;
    }
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDay(null);
  }

  function goToToday() {
    setFocusDate(todayMidnight);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    if (view === "month") setSelectedDay(today.getDate());
  }

  function headerLabel() {
    if (view === "day") return formatDayTitle(focusDate);
    if (view === "week") {
      const start = startOfWeek(focusDate);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const startLabel = sameMonth
        ? `${start.getDate()}`
        : `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)}`;
      return `${startLabel} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
    }
    if (view === "year") return `${viewYear}`;
    return `${MONTHS[viewMonth]} ${viewYear}`;
  }

  function handleEventSaved(saved: CalendarEventData) {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === saved.id);
      return exists
        ? prev.map((e) => (e.id === saved.id ? saved : e))
        : [...prev, saved];
    });
    const d = new Date(saved.startAt);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setFocusDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setEventError(null);
    router.refresh();
  }

  async function deleteEvent(event: CalendarEventData) {
    setDeletingEventId(event.id);
    setEventError(null);
    try {
      const res = await fetch(`/api/calendar-events/${event.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setEventError("No se pudo eliminar el evento. Inténtalo de nuevo.");
        return;
      }
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      router.refresh();
    } catch {
      setEventError("Error de red. Inténtalo de nuevo.");
    } finally {
      setDeletingEventId(null);
    }
  }

  function handleHolidaySaved(saved: CalendarHolidayData) {
    setHolidays((prev) => {
      const exists = prev.some((h) => h.id === saved.id);
      return exists
        ? prev.map((h) => (h.id === saved.id ? saved : h))
        : [...prev, saved];
    });
    const d = new Date(`${saved.startDate}T00:00:00`);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setFocusDate(d);
    setHolidayError(null);
    router.refresh();
  }

  async function deleteHoliday(holiday: CalendarHolidayData) {
    setDeletingHolidayId(holiday.id);
    setHolidayError(null);
    try {
      const res = await fetch(`/api/calendar-holidays/${holiday.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setHolidayError("No se pudo eliminar el festivo. Inténtalo de nuevo.");
        return;
      }
      setHolidays((prev) => prev.filter((h) => h.id !== holiday.id));
      router.refresh();
    } catch {
      setHolidayError("Error de red. Inténtalo de nuevo.");
    } finally {
      setDeletingHolidayId(null);
    }
  }

  async function deleteSession(session: SessionData) {
    setDeletingId(session.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError("No se pudo eliminar la sesión. Inténtalo de nuevo.");
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      router.refresh();
    } catch {
      setDeleteError("Error de red. Inténtalo de nuevo.");
    } finally {
      setDeletingId(null);
    }
  }

  // Arrastrar una sesión a otro día: conserva la hora y, si el nombre es un
  // código AAMMDD_Grupo, actualiza la fecha del nombre.
  async function moveSessionToDate(sessionId: string, target: Date) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const old = new Date(session.scheduledAt);
    if (isSameDate(old, target)) return;
    const withTime = new Date(
      target.getFullYear(),
      target.getMonth(),
      target.getDate(),
      old.getHours(),
      old.getMinutes()
    );
    const newTitle = retitleForDate(session.title, old, withTime);
    const previous = sessions;
    setActionError(null);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              scheduledAt: withTime.toISOString(),
              title: newTitle ?? s.title,
            }
          : s
      )
    );
    try {
      const res = await fetch(`/api/sessions/${sessionId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: withTime.toISOString(),
          ...(newTitle ? { title: newTitle } : {}),
        }),
      });
      if (!res.ok) throw new Error("failed");
      router.refresh();
    } catch {
      setSessions(previous);
      setActionError("No se pudo mover la sesión. Inténtalo de nuevo.");
    }
  }

  function handleDialogDone(result: DialogResult) {
    if (!dialog) return;
    const original = dialog.session;
    if (dialog.mode === "move") {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === original.id
            ? { ...s, scheduledAt: result.scheduledAt, title: result.title }
            : s
        )
      );
    } else {
      setSessions((prev) => [
        ...prev,
        {
          id: result.id,
          title: result.title,
          scheduledAt: result.scheduledAt,
          durationMinutes: original.durationMinutes,
        },
      ]);
      const d = new Date(result.scheduledAt);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setSelectedDay(d.getDate());
    }
    setActionError(null);
    router.refresh();
  }

  const selectedSessions =
    selectedDay !== null
      ? (sessionsByDateKey.get(
          dateKey(new Date(viewYear, viewMonth, selectedDay))
        ) ?? [])
      : [];
  const selectedDayItems: DayItem[] =
    selectedDay !== null
      ? itemsForDate(new Date(viewYear, viewMonth, selectedDay))
      : [];

  const focusDaySessions = sessionsByDateKey.get(dateKey(focusDate)) ?? [];
  const focusDayItems = itemsForDate(focusDate);

  const weekStart = startOfWeek(focusDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function defaultDateForNewEvent() {
    if (view === "day" || view === "week") {
      return new Date(
        focusDate.getFullYear(),
        focusDate.getMonth(),
        focusDate.getDate(),
        9,
        0
      );
    }
    if (selectedDay !== null)
      return new Date(viewYear, viewMonth, selectedDay, 9, 0);
    return new Date();
  }

  function pdfLabelFor(d: Date) {
    return `${MONTHS[d.getMonth()].toLowerCase()}-${d.getDate()}-${d.getFullYear()}`;
  }

  function renderMiniMonth(month: number) {
    const dim = getDaysInMonth(viewYear, month);
    const fd = getFirstDayOfMonth(viewYear, month);
    const cells = Math.ceil((fd + dim) / 7) * 7;
    return (
      <div
        key={month}
        className="rounded-2xl border border-[#050505]/10 bg-white p-3 dark:border-white/10 dark:bg-[#10100e]"
      >
        <button
          type="button"
          onClick={() => {
            setViewMonth(month);
            setSelectedDay(null);
            setView("month");
          }}
          className="mb-2 block w-full text-center text-xs font-black uppercase text-foreground/70 hover:text-brand"
        >
          {MONTHS[month]}
        </button>
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: cells }).map((_, idx) => {
            const dayNum = idx - fd + 1;
            const isValid = dayNum >= 1 && dayNum <= dim;
            if (!isValid) return <div key={idx} />;
            const d = new Date(viewYear, month, dayNum);
            const key = dateKey(d);
            const hasItems =
              sessionsByDateKey.has(key) || eventsByDateKey.has(key);
            const isHoliday = holidaysByDateKey.has(key);
            const isToday = isSameDate(d, todayMidnight);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setFocusDate(d);
                  setView("day");
                }}
                className="mx-auto flex flex-col items-center justify-center py-0.5"
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                    isToday
                      ? "bg-brand text-brand-foreground"
                      : isHoliday
                        ? "bg-[#e11d48]/15 text-[#be123c] dark:text-[#fda4af]"
                        : "text-foreground/70 hover:bg-muted"
                  )}
                >
                  {dayNum}
                </span>
                <span
                  className={cn(
                    "mt-0.5 size-1 rounded-full",
                    hasItems && !isToday ? "bg-brand" : "bg-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar header */}
      <div className="tp-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <button
            onClick={goToPrev}
            className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 bg-white transition-colors hover:bg-brand dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-brand dark:hover:text-brand-foreground"
            aria-label="Anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="min-w-0 flex-1 text-center text-xl font-black capitalize text-foreground sm:min-w-[220px] sm:flex-none">
            {headerLabel()}
          </h2>
          <button
            onClick={goToNext}
            className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 bg-white transition-colors hover:bg-brand dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-brand dark:hover:text-brand-foreground"
            aria-label="Siguiente"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex rounded-full border border-[#050505]/10 bg-[#F4F4F1] p-1 dark:border-white/10 dark:bg-white/[0.04]">
            {(["day", "week", "month", "year"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => switchView(v)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-black transition-colors",
                  view === v
                    ? "bg-brand text-brand-foreground"
                    : "text-foreground/60 hover:text-foreground"
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <button
            onClick={goToToday}
            className="h-10 rounded-full border border-[#050505]/10 bg-white px-4 text-sm font-black text-foreground/62 transition-colors hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]"
          >
            Hoy
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground transition-colors hover:bg-brand/90"
                />
              }
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Añadir</span>
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href="/sessions/new" />}>
                <ClipboardList className="size-4" />
                Nueva sesión
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEventDialog({ event: null })}>
                <CalendarDays className="size-4 text-[#2563eb]" />
                Nuevo evento
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setHolidayDialog({ holiday: null })}
              >
                <CalendarOff className="size-4 text-[#e11d48]" />
                Nuevo festivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Vista mensual */}
      {view === "month" && (
        <>
          <div className="overflow-x-auto rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-60px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]">
            <div className="min-w-[640px]">
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
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const dayNum = idx - firstDay + 1;
                  const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                  const cellDate = isValid
                    ? new Date(viewYear, viewMonth, dayNum)
                    : null;
                  const cellKey = cellDate ? dateKey(cellDate) : null;
                  const isToday =
                    isValid && cellDate && isSameDate(cellDate, todayMidnight);
                  const isPast =
                    isValid && cellDate !== null && cellDate < todayMidnight;
                  const isSelected = isValid && selectedDay === dayNum;
                  const daySessions =
                    isValid && cellKey
                      ? (sessionsByDateKey.get(cellKey) ?? [])
                      : [];
                  const dayItems: DayItem[] = cellDate
                    ? itemsForDate(cellDate)
                    : [];
                  const hasSessions = daySessions.length > 0;
                  const hasItems = dayItems.length > 0;
                  const dayHolidays = cellDate ? holidaysForDate(cellDate) : [];
                  const hasHoliday = dayHolidays.length > 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!isValid) return;
                        const next = dayNum === selectedDay ? null : dayNum;
                        setSelectedDay(next);
                        if (next !== null)
                          setFocusDate(new Date(viewYear, viewMonth, next));
                      }}
                      onDragOver={(e) => {
                        if (!isValid || !cellKey) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverDate !== cellKey) setDragOverDate(cellKey);
                      }}
                      onDragLeave={() => {
                        if (dragOverDate === cellKey) setDragOverDate(null);
                      }}
                      onDrop={(e) => {
                        if (!isValid || !cellDate) return;
                        e.preventDefault();
                        setDragOverDate(null);
                        const id = e.dataTransfer.getData("text/plain");
                        if (id) void moveSessionToDate(id, cellDate);
                      }}
                      className={cn(
                        isValid &&
                          dragOverDate === cellKey &&
                          "ring-2 ring-inset ring-brand bg-brand/15",
                        "min-h-[78px] border-b border-r border-[#050505]/10 p-2 transition-colors last-of-type:border-r-0 dark:border-white/10 sm:min-h-[108px]",
                        isValid ? "cursor-pointer" : "cursor-default",
                        !isValid && "bg-[#F4F4F1]/70 dark:bg-white/[0.025]",
                        isValid &&
                          hasHoliday &&
                          !isSelected &&
                          "bg-[#e11d48]/[0.06]",
                        isValid && isPast && !isSelected && "opacity-50",
                        isSelected && "bg-brand/15",
                        isValid &&
                          !isSelected &&
                          "hover:bg-[#F4F4F1] dark:hover:bg-white/[0.04]",
                        idx >= totalCells - 7 && "border-b-0"
                      )}
                    >
                      {isValid && (
                        <>
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "flex size-8 items-center justify-center rounded-full text-sm font-black",
                                isToday && "bg-brand text-brand-foreground",
                                !isToday && "text-foreground"
                              )}
                            >
                              {dayNum}
                            </span>
                            {hasItems && !isToday && (
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  hasSessions ? "bg-brand" : "bg-[#2563eb]"
                                )}
                              />
                            )}
                          </div>
                          {(hasItems || hasHoliday) && (
                            <div className="mt-1 space-y-0.5">
                              {dayHolidays.slice(0, 1).map((h) => (
                                <div
                                  key={`h-${h.id}`}
                                  title={holidayLabel(h)}
                                  className="truncate rounded-full bg-[#e11d48]/15 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-[#be123c] dark:text-[#fda4af]"
                                >
                                  {holidayLabel(h)}
                                </div>
                              ))}
                              {dayHolidays.length > 1 && (
                                <div className="px-1.5 text-[10px] text-[#be123c] dark:text-[#fda4af]">
                                  +{dayHolidays.length - 1} festivo
                                  {dayHolidays.length - 1 !== 1 ? "s" : ""}
                                </div>
                              )}
                              {dayItems.slice(0, 2).map((item) =>
                                item.kind === "session" ? (
                                  <Link
                                    key={`s-${item.session.id}`}
                                    href={`/sessions/${item.session.id}`}
                                    draggable={
                                      !currentUserId ||
                                      item.session.userId === currentUserId
                                    }
                                    onDragStart={(e) => {
                                      if (
                                        currentUserId &&
                                        item.session.userId !== currentUserId
                                      ) {
                                        e.preventDefault();
                                        return;
                                      }
                                      e.dataTransfer.setData(
                                        "text/plain",
                                        item.session.id
                                      );
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEnd={() => setDragOverDate(null)}
                                    onClick={(e) => e.stopPropagation()}
                                    title={
                                      item.session.authorName
                                        ? `${item.session.title} · ${item.session.authorName}`
                                        : item.session.title
                                    }
                                    className={cn(
                                      "block truncate rounded-full bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-foreground transition-colors hover:bg-brand hover:text-brand-foreground",
                                      isNotTaught(item.session) &&
                                        "line-through opacity-60"
                                    )}
                                  >
                                    {item.session.title}
                                    {item.session.authorName && (
                                      <span className="opacity-60">
                                        {" "}
                                        · {item.session.authorName}
                                      </span>
                                    )}
                                  </Link>
                                ) : (
                                  <button
                                    key={`e-${item.event.id}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        currentUserId &&
                                        item.event.userId !== currentUserId
                                      )
                                        return;
                                      setEventDialog({ event: item.event });
                                    }}
                                    title={
                                      item.event.authorName
                                        ? `${item.event.title} · ${item.event.authorName}`
                                        : item.event.title
                                    }
                                    className="block w-full truncate rounded-full bg-[#2563eb]/15 px-1.5 py-0.5 text-left text-[10px] font-bold leading-tight text-[#1d4ed8] transition-colors hover:bg-[#2563eb] hover:text-white dark:text-[#93b9ff]"
                                  >
                                    {item.event.title}
                                    {item.event.authorName && (
                                      <span className="opacity-60">
                                        {" "}
                                        · {item.event.authorName}
                                      </span>
                                    )}
                                  </button>
                                )
                              )}
                              {dayItems.length > 2 && (
                                <div className="text-[10px] text-muted-foreground px-1.5">
                                  +{dayItems.length - 2} más
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedDay !== null && (
            <DayAgenda
              title={`${MONTHS[viewMonth]} ${selectedDay}`}
              items={selectedDayItems}
              sessionsForPdf={selectedSessions}
              pdfDayLabel={pdfLabelFor(
                new Date(viewYear, viewMonth, selectedDay)
              )}
              onAddEvent={() => setEventDialog({ event: null })}
              onMoveSession={(s) => setDialog({ mode: "move", session: s })}
              onDuplicateSession={(s) =>
                setDialog({ mode: "duplicate", session: s })
              }
              onDeleteSession={(s) => setToDelete(s)}
              deletingSessionId={deletingId}
              onEditEvent={(e) => setEventDialog({ event: e })}
              onDeleteEvent={(e) => setEventToDelete(e)}
              deletingEventId={deletingEventId}
              deleteError={deleteError}
              eventError={eventError}
              holidays={holidaysForDate(
                new Date(viewYear, viewMonth, selectedDay)
              )}
              holidayLabel={holidayLabel}
              isSessionNotTaught={sessionIdNotTaught}
              onAddHoliday={() => setHolidayDialog({ holiday: null })}
              onEditHoliday={(h) => setHolidayDialog({ holiday: h })}
              onDeleteHoliday={(h) => setHolidayToDelete(h)}
              deletingHolidayId={deletingHolidayId}
              holidayError={holidayError}
            />
          )}
        </>
      )}

      {/* Vista diaria */}
      {view === "day" && (
        <DayAgenda
          title={formatDayTitle(focusDate)}
          items={focusDayItems}
          sessionsForPdf={focusDaySessions}
          pdfDayLabel={pdfLabelFor(focusDate)}
          onAddEvent={() => setEventDialog({ event: null })}
          onMoveSession={(s) => setDialog({ mode: "move", session: s })}
          onDuplicateSession={(s) =>
            setDialog({ mode: "duplicate", session: s })
          }
          onDeleteSession={(s) => setToDelete(s)}
          deletingSessionId={deletingId}
          onEditEvent={(e) => setEventDialog({ event: e })}
          onDeleteEvent={(e) => setEventToDelete(e)}
          deletingEventId={deletingEventId}
          deleteError={deleteError}
          eventError={eventError}
          holidays={holidaysForDate(focusDate)}
          holidayLabel={holidayLabel}
          isSessionNotTaught={sessionIdNotTaught}
          onAddHoliday={() => setHolidayDialog({ holiday: null })}
          onEditHoliday={(h) => setHolidayDialog({ holiday: h })}
          onDeleteHoliday={(h) => setHolidayToDelete(h)}
          deletingHolidayId={deletingHolidayId}
          holidayError={holidayError}
        />
      )}

      {/* Vista semanal */}
      {view === "week" && (
        <div className="overflow-x-auto rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-60px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]">
          <div className="grid min-w-[700px] grid-cols-7 divide-x divide-[#050505]/10 dark:divide-white/10">
            {weekDays.map((d) => {
              const key = dateKey(d);
              const items = itemsForDate(d);
              const isToday = isSameDate(d, todayMidnight);
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverDate !== key) setDragOverDate(key);
                  }}
                  onDragLeave={() => {
                    if (dragOverDate === key) setDragOverDate(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDate(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) void moveSessionToDate(id, d);
                  }}
                  className={cn(
                    "min-h-[160px] p-2 transition-colors",
                    dragOverDate === key &&
                      "ring-2 ring-inset ring-brand bg-brand/15"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFocusDate(d);
                      setView("day");
                    }}
                    className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-muted"
                  >
                    <span className="text-[11px] font-black uppercase text-foreground/52">
                      {DAYS[(d.getDay() + 6) % 7]}
                    </span>
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-xs font-black",
                        isToday
                          ? "bg-brand text-brand-foreground"
                          : "text-foreground"
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </button>
                  <div className="space-y-1">
                    {holidaysForDate(d).map((h) => (
                      <div
                        key={`h-${h.id}`}
                        title={holidayLabel(h)}
                        className="truncate rounded-full bg-[#e11d48]/15 px-2 py-1 text-[11px] font-bold leading-tight text-[#be123c] dark:text-[#fda4af]"
                      >
                        {holidayLabel(h)}
                      </div>
                    ))}
                    {items.map((item) =>
                      item.kind === "session" ? (
                        <Link
                          key={`s-${item.session.id}`}
                          href={`/sessions/${item.session.id}`}
                          draggable={
                            !currentUserId ||
                            item.session.userId === currentUserId
                          }
                          onDragStart={(e) => {
                            if (
                              currentUserId &&
                              item.session.userId !== currentUserId
                            ) {
                              e.preventDefault();
                              return;
                            }
                            e.dataTransfer.setData(
                              "text/plain",
                              item.session.id
                            );
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragOverDate(null)}
                          title={
                            item.session.authorName
                              ? `${item.session.title} · ${item.session.authorName}`
                              : item.session.title
                          }
                          className={cn(
                            "block truncate rounded-full bg-brand/20 px-2 py-1 text-[11px] font-bold leading-tight text-foreground transition-colors hover:bg-brand hover:text-brand-foreground",
                            isNotTaught(item.session) &&
                              "line-through opacity-60"
                          )}
                        >
                          {item.session.title}
                          {item.session.authorName && (
                            <span className="opacity-60">
                              {" "}
                              · {item.session.authorName}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <button
                          key={`e-${item.event.id}`}
                          type="button"
                          onClick={() => {
                            if (
                              currentUserId &&
                              item.event.userId !== currentUserId
                            )
                              return;
                            setEventDialog({ event: item.event });
                          }}
                          title={
                            item.event.authorName
                              ? `${item.event.title} · ${item.event.authorName}`
                              : item.event.title
                          }
                          className="block w-full truncate rounded-full bg-[#2563eb]/15 px-2 py-1 text-left text-[11px] font-bold leading-tight text-[#1d4ed8] transition-colors hover:bg-[#2563eb] hover:text-white dark:text-[#93b9ff]"
                        >
                          {item.event.title}
                          {item.event.authorName && (
                            <span className="opacity-60">
                              {" "}
                              · {item.event.authorName}
                            </span>
                          )}
                        </button>
                      )
                    )}
                    {items.length === 0 && holidaysForDate(d).length === 0 && (
                      <p className="px-1 text-[11px] text-muted-foreground">
                        —
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vista anual */}
      {view === "year" && (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, m) => renderMiniMonth(m))}
        </div>
      )}

      {actionError && (
        <p className="text-sm font-medium text-destructive">{actionError}</p>
      )}

      {dialog && (
        <SessionDateDialog
          key={`${dialog.mode}-${dialog.session.id}`}
          mode={dialog.mode}
          session={dialog.session}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          onDone={handleDialogDone}
        />
      )}

      {eventDialog && (
        <EventDialog
          key={eventDialog.event?.id ?? "new"}
          event={eventDialog.event}
          defaultDate={defaultDateForNewEvent()}
          open
          onOpenChange={(open) => {
            if (!open) setEventDialog(null);
          }}
          onSaved={handleEventSaved}
        />
      )}

      {holidayDialog && (
        <HolidayDialog
          key={holidayDialog.holiday?.id ?? "new"}
          holiday={holidayDialog.holiday}
          defaultDate={defaultDateForNewEvent()}
          groups={groups}
          open
          onOpenChange={(open) => {
            if (!open) setHolidayDialog(null);
          }}
          onSaved={handleHolidaySaved}
        />
      )}

      <ConfirmDialog
        open={holidayToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setHolidayToDelete(null);
        }}
        title="¿Eliminar este festivo?"
        description={
          holidayToDelete
            ? `“${holidayToDelete.title}” dejará de aparecer en el calendario y las sesiones que marcaba como «no se imparte» volverán a la normalidad.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (holidayToDelete) void deleteHoliday(holidayToDelete);
        }}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title="¿Eliminar esta sesión?"
        description={
          toDelete
            ? `“${toDelete.title}” se borrará con su plan de ejercicios y sus notas. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (toDelete) void deleteSession(toDelete);
        }}
      />

      <ConfirmDialog
        open={eventToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setEventToDelete(null);
        }}
        title="¿Eliminar este evento?"
        description={
          eventToDelete
            ? `“${eventToDelete.title}” se eliminará del calendario. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (eventToDelete) void deleteEvent(eventToDelete);
        }}
      />
    </div>
  );
}
