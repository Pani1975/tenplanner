/** "2026-11-21" → "21 nov 2026" (sin depender de la zona del servidor). */
export function formatMatchDate(value: string, long = false): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: long ? "long" : undefined,
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
