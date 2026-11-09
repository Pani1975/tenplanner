/**
 * Choques de horario: dos franjas se solapan si una empieza antes de que
 * termine la otra (que una acabe justo cuando empieza la otra no cuenta).
 */
export interface TimeSlot {
  start: Date;
  durationMinutes: number;
}

export interface ExistingSession extends TimeSlot {
  id: string;
  title: string;
}

export function slotEnd(slot: TimeSlot) {
  return new Date(slot.start.getTime() + slot.durationMinutes * 60_000);
}

export function slotsOverlap(a: TimeSlot, b: TimeSlot) {
  return a.start < slotEnd(b) && b.start < slotEnd(a);
}

/** Sesiones existentes que chocan con alguna de las franjas pedidas. */
export function findOverlaps(
  slots: TimeSlot[],
  existing: ExistingSession[],
  excludeId?: string | null
) {
  const seen = new Set<string>();
  const result: ExistingSession[] = [];
  for (const s of existing) {
    if (s.id === excludeId || seen.has(s.id)) continue;
    if (slots.some((slot) => slotsOverlap(slot, s))) {
      seen.add(s.id);
      result.push(s);
    }
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}
