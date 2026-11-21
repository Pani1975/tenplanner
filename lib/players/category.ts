/**
 * Categoría del jugador según la edad que cumple en el año en curso
 * (año actual − año de nacimiento). Tabla aprobada por David (2026-11-21):
 * Benjamín ≤10, Alevín 11-12, Infantil 13-14, Cadete 15-16, Junior 17-18,
 * Absoluto 19-34, y veteranos +35, +40, +45, +50, +55, +60.
 * Los nombres coinciden con lib/tournaments/categories.ts.
 */
export function playerCategory(
  birthDate: string | null | undefined,
  year: number = new Date().getFullYear()
): string | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const age = year - Number(birthDate.slice(0, 4));
  if (age < 0) return null;
  if (age <= 10) return "Benjamín";
  if (age <= 12) return "Alevín";
  if (age <= 14) return "Infantil";
  if (age <= 16) return "Cadete";
  if (age <= 18) return "Junior";
  if (age <= 34) return "Absoluto";
  if (age >= 60) return "+60";
  return `+${Math.floor(age / 5) * 5}`;
}
