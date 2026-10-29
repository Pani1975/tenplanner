import { z } from "zod";

// Ficha de monitor (Gestión → Monitores). Sin dependencias de servidor: la
// usan el formulario del gestor, el formulario público del enlace y la API.

export const WEEKDAYS = [
  { id: "lunes", label: "Lunes" },
  { id: "martes", label: "Martes" },
  { id: "miercoles", label: "Miércoles" },
  { id: "jueves", label: "Jueves" },
  { id: "viernes", label: "Viernes" },
  { id: "sabado", label: "Sábado" },
  { id: "domingo", label: "Domingo" },
] as const;

export const DAY_BLOCKS = [
  { id: "manana", label: "Mañana" },
  { id: "mediodia", label: "Mediodía" },
  { id: "tarde", label: "Tarde" },
] as const;

export type WeekdayId = (typeof WEEKDAYS)[number]["id"];
export type BlockId = (typeof DAY_BLOCKS)[number]["id"];
export type Availability = Partial<Record<WeekdayId, BlockId[]>>;

export type ExperienceEntry = {
  startYear: number;
  /** null = hasta la actualidad */
  endYear: number | null;
  company: string | null;
  role: string | null;
};

export const MIN_YEAR = 1950;
export const MAX_EXPERIENCE_ENTRIES = 20;
/** Días que dura el enlace que se envía al monitor. */
export const COACH_PROFILE_LINK_EXPIRY_DAYS = 30;

const WEEKDAY_IDS = WEEKDAYS.map((d) => d.id) as [WeekdayId, ...WeekdayId[]];
const BLOCK_IDS = DAY_BLOCKS.map((b) => b.id) as [BlockId, ...BlockId[]];

// ── Disponibilidad ──────────────────────────────────────────────────────

