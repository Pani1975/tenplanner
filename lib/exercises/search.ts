import { and, or, sql, type SQL } from "drizzle-orm";
import { exercises } from "@/db/schema";

/**
 * Buscador de ejercicios de la biblioteca.
 *
 * - Ignora tildes y mayúsculas (sin depender de la extensión `unaccent`).
 * - Busca palabra a palabra con AND, no la frase exacta.
 * - Busca en nombre, descripción, objetivos, golpes, aspectos, categoría y
 *   fases.
 * - Singular/plural ("voleas" encuentra "volea") y sinónimos cortos
 *   ("smash" encuentra "remate").
 *
 * Lo usan la página /exercises, su navegación anterior/siguiente y la API
 * GET /api/exercises, para que las tres den los mismos resultados.
 */

const STOPWORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "lo",
  "los",
  "o",
  "para",
  "por",
  "sin",
  "un",
  "una",
  "y",
]);

const NO_STEM = new Set(["reves", "tenis", "mas", "pies", "dos", "tres"]);

/** Máximo de palabras que se tienen en cuenta (acota el SQL generado). */
const MAX_WORDS = 8;

// Grupos de términos equivalentes, ya normalizados (sin tildes, minúsculas).
// Incluye los valores en inglés que la base de datos guarda en `category`
// y `fases`, para que "calentamiento" o "tecnica" también los encuentren.
const SYNONYM_GROUPS: string[][] = [
  ["remate", "smash"],
  ["derecha", "drive"],
  ["saque", "servicio"],
  ["pista", "cancha"],
  ["cesta", "canasto", "cesto"],
  ["tecnica", "technique"],
  ["tactica", "tactics"],
  ["fisico", "fitness"],
  ["calentamiento", "activation", "warm-up"],
  ["calma", "cooldown"],
];

/** Quita tildes, pasa a minúsculas y deja solo letras, cifras y espacios. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Raíz singular aproximada. Se busca como subcadena, así que la raíz
 * encuentra también el plural ("volea" → "voleas").
 */
export function stemSearchWord(word: string): string {
  // Singulares acabados en "s": recortarlos da raíces demasiado amplias
  // ("reve" encuentra "breve").
  if (NO_STEM.has(word)) return word;
  if (word.length > 4 && /[^aeiou]es$/.test(word) && word.length - 2 >= 4) {
    return word.slice(0, -2); // reveses → reves, aproximaciones → aproximacion
  }
  if (word.length > 3 && word.endsWith("s")) {
    return word.slice(0, -1); // voleas → volea, globos → globo
  }
  return word;
}

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    SYNONYMS.set(
      stemSearchWord(term),
      group.filter((t) => t !== term)
    );
  }
}

/**
 * Convierte el texto del buscador en grupos de variantes: cada grupo es una
 * palabra (se exigen todas) y sus variantes son alternativas (basta una).
 */
export function parseExerciseSearch(term: string): string[][] {
  const words = normalizeSearchText(term)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w));

  const groups: string[][] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const stem = stemSearchWord(word);
    if (seen.has(stem)) continue;
    seen.add(stem);
    // La raíz puede quedar más corta que el singular ("remates" → "remat"),
    // así que los sinónimos se buscan también con la palabra sin la "s".
    const synonyms =
      SYNONYMS.get(word) ??
      (word.endsWith("s") ? SYNONYMS.get(word.slice(0, -1)) : undefined) ??
      SYNONYMS.get(stem) ??
      [];
    const variants = new Set([stem, ...synonyms]);
    groups.push([...variants]);
    if (groups.length >= MAX_WORDS) break;
  }
  return groups;
}

const ACCENTED = "áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ";
const PLAIN = "aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc";

/** Texto del ejercicio en el que se busca, en minúsculas y sin tildes. */
const exerciseSearchHaystack = sql`translate(lower(concat_ws(' ',
  ${exercises.name},
  ${exercises.description},
  ${exercises.objectives},
  ${exercises.golpes}::text,
  ${exercises.aspectosJuego}::text,
  ${exercises.category}::text,
  ${exercises.fases}::text,
  ${exercises.phase}::text
)), ${ACCENTED}, ${PLAIN})`;

const nameHaystack = sql`translate(lower(${exercises.name}), ${ACCENTED}, ${PLAIN})`;

function matchesAll(haystack: SQL, groups: string[][]): SQL | undefined {
  // Las variantes solo tienen letras, cifras y guiones: no hay comodines de
  // LIKE (% _ \) que escapar.
  return and(
    ...groups.map((variants) =>
      or(...variants.map((v) => sql`${haystack} like ${`%${v}%`}`))
    )
  );
}

/**
 * Criterio de orden para poner primero los ejercicios cuyo nombre contiene
 * todas las palabras buscadas (0 = en el nombre, 1 = solo en el resto).
 * `undefined` si no hay búsqueda.
 */
export function exerciseSearchNameRank(term: string): SQL | undefined {
  const groups = parseExerciseSearch(term);
  if (groups.length === 0) return undefined;
  return sql`case when ${matchesAll(nameHaystack, groups)} then 0 else 1 end`;
}

/**
 * Condición SQL para el texto del buscador, o `undefined` si no queda
 * ninguna palabra útil (p. ej. solo "de la").
 */
export function exerciseSearchCondition(term: string): SQL | undefined {
  const groups = parseExerciseSearch(term);
  if (groups.length === 0) return undefined;
  return matchesAll(exerciseSearchHaystack, groups);
}
