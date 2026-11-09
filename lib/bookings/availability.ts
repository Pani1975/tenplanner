/**
 * Reserva pública de pistas: horas, zona horaria y disponibilidad.
 * Funciones puras, usadas en el servidor (validar) y en la página pública
 * (pintar la rejilla de horas).
 */

/** Zona horaria de los clubes (de momento, todos en Canarias). */
export const BOOKING_TIME_ZONE = "Atlantic/Canary";
/** Duraciones que se pueden reservar, en minutos. */
export const BOOKING_DURATIONS = [60, 90, 120] as const;
export type BookingDuration = (typeof BOOKING_DURATIONS)[number];
/** Las reservas empiezan en punto o a y media. */
export const BOOKING_STEP_MINUTES = 30;
/** Días que se muestran para reservar (hoy incluido). */
export const BOOKING_DAYS_AHEAD = 7;

export const DEFAULT_OPEN_MINUTE = 8 * 60;
export const DEFAULT_CLOSE_MINUTE = 22 * 60;

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface BookablePlace {
  id: string;
  name: string;
  /** Minutos desde medianoche (hora local) en que abre y cierra. */
  openMinute: number;
  closeMinute: number;
  busy: BusyInterval[];
}

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en ese instante. */
function offsetMs(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instante UTC de la fecha local "YYYY-MM-DD" a `minutes` de medianoche. */
export function localToUtc(
  dateStr: string,
  minutes: number,
  timeZone = BOOKING_TIME_ZONE
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let result = guess - offsetMs(new Date(guess), timeZone);
  // Ajuste por si el cambio de hora cae entre medias.
  result = guess - offsetMs(new Date(result), timeZone);
  return new Date(result);
}

/** Fecha local "YYYY-MM-DD" de un instante. */
export function localDateOf(date: Date, timeZone = BOOKING_TIME_ZONE) {
  const p = partsIn(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutos desde medianoche (hora local) de un instante. */
export function localMinutesOf(date: Date, timeZone = BOOKING_TIME_ZONE) {
  const p = partsIn(date, timeZone);
  return p.hour * 60 + p.minute;
}

/** Los próximos días (fechas locales) que se pueden reservar. */
export function bookingDays(now: Date, count = BOOKING_DAYS_AHEAD) {
  const today = localDateOf(now);
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    return day.toISOString().slice(0, 10);
  });
}

export function minutesLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(a: BusyInterval, b: BusyInterval) {
  return a.start < b.end && b.start < a.end;
}

/** ¿Está libre la pista para [start, start + duración)? */
export function isPlaceFree(
  place: BookablePlace,
  dateStr: string,
  startMinute: number,
  duration: number,
  now: Date
) {
  if (startMinute < place.openMinute) return false;
  if (startMinute + duration > place.closeMinute) return false;
  const start = localToUtc(dateStr, startMinute);
  if (start <= now) return false;
  const slot = { start, end: new Date(start.getTime() + duration * 60_000) };
  return !place.busy.some((b) => overlaps(slot, b));
}

/**
 * Rejilla de horas del día para una duración: cada hora de inicio con las
 * pistas libres a esa hora. Una hora sin pistas libres sale como ocupada.
 */
export function availabilityGrid(
  places: BookablePlace[],
  dateStr: string,
  duration: number,
  now: Date
) {
  if (places.length === 0) return [];
  const open = Math.min(...places.map((p) => p.openMinute));
  const close = Math.max(...places.map((p) => p.closeMinute));
  const rows: { minute: number; label: string; freePlaceIds: string[] }[] = [];
  for (
    let minute = open;
    minute + duration <= close;
    minute += BOOKING_STEP_MINUTES
  ) {
    rows.push({
      minute,
      label: minutesLabel(minute),
      freePlaceIds: places
        .filter((p) => isPlaceFree(p, dateStr, minute, duration, now))
        .map((p) => p.id),
    });
  }
  return rows;
}

/** "Nombre Apellido(s)": al menos dos palabras con letras. */
export function isValidFullName(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  return words.length >= 2 && value.trim().length <= 120;
}
