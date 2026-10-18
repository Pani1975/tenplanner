/** Festivo tal como llega al cliente (fechas AAAA-MM-DD, sin hora). */
export interface CalendarHolidayData {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  groupId: string | null;
  clubId?: string | null;
  userId?: string;
  /** Nombre de quien lo creó, solo cuando no es del usuario actual. */
  authorName?: string | null;
  /** Si el usuario actual puede editarlo/borrarlo (creador o dueño del club). */
  canEdit?: boolean;
}

/**
 * Un festivo afecta a una sesión si la fecha cae dentro de su rango y el
 * festivo es de todo el espacio (groupId null) o del grupo de la sesión.
 */
export function holidayAppliesTo(
  holiday: Pick<CalendarHolidayData, "startDate" | "endDate" | "groupId">,
  dayKey: string,
  sessionGroupId?: string | null
): boolean {
  if (dayKey < holiday.startDate || dayKey > holiday.endDate) return false;
  return holiday.groupId === null || holiday.groupId === sessionGroupId;
}
