// Horario en que un torneo ocupa sus pistas (migración 0110). Lógica pura:
// la usan las reservas de pistas, los avisos de coincidencias y el asistente.
//
// - null o { mode: "all_day" }: todo el día, cada día del torneo.
// - { mode: "daily", start, end }: el mismo horario todos los días.
// - { mode: "by_day", days }: un horario por día; un día que no está = no se
//   juega (las pistas quedan libres).
// start/end: minutos desde medianoche en la zona horaria del torneo.

import { z } from "zod";
import { localToUtc } from "@/lib/bookings/availability";

export type TournamentHours =
  | { mode: "all_day" }
  | { mode: "daily"; start: number; end: number }
  | {
      mode: "by_day";
      days: { date: string; start: number; end: number }[];
    };

const minute = z.number().int().min(0).max(24 * 60);
const range = z
  .object({ start: minute, end: minute })
  .refine((r) => r.end > r.start, {
    message: "La hora de fin tiene que ser posterior a la de inicio",
  });

export const tournamentHoursSchema = z.union([
  z.object({ mode: z.literal("all_day") }),
  z
    .object({ mode: z.literal("daily"), start: minute, end: minute })
    .refine((r) => r.end > r.start, {
      message: "La hora de fin tiene que ser posterior a la de inicio",
    }),
  z.object({
    mode: z.literal("by_day"),
    days: z
      .array(
        z
          .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
          .and(range)
      )
      .max(60),
  }),
]);

/** Días (YYYY-MM-DD) del torneo, del inicio al fin, como mucho 60. */
export function tournamentDays(startDate: string, endDate?: string | null) {
  const out: string[] = [];
  const [y, m, d] = startDate.split("-").map(Number);
  const last = endDate && endDate > startDate ? endDate : startDate;
  for (let i = 0; i < 60; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    if (day > last) break;
    out.push(day);
  }
  return out;
}

/** Franja de cada día de juego (minutos locales). */
export function tournamentDayRanges(t: {
  startDate: string;
  endDate?: string | null;
  playHours?: TournamentHours | null;
}): { date: string; start: number; end: number }[] {
  const days = tournamentDays(t.startDate, t.endDate);
  const h = t.playHours;
  if (!h || h.mode === "all_day") {
    return days.map((date) => ({ date, start: 0, end: 24 * 60 }));
  }
  if (h.mode === "daily") {
    return days.map((date) => ({ date, start: h.start, end: h.end }));
  }
  const byDate = new Map(h.days.map((d) => [d.date, d]));
  return days
    .map((date) => byDate.get(date))
    .filter((d): d is { date: string; start: number; end: number } => !!d)
    .map(({ date, start, end }) => ({ date, start, end }));
}

/** Intervalos (instantes UTC) en que el torneo ocupa sus pistas. */
export function tournamentIntervals(t: {
  startDate: string;
  endDate?: string | null;
  playHours?: TournamentHours | null;
  timeZone?: string | null;
}): { start: Date; end: Date }[] {
  const tz = t.timeZone || "Europe/Madrid";
  return tournamentDayRanges(t).map((r) => ({
    start: localToUtc(r.date, r.start, tz),
    end: localToUtc(r.date, r.end, tz),
  }));
}

/** Texto corto del horario: «Todo el día», «10:00–14:00»… */
export function hoursLabel(h: TournamentHours | null | undefined) {
  const hm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  if (!h || h.mode === "all_day") return "Todo el día";
  if (h.mode === "daily") return `${hm(h.start)}–${hm(h.end)} cada día`;
  return "Horario por días";
}
