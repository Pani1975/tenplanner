/** Resumen de asistencia a partir de las sesiones ya celebradas. */
export interface AttendanceSummary {
  present: number;
  absent: number;
  /** El monitor aún no ha anotado la asistencia. */
  unrecorded: number;
  /** % de asistencia sobre las sesiones con dato; null si no hay ninguna. */
  rate: number | null;
}

export function attendanceSummary(
  rows: { attended: boolean | null }[]
): AttendanceSummary {
  let present = 0;
  let absent = 0;
  let unrecorded = 0;
  for (const r of rows) {
    if (r.attended === true) present++;
    else if (r.attended === false) absent++;
    else unrecorded++;
  }
  const recorded = present + absent;
  return {
    present,
    absent,
    unrecorded,
    rate: recorded === 0 ? null : Math.round((present / recorded) * 100),
  };
}

/** Edad en años cumplidos a una fecha (AAAA-MM-DD), o null si no consta. */
export function ageFromBirthDate(
  birthDate: string | null,
  today: Date = new Date()
): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  const hadBirthday =
    today.getMonth() + 1 > m ||
    (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthday) age--;
  return age >= 0 ? age : null;
}
