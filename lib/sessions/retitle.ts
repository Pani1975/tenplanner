import { dateCode } from "@/components/app/session-wizard/recurrence";

/**
 * Si el título es un código automático (AAMMDD_Grupo) cuya fecha coincide con
 * la fecha antigua de la sesión, devuelve el mismo título con la fecha nueva.
 * En cualquier otro caso (título escrito a mano) devuelve `null`: no se toca.
 */
export function retitleForDate(
  title: string,
  oldDate: Date,
  newDate: Date
): string | null {
  const match = /^(\d{6})(_.*)?$/.exec(title.trim());
  if (!match) return null;
  if (match[1] !== dateCode(oldDate)) return null;
  return `${dateCode(newDate)}${match[2] ?? ""}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Título para la copia de una sesión en otra fecha. */
export function titleForCopy(title: string, oldDate: Date, newDate: Date) {
  const retitled = retitleForDate(title, oldDate, newDate);
  if (retitled) return retitled;
  return sameDay(oldDate, newDate) ? `${title} (copia)`.slice(0, 255) : title;
}
