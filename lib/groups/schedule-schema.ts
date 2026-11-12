import { z } from "zod";
import { isValidScheduleEntry } from "@/lib/groups/schedule";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)");

/** Una entrada del horario del grupo: día, hora de inicio y de finalización. */
export const scheduleEntrySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    time: hhmm,
    endTime: hhmm,
  })
  .refine((v) => isValidScheduleEntry(v), {
    message: "La hora de finalización debe ser posterior a la de inicio",
  });

/** Horario semanal: al menos un día, sin repetir día. */
export const weeklyScheduleSchema = z
  .array(scheduleEntrySchema)
  .min(1, "Indica al menos un día de clase")
  .max(7)
  .refine((v) => new Set(v.map((e) => e.weekday)).size === v.length, {
    message: "Día repetido",
  });
