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
  /**
   * Hora de finalización ("HH:MM"), posterior a `time`. Opcional solo para los
   * horarios guardados antes de pedirla; los nuevos siempre la llevan.
   */
  endTime?: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "17:00" + 90 → "18:30" (se queda en el mismo día: tope 23:59). */
export function addMinutesToTime(time: string, minutes: number): string {
  const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Duración en minutos de una entrada del horario, o null si no tiene hora de fin. */
export function scheduleEntryMinutes(
  entry: Pick<GroupScheduleEntry, "time" | "endTime">
): number | null {
  if (!entry.endTime) return null;
  const minutes = toMinutes(entry.endTime) - toMinutes(entry.time);
  return minutes > 0 ? minutes : null;
}

/**
 * Duración (minutos) de la clase del horario que cae en el día de `at`, visto
 * en `timeZone`, o null si ese día no está en el horario o no tiene hora de fin.
 */
export function scheduleMinutesForDate(
  schedule: GroupScheduleEntry[] | null | undefined,
  at: Date,
  timeZone = "Europe/Madrid"
): number | null {
  if (!schedule || schedule.length === 0) return null;
  const short = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone,
  }).format(at);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    short
  );
  const entry = schedule.find((e) => e.weekday === weekday);
  return entry ? scheduleEntryMinutes(entry) : null;
}

/** "17:00" o "17:00–18:30" según tenga hora de fin. */
export function formatScheduleTimes(
  entry: Pick<GroupScheduleEntry, "time" | "endTime">
): string {
  return entry.endTime ? `${entry.time}–${entry.endTime}` : entry.time;
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
    HHMM.test(entry.time) &&
    (entry.endTime === undefined ||
      (typeof entry.endTime === "string" &&
        HHMM.test(entry.endTime) &&
        toMinutes(entry.endTime) > toMinutes(entry.time)))
  );
}

export function sortSchedule(
  schedule: GroupScheduleEntry[]
): GroupScheduleEntry[] {
  return [...schedule].sort((a, b) =>
    a.weekday !== b.weekday
      ? a.weekday - b.weekday
      : a.time.localeCompare(b.time)
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

/** Partes de fecha/hora de `date` en una zona horaria. */
function zonedParts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const p = Object.fromEntries(
    f.formatToParts(date).map((x) => [x.type, x.value])
  );
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: weekdays.indexOf(p.weekday as string),
  };
}

/** Instante UTC de una fecha/hora de pared en una zona horaria. */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = zonedParts(new Date(guess), timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  );
  return new Date(guess - (asUtc - guess));
}

/**
 * Como nextScheduleOccurrence, pero en el servidor: interpreta el horario
 * en `timeZone` (por defecto, España peninsular) y no en la zona del
 * proceso. `graceMinutes` deja ver como "próxima" una clase que empezó
 * hace poco.
 */
export function nextScheduleOccurrenceInZone(
  schedule: GroupScheduleEntry[] | null | undefined,
  from: Date = new Date(),
  timeZone = "Europe/Madrid",
  graceMinutes = 0
): Date | null {
  if (!schedule || schedule.length === 0) return null;
  const limit = from.getTime() - graceMinutes * 60_000;
  const today = zonedParts(from, timeZone);
  let best: Date | null = null;
  for (const entry of schedule) {
    const [hh, mm] = entry.time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    for (const extra of [0, 7]) {
      const days = ((entry.weekday - today.weekday + 7) % 7) + extra;
      const base = new Date(
        Date.UTC(today.year, today.month - 1, today.day + days)
      );
      const at = zonedTimeToUtc(
        base.getUTCFullYear(),
        base.getUTCMonth() + 1,
        base.getUTCDate(),
        hh,
        mm,
        timeZone
      );
      if (at.getTime() <= limit) continue;
      if (!best || at.getTime() < best.getTime()) best = at;
      break;
    }
  }
  return best;
}

/** "YYYY-MM-DDTHH:mm" en hora local, el formato que usa el wizard de sesión. */
export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
