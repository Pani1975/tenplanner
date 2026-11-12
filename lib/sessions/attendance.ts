// Regla de asistencia (docs/f1-plan.md, decisión 7): al montar la clase,
// los alumnos que "no vienen" se guardan con attended = false, pero
// "no previsto" no es lo mismo que "faltó". Un false solo cuenta como falta
// si la sesión se llegó a completar; si no, se trata como sin anotar.

export type SessionStatusValue = "scheduled" | "completed" | "cancelled";

/** Asistencia que cuenta en estadísticas e informes. */
export function effectiveAttended(
  attended: boolean | null | undefined,
  status: string | null | undefined
): boolean | null {
  if (attended === false && status !== "completed") return null;
  return attended ?? null;
}

/**
 * Misma regla en SQL. `attended` y `status` son las columnas (con su
 * alias), p. ej. effectiveAttendedSql("ss.attended", "s.status").
 */
export function effectiveAttendedSqlText(
  attended: string,
  status: string
): string {
  return `(case when ${attended} = false and ${status} <> 'completed' then null else ${attended} end)`;
}
