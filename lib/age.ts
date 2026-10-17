/**
 * Mayor de edad (18+) según la fecha de nacimiento "YYYY-MM-DD". Sin fecha
 * se trata como menor: con los menores la comunicación es con sus padres o
 * tutores (misma regla que el trigger check_guardian_relationship).
 */
export function isAdult(birthDate: string | null, today = new Date()) {
  if (!birthDate) return false;
  const birth = new Date(birthDate + "T00:00:00Z");
  if (Number.isNaN(birth.getTime())) return false;
  const limit = new Date(
    Date.UTC(
      today.getUTCFullYear() - 18,
      today.getUTCMonth(),
      today.getUTCDate()
    )
  );
  return birth <= limit;
}
