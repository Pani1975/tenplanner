import type { Metadata } from "next";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";

// Metadatos de las fichas públicas (ejercicios y clases de la biblioteca).
// Solo se indexa lo que cualquiera puede ver sin cuenta; lo privado (de un
// monitor o un club) lleva noindex aunque el dueño lo abra con sesión.

const NOINDEX: Metadata = { robots: { index: false, follow: false } };
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto plano de una descripción (sin marcas) recortado para Google. */
export function plainSnippet(
  text: string | null | undefined,
  max = 155
): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[*_#>`~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Condición SQL: ejercicio público y publicado (visible sin cuenta). */
export const publicExerciseCondition = and(
  or(eq(exercises.isGlobal, true), isNull(exercises.createdBy)),
  eq(exercises.isPublished, true)
)!;

/** Condición SQL: clase de la biblioteca publicada (visible sin cuenta). */
export const publicClassCondition = and(
  eq(classes.isLibrary, true),
  eq(classes.status, "published")
)!;

export async function exerciseMetadata(id: string): Promise<Metadata> {
  if (!UUID_RE.test(id)) return NOINDEX;
  try {
    const [row] = await db
      .select({
        name: exercises.name,
        description: exercises.description,
        objectives: exercises.objectives,
      })
      .from(exercises)
      .where(and(eq(exercises.id, id), publicExerciseCondition))
      .limit(1);
    if (!row) return NOINDEX;
    const description =
      plainSnippet(row.description) ?? plainSnippet(row.objectives);
    const path = `/exercises/${id}`;
    return {
      title: `${row.name} · Ejercicio`,
      description,
      alternates: { canonical: path },
      openGraph: { type: "article", url: path, title: row.name, description },
    };
  } catch {
    return NOINDEX;
  }
}

export async function classMetadata(id: string): Promise<Metadata> {
  if (!UUID_RE.test(id)) return NOINDEX;
  try {
    const [row] = await db
      .select({
        name: classes.name,
        objetivos: classes.objetivos,
        aspectosImportantes: classes.aspectosImportantes,
      })
      .from(classes)
      .where(and(eq(classes.id, id), publicClassCondition))
      .limit(1);
    if (!row) return NOINDEX;
    const description =
      plainSnippet(row.objetivos) ?? plainSnippet(row.aspectosImportantes);
    const path = `/classes/${id}`;
    return {
      title: `${row.name} · Clase`,
      description,
      alternates: { canonical: path },
      openGraph: { type: "article", url: path, title: row.name, description },
    };
  } catch {
    return NOINDEX;
  }
}
