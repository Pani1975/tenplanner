import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ASPECTO_JUEGO_VALUES,
  BLOCK_ITEM_KINDS,
  STATION_COUNT_MAX,
  STATION_COUNT_MIN,
} from "@/lib/block-items";

const phaseEnum = z.enum(["activation", "main", "cooldown"]);

const stationItemSchema = z
  .object({
    kind: z.enum(["exercise", "text"]),
    exerciseId: z.string().uuid().optional().nullable(),
    freeText: z.string().trim().max(2000).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(300).optional().nullable(),
  })
  .refine(
    (v) => (v.kind === "exercise" ? !!v.exerciseId : !!v.freeText?.trim()),
    { message: "Cada estación necesita un ejercicio o un texto." }
  );

const exerciseItemSchema = z.object({
  exerciseId: z.string().uuid("El ID del ejercicio debe ser un UUID válido"),
  durationMinutes: z
    .number()
    .int()
    .min(1, "Mínimo 1 minuto")
    .max(300, "Máximo 300 minutos")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .nullable(),
  phase: phaseEnum.optional().nullable(),
  intensity: z
    .number()
    .int()
    .min(1, "La intensidad debe ser 1-5")
    .max(5, "La intensidad debe ser 1-5")
    .optional()
    .nullable(),
});

const sessionBlockItemSchema = z
  .object({
    kind: z.enum(BLOCK_ITEM_KINDS).optional(),
    exerciseId: z
      .string()
      .uuid("ID de ejercicio inválido")
      .optional()
      .nullable(),
    freeText: z.string().trim().max(2000).optional().nullable(),
    title: z.string().trim().max(120).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(300).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    stations: z
      .array(stationItemSchema)
      .min(STATION_COUNT_MIN)
      .max(STATION_COUNT_MAX)
      .optional()
      .nullable(),
    // Aspecto del juego (técnica/táctica/física/mental) para items de texto
    // sin ejercicio de biblioteca asociado; opcional.
    aspecto: z.enum(ASPECTO_JUEGO_VALUES).optional().nullable(),
  })
  .refine(
    (item) => {
      if (item.kind === "stations") return (item.stations?.length ?? 0) > 0;
      if (item.kind === "warmup") return true;
      return (
        !!item.exerciseId || !!item.freeText?.trim() || !!item.title?.trim()
      );
    },
    {
      message:
        "Cada item de bloque necesita ejercicio, texto, título o estaciones",
    }
  );

const sessionBlockSchema = z.object({
  orderIndex: z.number().int().min(1).max(3),
  title: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(sessionBlockItemSchema).default([]),
});

const tagsSchema = z
  .array(z.string().trim().min(1).max(30, "Máximo 30 caracteres por etiqueta"))
  .max(10, "Máximo 10 etiquetas")
  .optional()
  .nullable();

const intensitySchema = z
  .number()
  .int()
  .min(1, "La intensidad debe ser 1-5")
  .max(5, "La intensidad debe ser 1-5")
  .optional()
  .nullable();

const locationSchema = z
  .string()
  .trim()
  .max(50, "Máximo 50 caracteres")
  .optional()
  .nullable();

const studentIdsSchema = z
  .array(z.string().uuid("ID de alumno inválido"))
  .optional()
  .default([]);

export const sessionIdParamsSchema = z.object({
  id: z.string().uuid("Session ID must be a valid UUID"),
});

export const sessionsListQuerySchema = z.object({
  filter: z.enum(["all", "upcoming", "past"]).default("all"),
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be 100 or fewer")
    .default(20),
});

export const createSessionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "El título es obligatorio")
    .max(255, "Máximo 255 caracteres"),
  description: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .nullable(),
  scheduledAt: z.string().datetime("Debe ser una fecha/hora ISO válida"),
  durationMinutes: z
    .number()
    .int()
    .min(1, "Mínimo 1 minuto")
    .max(600, "Máximo 600 minutos")
    .optional(),
  /** La duración la fijó el monitor: no se recalcula a partir del plan. */
  durationManual: z.boolean().optional(),
  objective: z
    .string()
    .trim()
    .max(2000, "Máximo 2000 caracteres")
    .optional()
    .nullable(),
  material: z.string().trim().max(2000).optional().nullable(),
  observations: z.string().trim().max(4000).optional().nullable(),
  sourceClassId: z.string().uuid("ID de clase inválido").optional().nullable(),
  intensity: intensitySchema,
  tags: tagsSchema,
  location: locationSchema,
  placeId: z.string().uuid("ID de lugar inválido").nullable().optional(),
  groupId: z.string().uuid("ID de grupo inválido").nullable().optional(),
  studentIds: studentIdsSchema,
  exercises: z.array(exerciseItemSchema).default([]),
  blocks: z.array(sessionBlockSchema).max(3).optional().nullable(),
});

export const updateSessionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "El título es obligatorio")
      .max(255, "Máximo 255 caracteres")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Máximo 2000 caracteres")
      .optional()
      .nullable(),
    scheduledAt: z
      .string()
      .datetime("Debe ser una fecha/hora ISO válida")
      .optional(),
    durationMinutes: z
      .number()
      .int()
      .min(1, "Mínimo 1 minuto")
      .max(600, "Máximo 600 minutos")
      .optional(),
    durationManual: z.boolean().optional(),
    objective: z
      .string()
      .trim()
      .max(2000, "Máximo 2000 caracteres")
      .optional()
      .nullable(),
    material: z.string().trim().max(2000).optional().nullable(),
    observations: z.string().trim().max(4000).optional().nullable(),
    sourceClassId: z
      .string()
      .uuid("ID de clase inválido")
      .optional()
      .nullable(),
    intensity: intensitySchema,
    tags: tagsSchema,
    location: locationSchema,
    placeId: z.string().uuid("ID de lugar inválido").nullable().optional(),
    groupId: z.string().uuid("ID de grupo inválido").nullable().optional(),
    studentIds: z.array(z.string().uuid("ID de alumno inválido")).optional(),
    exercises: z.array(exerciseItemSchema).optional(),
    blocks: z.array(sessionBlockSchema).max(3).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
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
