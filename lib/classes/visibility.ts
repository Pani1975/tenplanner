import { eq, or, type SQL } from "drizzle-orm";
import { classes } from "@/db/schema";

// Estado de publicación de una clase. "draft" = borrador privado de quien la
// creó (aún se está configurando, p. ej. añadiendo ejercicios); "published" =
// visible según las reglas habituales (biblioteca / propias / club).
export const CLASS_STATUSES = ["draft", "published"] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];

/**
 * Condición SQL que excluye los borradores salvo los del propio usuario. Se
 * combina (and) con las condiciones de visibilidad existentes.
 */
export function classDraftVisibility(
  userId: string | null | undefined
): SQL {
  return userId
    ? or(eq(classes.status, "published"), eq(classes.createdBy, userId))!
    : eq(classes.status, "published");
}

/** Igual que classDraftVisibility, para una clase ya cargada. */
export function canSeeClassDraft(
  cls: { status: string; createdBy: string | null },
  userId: string | null | undefined
): boolean {
  return cls.status !== "draft" || (!!userId && cls.createdBy === userId);
}
