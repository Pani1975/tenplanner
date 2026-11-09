"use client";

/** Primera y última hora en punto razonables para empezar una clase. */
const FIRST_CLASS_HOUR = 8;
const LAST_CLASS_HOUR = 21;
/** Hora que se propone cuando "la próxima hora" cae fuera del horario de club. */
const FALLBACK_CLASS_HOUR = 17;

/**
 * Fecha/hora propuesta para una sesión nueva: la próxima hora en punto, pero
 * siempre dentro del horario habitual de un club (8:00–21:00). De madrugada
 * propone las 17:00 de hoy; por la noche, las 17:00 de mañana.
 */
export function defaultScheduledAt(now: Date = new Date()) {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  if (d.getHours() < FIRST_CLASS_HOUR) {
    // Madrugada (si eran las 23:xx, d ya es el día siguiente): a las 17:00.
    d.setHours(FALLBACK_CLASS_HOUR);
  } else if (d.getHours() > LAST_CLASS_HOUR) {
    d.setDate(d.getDate() + 1);
    d.setHours(FALLBACK_CLASS_HOUR);
  }
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