/** Quita días vacíos y bloques repetidos, y ordena como en pantalla. */
export function normalizeAvailability(
  raw: Availability | null | undefined
): Availability | null {
  if (!raw) return null;
  const result: Availability = {};
  for (const day of WEEKDAYS) {
    const picked = new Set(raw[day.id] ?? []);
    const blocks = DAY_BLOCKS.map((b) => b.id).filter((b) => picked.has(b));
    if (blocks.length > 0) result[day.id] = blocks;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function isDayFull(av: Availability, day: WeekdayId) {
  return (av[day]?.length ?? 0) === DAY_BLOCKS.length;
}

export function isAllSelected(av: Availability) {
  return WEEKDAYS.every((d) => isDayFull(av, d.id));
}

export function toggleBlock(
  av: Availability,
  day: WeekdayId,
  block: BlockId
): Availability {
  const current = new Set(av[day] ?? []);
  if (current.has(block)) current.delete(block);
  else current.add(block);
  return {
    ...av,
    [day]: DAY_BLOCKS.map((b) => b.id).filter((b) => current.has(b)),
  };
}

/** Marca o desmarca todos los bloques de un día. */
export function toggleDay(av: Availability, day: WeekdayId): Availability {
  return {
    ...av,
    [day]: isDayFull(av, day) ? [] : DAY_BLOCKS.map((b) => b.id),
  };
}

/** Marca o desmarca todos los bloques de todos los días ("Todos"). */
export function toggleAll(av: Availability): Availability {
  if (isAllSelected(av)) return {};
  return Object.fromEntries(
    WEEKDAYS.map((d) => [d.id, DAY_BLOCKS.map((b) => b.id)])
  ) as Availability;
}

/** Una línea por día con disponibilidad: "Lunes: mañana y tarde". */
export function summarizeAvailability(av: Availability | null | undefined) {
  const normalized = normalizeAvailability(av);
  if (!normalized) return [];
  const label = (b: BlockId) =>
    DAY_BLOCKS.find((x) => x.id === b)!.label.toLowerCase();
  return WEEKDAYS.filter((d) => normalized[d.id]).map((d) => {
    const blocks = normalized[d.id]!;
    const text =
      blocks.length === DAY_BLOCKS.length
        ? "todo el día"
        : blocks.length === 1
          ? label(blocks[0])
          : `${blocks.slice(0, -1).map(label).join(", ")} y ${label(blocks[blocks.length - 1])}`;
    return `${d.label}: ${text}`;
  });
}

export function formatExperienceRange(start: number, end: number | null) {
  return `${start} – ${end === null ? "actualidad" : end}`;
}

// ── Validación ──────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Demasiado largo")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const yearField = (message: string) =>
  z
    .number({ required_error: message, invalid_type_error: message })
    .int(message)
    .min(MIN_YEAR, message);

/** Teléfono: admite +, espacios, guiones y paréntesis; mínimo 9 cifras. */
export function normalizePhone(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function isValidPhone(value: string) {
  if (!/^\+?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

const availabilitySchema = z
  .object(
    Object.fromEntries(
      WEEKDAY_IDS.map((d) => [d, z.array(z.enum(BLOCK_IDS)).max(3).optional()])
    ) as Record<
      WeekdayId,
      z.ZodOptional<z.ZodArray<z.ZodEnum<[BlockId, ...BlockId[]]>>>
    >
  )
  .strict()
  .optional()
  .nullable()
  .transform((v) =>
    normalizeAvailability(v as Availability | null | undefined)
  );

const experienceEntrySchema = z
  .object({
    startYear: yearField("Indica el año de comienzo"),
    endYear: yearField("Año de finalización no válido").nullable(),
    company: optionalText(255),
    role: optionalText(255),
  })
  .superRefine((entry, ctx) => {
    const currentYear = new Date().getFullYear();
    if (entry.startYear > currentYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startYear"],
        message: "El año de comienzo no puede ser futuro",
      });
    }
    if (entry.endYear !== null) {
      if (entry.endYear > currentYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endYear"],
          message: "El año de finalización no puede ser futuro",
        });
      }
      if (entry.endYear < entry.startYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endYear"],
          message: "La finalización no puede ser anterior al comienzo",
        });
      }
    }
  });

export const coachProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .max(255, "Demasiado largo")
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, {
      message: "Escribe nombre y apellidos",
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255, "Demasiado largo")
    .email("Email no válido"),
  phone: z
    .string()
    .trim()
    .min(1, "Escribe un teléfono")
    .max(32, "Demasiado largo")
    .refine(isValidPhone, { message: "Teléfono no válido" })
    .transform(normalizePhone),
  academicTraining: optionalText(2000),
  tennisTraining: optionalText(2000),
  availability: availabilitySchema,
  startedTeachingYear: yearField("Año no válido")
    .nullable()
    .optional()
    .transform((v) => v ?? null)
    .refine((v) => v === null || v <= new Date().getFullYear(), {
      message: "El año no puede ser futuro",
    }),
  experience: z
    .array(experienceEntrySchema)
    .max(MAX_EXPERIENCE_ENTRIES)
    .optional()
    .transform((v) => v ?? []),
});

export type CoachProfileInput = z.input<typeof coachProfileSchema>;
export type CoachProfileData = z.output<typeof coachProfileSchema>;

/**
 * Datos mínimos para pedir la ficha al monitor por enlace: el gestor solo
 * conoce su nombre (aunque sea a medias) y su email; el resto lo rellena él.
 */
export const coachProfileLinkRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe el nombre").max(255),
  email: z.string().trim().toLowerCase().max(255).email("Email no válido"),
});

export type CoachProfileStatus = "pending" | "complete";

/**
 * Nombre provisional para la ficha que se crea al invitar a un monitor del
 * que solo se conoce el email: la parte anterior a la @.
 */
export function fallbackNameFromEmail(email: string) {
  const local = email.split("@")[0]?.trim();
  return local ? local : email;
}
