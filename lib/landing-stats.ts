import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";
import {
  PRIMARY_FILTERS,
  SECONDARY_FILTERS,
} from "@/lib/exercise-filter-options";
import { NIVELES, TIPOS_EJERCICIO } from "@/lib/exercise-taxonomy";

export type LandingStats = {
  exercises: number;
  classes: number;
  tags: number;
};

// Filtros que no son etiquetas de contenido: la autoría es la marca de quien
// lo firma y el número de jugadores es un dato numérico.
const NOT_TAGS = new Set(["autoria", "numJugadores"]);

/**
 * Etiquetas con las que se puede buscar un ejercicio: todas las opciones de
 * los filtros de la biblioteca (misma lista que ve el monitor) más los
 * niveles. Los tipos de ejercicio antiguos no se cuentan.
 */
export function countSearchTags(): number {
  const fromFilters = [...PRIMARY_FILTERS, ...SECONDARY_FILTERS]
    .filter((f) => !NOT_TAGS.has(f.param))
    .reduce(
      (total, f) =>
        total +
        (f.param === "tipoActividad" ? TIPOS_EJERCICIO.length : f.options.length),
      0
    );
  return fromFilters + NIVELES.length;
}

/** Cifras de la biblioteca pública, mismas condiciones que la portada. */
export async function getLandingStats(): Promise<LandingStats> {
  const [[ex], [cl]] = await Promise.all([
    db
      .select({ n: count() })
      .from(exercises)
      .where(and(eq(exercises.isGlobal, true), eq(exercises.isPublished, true))),
    db
      .select({ n: count() })
      .from(classes)
      .where(and(eq(classes.isLibrary, true), eq(classes.status, "published"))),
  ]);
  return {
    exercises: ex?.n ?? 0,
    classes: cl?.n ?? 0,
    tags: countSearchTags(),
  };
}
