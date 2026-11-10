import { z } from "zod";

// Ficha del club ("Mi club"): identificación, contacto, fotos, vídeos e
// instalaciones. Sin dependencias de servidor: la usan también los
// componentes cliente.

export const COURT_TYPES = [
  { id: "tierra", label: "Tierra" },
  { id: "dura", label: "Dura" },
  { id: "hierba_sintetica", label: "Hierba sintética" },
  { id: "hierba_natural", label: "Hierba natural" },
  { id: "otro", label: "Otro" },
] as const;

export type CourtTypeId = (typeof COURT_TYPES)[number]["id"];
export type Courts = Partial<Record<CourtTypeId, number>>;

export const MAX_CLUB_PHOTOS = 12;
export const MAX_CLUB_VIDEOS = 6;

export type ClubIdentity = {
  /** Nombre del club: es el que sale en las cabeceras del modo club. */
  name: string;
  fullName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  coverImageUrl: string | null;
  photos: string[];
  videos: string[];
  courts: Courts | null;
  padelCourts: number | null;
  hasCafeteria: boolean | null;
  hasParking: boolean | null;
  foundedYear: number | null;
};

const courtCount = z.number().int().min(0).max(999);

const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => /^https?:\/\//i.test(v), "Enlace no válido");

export const clubIdentitySchema = z.object({
  name: z.string().trim().min(2, "El nombre del club es obligatorio").max(255),
  fullName: z.string().trim().max(255).nullable(),
  address: z.string().trim().max(500).nullable(),
  phone: z.string().trim().max(50).nullable(),
  email: z.string().trim().email("El email del club no es válido").max(255),
  website: z.string().trim().max(255).nullable(),
  coverImageUrl: httpUrl.nullable(),
  photos: z.array(httpUrl).max(MAX_CLUB_PHOTOS),
  videos: z.array(httpUrl).max(MAX_CLUB_VIDEOS),
  padelCourts: courtCount.nullable(),
  hasCafeteria: z.boolean().nullable(),
  hasParking: z.boolean().nullable(),
  courts: z
    .object(
      Object.fromEntries(
        COURT_TYPES.map((c) => [c.id, courtCount.optional()])
      ) as Record<CourtTypeId, z.ZodOptional<typeof courtCount>>
    )
    .strict()
    .nullable(),
  foundedYear: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear())
    .nullable(),
});

export type ClubIdentityInput = z.infer<typeof clubIdentitySchema>;

/** Pistas con número mayor que 0, sin tipos vacíos; null si no hay ninguna. */
export function normalizeCourts(
  courts: Courts | null | undefined
): Courts | null {
  const out: Courts = {};
  for (const c of COURT_TYPES) {
    const v = courts?.[c.id];
    if (typeof v === "number" && v > 0) out[c.id] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Total de pistas del club. */
export function totalCourts(courts: Courts | null | undefined): number {
  return COURT_TYPES.reduce((sum, c) => sum + (courts?.[c.id] ?? 0), 0);
}

// Contacto que se pide al registrar un club ("Como Club"). Todo opcional:
// vacío se guarda como null.

/** Añade https:// si falta y devuelve null si el texto no es una URL válida. */
export function normalizeWebsite(raw: string | null | undefined) {
  const value = raw?.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString().slice(0, 255);
  } catch {
    return null;
  }
}

export function cleanOptionalText(
  raw: string | null | undefined,
  maxLength: number
) {
  const value = raw?.trim();
  return value ? value.slice(0, maxLength) : null;
}
