// Validación de lo que llega a la API de gestión de torneos (zod).

import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const scoringFields = {
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  gamesPerSet: z.number().int().min(3).max(8),
  finalSet: z.enum(["full", "super_tiebreak"]),
};

const tournamentFields = {
  name: z.string().trim().min(3).max(160),
  description: optText(2000),
  startDate: dateOnly,
  endDate: dateOnly.optional().nullable(),
  registrationDeadline: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable(),
  maxEntries: z.number().int().min(2).max(256).optional().nullable(),
  placeIds: z.array(z.string().uuid()).max(20).optional().nullable(),
  modality: z.enum(["singles", "doubles"]),
  levelCode: z.string().max(32).optional().nullable(),
  format: z.enum(["knockout", "round_robin"]),
  visibility: z.enum(["public", "private"]).optional(),
  ...scoringFields,
  // Independiente (null) o de un circuito: uno existente (circuitId) o uno
  // nuevo que se crea al guardar (newCircuit).
  circuitId: z.string().uuid().optional().nullable(),
  newCircuit: z
    .object({
      name: z.string().trim().min(2).max(160),
      season: optText(20),
    })
    .optional()
    .nullable(),
};

type CircuitInput = {
  circuitId?: string | null;
  newCircuit?: { name: string } | null;
};

function checkCircuit(v: CircuitInput, ctx: z.RefinementCtx) {
  if (v.circuitId && v.newCircuit) {
    ctx.addIssue({
      code: "custom",
      path: ["newCircuit"],
      message: "Elige un circuito existente o uno nuevo, no los dos",
    });
  }
}

type DatesInput = {
  startDate?: string;
  endDate?: string | null;
  registrationDeadline?: string | null;
};

function checkDates(v: DatesInput, ctx: z.RefinementCtx) {
  if (v.startDate && v.endDate && v.endDate < v.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "La fecha de fin es anterior a la de inicio",
    });
  }
  if (v.startDate && v.registrationDeadline) {
    // Plazo como mucho el final del día de inicio.
    const deadlineDay = v.registrationDeadline.slice(0, 10);
    if (deadlineDay > v.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationDeadline"],
        message: "El plazo de inscripción acaba después del inicio",
      });
    }
  }
}

export const createTournamentSchema = z
  .object({
    ...tournamentFields,
    bestOf: scoringFields.bestOf.default(3),
    gamesPerSet: scoringFields.gamesPerSet.default(6),
    finalSet: scoringFields.finalSet.default("super_tiebreak"),
  })
  .superRefine((v, ctx) => {
    checkDates(v, ctx);
    checkCircuit(v, ctx);
  });

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = z
  .object(tournamentFields)
  .partial()
  .extend({
    status: z
      .enum(["draft", "open", "closed", "in_progress", "finished"])
      .optional(),
  })
  .superRefine((v, ctx) => {
    checkDates(v, ctx);
    checkCircuit(v, ctx);
  });

export type UpdateTournamentInput = z.infer<typeof updateTournamentSchema>;

// Alumnos de la escuela: una sola lista, venga de la selección suelta, de
// un grupo entero o de alumnos de un grupo (groupId = de dónde salió).
export const addSchoolEntriesSchema = z.object({
  kind: z.literal("school"),
  items: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        groupId: z.string().uuid().optional().nullable(),
        partnerStudentId: z.string().uuid().optional().nullable(),
      })
    )
    .min(1)
    .max(256),
  // El monitor declara que tiene el consentimiento de los alumnos (o de
  // sus padres o tutores si son menores). Sin marcarlo quedan pendientes.
  consentDeclared: z.boolean(),
});

const person = {
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255).optional().nullable(),
  phone: z.string().trim().min(6).max(32).optional().nullable(),
  isMinor: z.boolean().default(false),
  guardianName: optText(120),
  guardianEmail: z.string().trim().email().max(255).optional().nullable(),
  guardianPhone: z.string().trim().min(6).max(32).optional().nullable(),
};

type PersonInput = {
  email?: string | null;
  phone?: string | null;
  isMinor: boolean;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
};

function checkContact(p: PersonInput, ctx: z.RefinementCtx, path: string[]) {
  if (p.isMinor) {
    if (!p.guardianName || !(p.guardianEmail || p.guardianPhone)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, "guardianName"],
        message:
          "Un menor necesita nombre y contacto de su padre, madre o tutor",
      });
    }
  } else if (!p.email && !p.phone) {
    ctx.addIssue({
      code: "custom",
      path: [...path, "email"],
      message: "Hace falta un correo o un teléfono",
    });
  }
}

// Jugador externo que añade el organizador a mano.
export const addManualEntrySchema = z
  .object({
    kind: z.literal("manual"),
    player: z.object(person),
    partner: z.object(person).optional().nullable(),
    levelCode: z.string().max(32).optional().nullable(),
    consentDeclared: z.boolean(),
  })
  .superRefine((v, ctx) => {
    checkContact(v.player, ctx, ["player"]);
    if (v.partner) checkContact(v.partner, ctx, ["partner"]);
  });

export const addEntriesSchema = z.union([
  addSchoolEntriesSchema,
  addManualEntrySchema,
]);

export type AddSchoolEntriesInput = z.infer<typeof addSchoolEntriesSchema>;
export type AddManualEntryInput = z.infer<typeof addManualEntrySchema>;

export const updateEntrySchema = z.union([
  z.object({ action: z.literal("declare_consent") }),
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("seed"),
    seed: z.number().int().min(1).max(64).nullable(),
  }),
]);

const points = z.object({
  a: z.number().int().min(0).max(99),
  b: z.number().int().min(0).max(99),
});

export const matchResultSchema = z.object({
  resultType: z.enum(["normal", "walkover", "retired"]),
  score: z
    .object({
      sets: z.array(points.extend({ tiebreak: points.optional() })).max(5),
      superTiebreak: points.optional(),
    })
    .optional()
    .nullable(),
  winner: z.enum(["a", "b"]).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  courtLabel: optText(60),
});

export type MatchResultBody = z.infer<typeof matchResultSchema>;

// Inscripción pública por enlace (sin cuenta). El consentimiento RGPD es
// obligatorio; "website" es una trampa para robots: una persona no la ve
// y debe llegar vacía.
export const publicRegistrationSchema = z
  .object({
    player: z.object(person),
    partner: z.object(person).optional().nullable(),
    levelCode: z.string().max(32).optional().nullable(),
    consent: z.literal(true),
    website: z.string().max(0).optional(),
  })
  .superRefine((v, ctx) => {
    checkContact(v.player, ctx, ["player"]);
    if (v.partner) checkContact(v.partner, ctx, ["partner"]);
  });

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
