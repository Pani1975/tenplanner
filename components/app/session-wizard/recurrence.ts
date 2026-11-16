import type { WizardRecurrence } from "./types";

/** Máximo de sesiones que se crean de una vez (un curso completo cabe). */
export const MAX_RECURRING_SESSIONS = 120;

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local → "YYYY-MM-DD". */
export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Fin de curso por defecto: 30 de junio. Si la sesión es de julio a
 * diciembre, el del año siguiente; si es de enero a junio, el de ese año.
 */
export function defaultCourseEnd(from: Date) {
  const year =
    from.getMonth() >= 6 ? from.getFullYear() + 1 : from.getFullYear();
  return `${year}-06-30`;
}

/** Parte de fecha del nombre automático: AAMMDD (p. ej. 260930). */
export function dateCode(date: Date) {
  return `${String(date.getFullYear()).slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * Código de sesión: AAMMDD_Grupo (p. ej. 260930_Galácticas). Sin grupo
 * (clase suelta a uno o dos jugadores) lleva SG: 260930_SG y, si ese día hay
 * más sesiones sin grupo, 260930_SG2, 260930_SG3…
 */
export function sessionCode(date: Date, groupName: string, sgNumber = 1) {
  const code = dateCode(date);
  const group = groupName.trim();
  if (group) return `${code}_${group}`;
  return `${code}_SG${sgNumber > 1 ? sgNumber : ""}`;
}

/**
 * Fechas de todas las sesiones (incluida la primera), con la misma hora que
 * la primera, en los días de la semana elegidos.
 */
export function computeSessionDates(
  first: Date,
  recurrence: WizardRecurrence | null | undefined
): { dates: Date[]; truncated: boolean } {
  if (isNaN(first.getTime())) return { dates: [], truncated: false };
  if (!recurrence?.enabled) return { dates: [first], truncated: false };

  const weekdays =
    recurrence.weekdays.length > 0 ? recurrence.weekdays : [first.getDay()];

  let lastDay: Date;
  if (recurrence.mode === "until" && recurrence.until) {
    const [y, m, d] = recurrence.until.split("-").map(Number);
    lastDay = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  } else {
    // Semana de la primera sesión + (semanas - 1) semanas más.
    const weeks = Math.max(1, recurrence.weeks || 1);
    const startOfWeek = new Date(first);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    lastDay = new Date(startOfWeek);
    lastDay.setDate(lastDay.getDate() + weeks * 7 - 1);
    lastDay.setHours(23, 59, 59, 999);
  }

  const dates: Date[] = [first];
  let truncated = false;
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor.getTime() <= lastDay.getTime()) {
    if (weekdays.includes(cursor.getDay())) {
      if (dates.length >= MAX_RECURRING_SESSIONS) {
        truncated = true;
        break;
      }
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { dates, truncated };
}
