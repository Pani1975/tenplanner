/**
 * Horario semanal habitual de un grupo: qué días de la semana tiene clase
 * y a qué hora. 0=domingo..6=sábado (mismo criterio que WizardRecurrence
 * en components/app/session-wizard/types.ts). `time` en formato "HH:MM".
 * Se guarda en groups.weekly_schedule (jsonb) y es la base para que
 * "Asignar clase" pueda proponer sola la próxima fecha que le toca al
 * grupo, en vez de pedirla siempre a mano.
 */
export interface GroupScheduleEntry {
  weekday: number;
  time: string;
}

export const WEEKDAY_LABELS = [
  "Dom",
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
] as const;

export function isValidScheduleEntry(
  value: unknown
): value is GroupScheduleEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<GroupScheduleEntry>;
  return (
    typeof entry.weekday === "number" &&
    entry.weekday >= 0 &&
    entry.weekday <= 6 &&
    typeof entry.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)
  );
}

export function sortSchedule(
  schedule: GroupScheduleEntry[]
): GroupScheduleEntry[] {
  return [...schedule].sort((a, b) =>
    a.weekday !== b.weekday ? a.weekday - b.weekday : a.time.localeCompare(b.time)
  );
}

/**
 * Próxima fecha/hora (en la hora local del navegador) que toca según el
 * horario del grupo, a partir de `from`. Si hoy mismo coincide un día del
 * horario pero su hora ya ha pasado, salta a la semana siguiente. Null si
 * el grupo no tiene horario configurado.
 */
export function nextScheduleOccurrence(
  schedule: GroupScheduleEntry[] | null | undefined,
  from: Date = new Date()
): Date | null {
  if (!schedule || schedule.length === 0) return null;

  let best: Date | null = null;
  for (const entry of schedule) {
    const [hh, mm] = entry.time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

    const daysUntil = (entry.weekday - from.getDay() + 7) % 7;
    const candidate = new Date(from);
    candidate.setDate(from.getDate() + daysUntil);
    candidate.setHours(hh, mm, 0, 0);
    if (candidate.getTime() <= from.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }

    if (!best || candidate.getTime() < best.getTime()) best = candidate;
  }
  return best;
}

/** "YYYY-MM-DDTHH:mm" en hora local, el formato que usa el wizard de sesión. */
export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
