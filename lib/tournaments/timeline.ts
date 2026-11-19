// Pestañas del menú Torneos de jugadores y familias: pasados, actuales y
// futuros. Función pura (la fecha de hoy entra como "AAAA-MM-DD").

import type { TournamentStatus } from "./status";

export type TimelineTab = "past" | "current" | "upcoming";

export function timelineTab(
  t: {
    status: TournamentStatus;
    startDate: string;
    endDate: string | null;
  },
  today: string
): TimelineTab {
  if (t.status === "finished") return "past";
  if (t.status === "in_progress") return "current";
  const end = t.endDate ?? t.startDate;
  if (end < today) return "past";
  if (t.startDate <= today) return "current";
  return "upcoming";
}

/** "AAAA-MM-DD" de hoy en la zona horaria de España. */
export function todayInMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
