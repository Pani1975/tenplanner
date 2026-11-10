// Formato de cifras del informe de gestión (pantalla y PDF): coma decimal y
// como mucho dos decimales.

const NUMBER = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

/** 12,5 · 3 · 33,33 */
export function formatNumber(value: number): string {
  return NUMBER.format(Number.isFinite(value) ? value : 0);
}

/** "33,33 %" (null = "—"). */
export function formatPct(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : `${formatNumber(value)} %`;
}

/** Porcentaje de `part` sobre `total`, redondeado a dos decimales. */
export function pctOf(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 10_000) / 100 : null;
}

/** Horas a partir de minutos: "13,2". */
export function formatHours(minutes: number): string {
  return formatNumber(Math.round((minutes / 60) * 100) / 100);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
