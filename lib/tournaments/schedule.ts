// Orden de juego: día, hora y pista de cada partido, en hora de España.
// Funciones puras (sin base de datos), con tests.

const TZ = "Europe/Madrid";

/** Partes de una fecha en hora de España: { date: "AAAA-MM-DD", time: "HH:MM" }. */
export function madridParts(d: Date): { date: string; time: string } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Día y hora de España → instante (ISO en UTC). Tiene en cuenta el cambio
 * de hora: prueba el desfase de ese día y lo corrige si hace falta.
 */
export function madridToIso(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = madridParts(new Date(guess));
    const [py, pm, pd] = p.date.split("-").map(Number);
    const [ph, pmin] = p.time.split(":").map(Number);
    const shown = Date.UTC(py, pm - 1, pd, ph, pmin);
    guess += asUtc - shown;
  }
  return new Date(guess).toISOString();
}

export type ScheduledLike = {
  id: string;
  scheduledAt: Date | string | null;
  courtLabel: string | null;
  round: number;
  position: number;
};

/**
 * Partidos con día y hora, agrupados por día (en España) y ordenados por
 * hora y pista. Los que no tienen hora no salen.
 */
export function scheduleByDay<T extends ScheduledLike>(
  matches: T[]
): { date: string; items: (T & { time: string })[] }[] {
  const withTime = matches
    .filter((m) => m.scheduledAt)
    .map((m) => {
      const at = new Date(m.scheduledAt as string | Date);
      return { m, at, parts: madridParts(at) };
    })
    .sort(
      (a, b) =>
        a.at.getTime() - b.at.getTime() ||
        (a.m.courtLabel ?? "").localeCompare(b.m.courtLabel ?? "", "es", {
          numeric: true,
        }) ||
        a.m.round - b.m.round ||
        a.m.position - b.m.position
    );
  const days: { date: string; items: (T & { time: string })[] }[] = [];
  for (const { m, parts } of withTime) {
    let day = days.find((d) => d.date === parts.date);
    if (!day) {
      day = { date: parts.date, items: [] };
      days.push(day);
    }
    day.items.push({ ...m, time: parts.time });
  }
  return days;
}

/** Misma pista a la misma hora: ids de los partidos que coinciden. */
export function scheduleClashes(matches: ScheduledLike[]): Set<string> {
  const seen = new Map<string, string>();
  const out = new Set<string>();
  for (const m of matches) {
    if (!m.scheduledAt || !m.courtLabel?.trim()) continue;
    const k = `${new Date(m.scheduledAt).getTime()}|${m.courtLabel.trim().toLowerCase()}`;
    const other = seen.get(k);
    if (other) {
      out.add(other);
      out.add(m.id);
    } else seen.set(k, m.id);
  }
  return out;
}
