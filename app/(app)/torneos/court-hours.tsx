"use client";

// Horario en que el torneo ocupa sus pistas y diálogo de coincidencias con
// sesiones y reservas. Lo usan el asistente de torneo y el formulario de
// editar datos.

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { tournamentDays, type TournamentHours } from "@/lib/tournaments/hours";

export type { TournamentHours };

const DEFAULT_START = 9 * 60;
const DEFAULT_END = 21 * 60;

const toHm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromHm = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return Number.isFinite(h) ? Math.min(h * 60 + (m || 0), 24 * 60) : 0;
};

/** Errores del horario (fin antes del inicio, ningún día de juego). */
export function hoursErrors(
  h: TournamentHours,
  startDate: string,
  endDate: string
): string[] {
  if (h.mode === "daily") return h.end > h.start ? [] : ["range"];
  if (h.mode === "by_day") {
    const days = startDate ? tournamentDays(startDate, endDate || null) : [];
    const used = h.days.filter((d) => days.includes(d.date));
    if (!used.length) return ["noDays"];
    if (used.some((d) => d.end <= d.start)) return ["range"];
  }
  return [];
}

export function CourtHoursPicker({
  value,
  onChange,
  startDate,
  endDate,
}: {
  value: TournamentHours;
  onChange: (h: TournamentHours) => void;
  startDate: string;
  endDate: string;
}) {
  const t = useTranslations("tournaments.courts");
  const days = startDate ? tournamentDays(startDate, endDate || null) : [];
  const multiDay = days.length > 1;
  const dayFmt = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  const choose = (mode: TournamentHours["mode"]) => {
    if (mode === value.mode) return;
    if (mode === "all_day") onChange({ mode });
    else if (mode === "daily") {
      onChange({ mode, start: DEFAULT_START, end: DEFAULT_END });
    } else {
      const base =
        value.mode === "daily"
          ? { start: value.start, end: value.end }
          : { start: DEFAULT_START, end: DEFAULT_END };
      onChange({ mode, days: days.map((date) => ({ date, ...base })) });
    }
  };

  const errs = hoursErrors(value, startDate, endDate);
  const options: { mode: TournamentHours["mode"]; label: string }[] = [
    { mode: "all_day", label: t("allDay") },
    { mode: "daily", label: multiDay ? t("daily") : t("someHours") },
    ...(multiDay ? [{ mode: "by_day" as const, label: t("byDay") }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={value.mode === o.mode}
            onClick={() => choose(o.mode)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-semibold",
              value.mode === o.mode
                ? "bg-[#d6f04a] text-black"
                : "bg-foreground/5 text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {value.mode === "daily" && (
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={toHm(value.start)}
            onChange={(e) =>
              onChange({ ...value, start: fromHm(e.target.value) })
            }
            aria-label={t("from")}
            className="tp-field h-11 w-28 px-3 text-base"
          />
          <span className="text-sm text-foreground/60">–</span>
          <input
            type="time"
            value={toHm(value.end)}
            onChange={(e) =>
              onChange({ ...value, end: fromHm(e.target.value) })
            }
            aria-label={t("to")}
            className="tp-field h-11 w-28 px-3 text-base"
          />
        </div>
      )}

      {value.mode === "by_day" && (
        <ul className="space-y-2">
          {days.map((date) => {
            const d = value.days.find((x) => x.date === date);
            const update = (patch: Partial<{ start: number; end: number }>) =>
              onChange({
                ...value,
                days: value.days.map((x) =>
                  x.date === date ? { ...x, ...patch } : x
                ),
              });
            return (
              <li key={date} className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-11 w-40 items-center gap-2 text-sm font-semibold capitalize">
                  <input
                    type="checkbox"
                    checked={!!d}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        days: e.target.checked
                          ? [
                              ...value.days,
                              { date, start: DEFAULT_START, end: DEFAULT_END },
                            ]
                          : value.days.filter((x) => x.date !== date),
                      })
                    }
                    className="size-4"
                  />
                  {dayFmt.format(new Date(`${date}T00:00:00Z`))}
                </label>
                {d ? (
                  <>
                    <input
                      type="time"
                      value={toHm(d.start)}
                      onChange={(e) =>
                        update({ start: fromHm(e.target.value) })
                      }
                      aria-label={t("from")}
                      className="tp-field h-11 w-28 px-3 text-base"
                    />
                    <span className="text-sm text-foreground/60">–</span>
                    <input
                      type="time"
                      value={toHm(d.end)}
                      onChange={(e) => update({ end: fromHm(e.target.value) })}
                      aria-label={t("to")}
                      className="tp-field h-11 w-28 px-3 text-base"
                    />
                  </>
                ) : (
                  <span className="text-sm text-foreground/50">
                    {t("noPlay")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-foreground/60">{t("hint")}</p>
      {errs.length > 0 && (
        <p className="text-sm font-semibold text-red-600">
          {t(errs[0] === "noDays" ? "errNoDays" : "errRange")}
        </p>
      )}
    </div>
  );
}

export type CourtConflicts = {
  sessions: {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    placeName: string;
    coachName: string | null;
  }[];
  bookings: {
    id: string;
    label: string;
    startAt: string;
    durationMinutes: number;
    placeName: string;
  }[];
};

/** Consulta qué ocupa ya las pistas del torneo. null si no hay pistas. */
export async function fetchCourtConflicts(
  doFetch: (input: string, init?: RequestInit) => Promise<Response>,
  plan: {
    placeIds: string[];
    startDate: string;
    endDate: string | null;
    playHours: TournamentHours;
    timeZone: string;
  }
): Promise<CourtConflicts | null> {
  if (!plan.placeIds.length || !plan.startDate) return null;
  const res = await doFetch("/api/tournaments/court-conflicts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data as CourtConflicts;
}

/**
 * Pregunta, sesión por sesión, si se cancela o se deja. Las reservas solo
 * se avisan: el club decide si llama al cliente.
 */
export function CourtConflictsDialog({
  conflicts,
  timeZone,
  saving,
  onConfirm,
  onClose,
}: {
  conflicts: CourtConflicts;
  timeZone: string;
  saving: boolean;
  onConfirm: (cancelSessionIds: string[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("tournaments.courts");
  // Por defecto se dejan: cancelar es una decisión explícita.
  const [cancel, setCancel] = useState<Set<string>>(new Set());
  const fmt = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  const time = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
  const when = (iso: string, minutes: number) =>
    `${fmt.format(new Date(iso))}–${time.format(
      new Date(new Date(iso).getTime() + minutes * 60_000)
    )}`;
  const toggle = (id: string, on: boolean) =>
    setCancel((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="tp-title text-xl">{t("title")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>

        {conflicts.sessions.length > 0 && (
          <ul className="space-y-2">
            {conflicts.sessions.map((s) => {
              const off = cancel.has(s.id);
              return (
                <li
                  key={s.id}
                  className="space-y-2 rounded-xl border border-border p-3"
                >
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-xs capitalize text-foreground/65">
                      {when(s.scheduledAt, s.durationMinutes)} · {s.placeName}
                      {s.coachName ? ` · ${s.coachName}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2" role="radiogroup">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!off}
                      onClick={() => toggle(s.id, false)}
                      className={cn(
                        "min-h-10 flex-1 rounded-full px-3 text-sm font-semibold",
                        !off
                          ? "bg-foreground text-background"
                          : "bg-foreground/5"
                      )}
                    >
                      {t("keep")}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={off}
                      onClick={() => toggle(s.id, true)}
                      className={cn(
                        "min-h-10 flex-1 rounded-full px-3 text-sm font-semibold",
                        off ? "bg-red-600 text-white" : "bg-foreground/5"
                      )}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {conflicts.bookings.length > 0 && (
          <div className="space-y-2 rounded-xl bg-amber-400/15 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-600" />
              {t("bookingsTitle")}
            </p>
            <ul className="space-y-1 text-xs text-foreground/75">
              {conflicts.bookings.map((b) => (
                <li key={b.id}>
                  {b.label} · {when(b.startAt, b.durationMinutes)} ·{" "}
                  {b.placeName}
                </li>
              ))}
            </ul>
            <p className="text-xs text-foreground/65">{t("bookingsNote")}</p>
          </div>
        )}

        {cancel.size > 0 && (
          <p className="text-xs text-foreground/65">{t("cancelNote")}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 rounded-full px-5 text-sm font-semibold"
          >
            {t("back")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm([...cancel])}
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-6 text-sm font-bold text-black disabled:opacity-40"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {cancel.size > 0
              ? t("saveAndCancel", { count: cancel.size })
              : t("save")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
