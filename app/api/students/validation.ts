import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedImageUrl } from "@/lib/url-safety";

export const genderSchema = z.enum(["male", "female", "other"]);
export const dominantHandSchema = z.enum(["left", "right"]);
export const playerLevelSchema = z.enum([
  // Legacy (compat con datos existentes)
  "beginner",
  "amateur",
  "intermediate",
  "advanced",
  "competitive",
  // PMV 260506 — niveles por edad
  "descubrimiento",
  "desarrollo",
  "consolidacion",
  "especializacion",
  "precompeticion",
  "competicion",
  "adultos_iniciacion",
  "adultos_medio_alto",
]);

export const studentIdParamsSchema = z.object({
  id: z.string().uuid("El ID del alumno debe ser un UUID válido"),
});

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)");

const optionalImageUrlSchema = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => value === "" || isAllowedImageUrl(value), {
    message:
      "La URL de foto debe ser http(s) y pertenecer a Supabase, Pexels, Google o GitHub.",
  });

export const createStudentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(255, "Máximo 255 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255)
    .optional()
    .nullable()
    .or(z.literal("")),
  gender: genderSchema.optional().nullable(),
  birthDate: dateStringSchema.optional().nullable(),
  heightCm: z.coerce
    .number()
    .int()
    .min(50, "Mínimo 50 cm")
    .max(250, "Máximo 250 cm")
    .optional()
    .nullable(),
  weightKg: z.coerce
    .number()
    .int()
    .min(20, "Mínimo 20 kg")
    .max(250, "Máximo 250 kg")
    .optional()
    .nullable(),
  dominantHand: dominantHandSchema.optional().nullable(),
  playerLevel: playerLevelSchema.optional().nullable(),
  yearsExperience: z.coerce.number().int().min(0).max(80).optional().nullable(),
  yearStartedTennis: z.coerce
    .number()
    .int()
    .min(1900, "Año inválido")
    .max(2100, "Año inválido")
    .optional()
    .nullable(),
  yearStartedRacketSports: z.coerce
    .number()
    .int()
    .min(1900, "Año inválido")
    .max(2100, "Año inválido")
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .max(32, "Máximo 32 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  preferredSchedule: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .nullable(),
  locality: z
    .string()
    .trim()
    .max(120, "Máximo 120 caracteres")
    .optional()
    .nullable()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .nullable(),
  imageUrl: optionalImageUrlSchema.optional().nullable(),
});

export const updateStudentSchema = createStudentSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required for update",
  });

export function zodValidationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join(".") : "request",
        message: issue.message,
        code: issue.code,
      })),
    },
    { status: 400 }
  );
}
