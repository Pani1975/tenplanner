// Vincula las actividades de las clases importadas con ejercicios de la
// biblioteca (globales o del propio monitor/club), usando el mismo buscador
// que la pantalla de Ejercicios. Solo sugiere: el monitor decide en la
// revisión si vincula o deja la actividad como texto.

import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { exerciseOwnOrClubCondition } from "@/lib/exercise-access";
import {
  exerciseSearchCondition,
  exerciseSearchNameRank,
} from "@/lib/exercises/search";
import {
  searchQueriesFor,
  type ExerciseSuggestion,
  type ImportedClass,
} from "@/lib/import/schema";

const MAX_SUGGESTIONS = 3;
/** Tope de búsquedas distintas por importación (coste en la base). */
const MAX_QUERIES = 80;

type Found = ExerciseSuggestion & { inName: boolean };

async function searchLibrary(
  term: string,
  userId: string,
  sport: string
): Promise<Found[]> {
  const cond = exerciseSearchCondition(term);
  const rank = exerciseSearchNameRank(term);
  if (!cond || !rank) return [];
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      durationMinutes: exercises.durationMinutes,
      rank: sql<number>`${rank}`,
    })
    .from(exercises)
    .where(
      and(
        cond,
        eq(exercises.sport, sport as typeof exercises.sport._.data),
        or(eq(exercises.isGlobal, true), exerciseOwnOrClubCondition(userId))
      )
    )
    .orderBy(rank, sql`length(${exercises.name})`, asc(exercises.name))
    .limit(MAX_SUGGESTIONS);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    durationMinutes: r.durationMinutes,
    inName: Number(r.rank) === 0,
  }));
}

/**
 * Rellena `suggestions` de cada actividad y preselecciona el primer
 * candidato cuando sus palabras clave están en el nombre del ejercicio.
 * Si la búsqueda falla, las clases se devuelven sin sugerencias.
 */
export async function linkClassItemsToLibrary(
  classes: ImportedClass[],
  userId: string,
  sport: string
): Promise<ImportedClass[]> {
  const cache = new Map<string, Promise<Found[]>>();
  let budget = MAX_QUERIES;
  let errors = 0;
  const search = (term: string) => {
    const key = term.toLowerCase();
    let hit = cache.get(key);
    if (!hit) {
      if (budget <= 0) return Promise.resolve([] as Found[]);
      budget -= 1;
      hit = searchLibrary(term, userId, sport).catch((e: unknown) => {
        errors += 1;
        if (errors === 1) {
          console.error(
            "[import-text] búsqueda en biblioteca falló",
            e instanceof Error ? e.message.slice(0, 200) : "desconocido"
          );
        }
        return [] as Found[];
      });
      cache.set(key, hit);
    }
    return hit;
  };

  let total = 0;
  let withSuggestions = 0;
  let preselected = 0;
  for (const c of classes) {
    for (const block of c.blocks) {
      for (const item of block.items) {
        for (const { query, strong } of searchQueriesFor(item)) {
          const found = await search(query);
          if (found.length === 0) continue;
          item.suggestions = found.map(({ id, name, durationMinutes }) => ({
            id,
            name,
            durationMinutes,
          }));
          item.exerciseId = strong && found[0].inName ? found[0].id : null;
          break;
        }
        if (item.suggestions.length > 0) withSuggestions += 1;
        if (item.exerciseId) preselected += 1;
        total += 1;
      }
    }
  }
  // Solo recuentos (sin textos) para poder ver en los logs si enlaza.
  console.info(
    "[import-text] biblioteca",
    `actividades=${total}`,
    `con_sugerencias=${withSuggestions}`,
    `preseleccionadas=${preselected}`,
    `errores=${errors}`
  );
  return classes;
}
