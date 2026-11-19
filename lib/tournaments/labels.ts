// Ayudas de presentación compartidas por las pantallas de torneos (sin
// textos: los textos están en messages/*.json, espacio "tournaments").

import type { TournamentStatus } from "./status";

/** Clases de la etiqueta de estado (fondos sólidos). */
export const STATUS_BADGE: Record<TournamentStatus, string> = {
  draft: "bg-foreground/10 text-foreground",
  open: "bg-[#d6f04a] text-black",
  closed: "bg-amber-500 text-black",
  in_progress: "bg-emerald-600 text-white",
  finished: "bg-foreground text-background",
};

export const ENTRY_BADGE: Record<string, string> = {
  confirmed: "bg-emerald-600 text-white",
  pending: "bg-amber-500 text-black",
  waitlist: "bg-[#d6f04a] text-black",
  cancelled: "bg-foreground/10 text-foreground/60",
};

/** "2026-12-20" → "20 dic 2026" en el idioma indicado (sin zona horaria). */
export function formatDay(day: string | null | undefined, locale: string) {
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDateRange(
  start: string,
  end: string | null | undefined,
  locale: string
) {
  if (!end || end === start) return formatDay(start, locale);
  return `${formatDay(start, locale)} – ${formatDay(end, locale)}`;
}
