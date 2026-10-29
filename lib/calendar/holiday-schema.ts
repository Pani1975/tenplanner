import { z } from "zod";

export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

export const holidaySchema = z
  .object({
    title: z.string().trim().min(1, "Título obligatorio").max(255),
    description: z.string().trim().max(4000).optional().nullable(),
    startDate: dateOnly,
    endDate: dateOnly,
    groupId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "La fecha final no puede ser anterior a la inicial",
    path: ["endDate"],
  });
