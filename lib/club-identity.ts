import { z } from "zod";

// Ficha de identificación del club (Perfil, en modo club). Sin dependencias
// de servidor: la usan también los componentes cliente.

export const COURT_TYPES = [
  { id: "tierra", label: "Tierra" },
  { id: "dura", label: "Dura" },
  { id: "hierba_sintetica", label: "Hierba sintética" },
  { id: "hierba_natural", label: "Hierba natural" },
  { id: "otro", label: "Otro" },
] as const;

export type CourtTypeId = (typeof COURT_TYPES)[number]["id"];
export type Courts = Partial<Record<CourtTypeId, number>>;

export type ClubIdentity = {
  name: string;
  fullName: string | null;
  address: string | null;
  courts: Courts | null;
  foundedYear: number | null;
};

const courtCount = z.number().int().min(0).max(999);

export const clubIdentitySchema = z.object({
  fullName: z.string().trim().max(255).nullable(),
  address: z.string().trim().max(500).nullable(),
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
