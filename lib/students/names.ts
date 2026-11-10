// Nombre y apellidos del alumno. La ficha guarda los dos por separado
// (students.first_name / last_name) y, además, el nombre completo en
// students.name, que es el que usan listas, informes y PDF.

/** Partículas que forman parte de un apellido: "de la Fuente", "del Río". */
const SURNAMES =
  /^(.+?)\s+((?:(?:de|del|la|las|los|san)\s+)*\S+\s+(?:(?:de|del|la|las|los|san)\s+)*\S+)$/i;

function clean(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Separa un nombre completo en nombre y apellidos, al estilo español: los
 * dos últimos apellidos (con sus partículas) son los apellidos y el resto el
 * nombre ("María José García López" → "María José" + "García López"). Con
 * dos palabras, la segunda es el apellido. Es una aproximación: el monitor
 * puede corregirlo en la ficha. Misma regla que la migración 0093.
 */
export function splitFullName(full: string | null | undefined): {
  firstName: string;
  lastName: string | null;
} {
  const name = clean(full);
  const m = SURNAMES.exec(name) ?? /^(\S+)\s+(.+)$/.exec(name);
  return m
    ? { firstName: m[1], lastName: m[2] }
    : { firstName: name, lastName: null };
}

/** "Lucía" + "Pérez García" → "Lucía Pérez García". */
export function joinFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  return [clean(firstName), clean(lastName)].filter(Boolean).join(" ");
}
