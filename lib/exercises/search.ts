import { exercises } from "@/db/schema";
import { and, or, sql, type SQL } from "drizzle-orm";

// Buscador de la biblioteca de ejercicios.
//
// - Ignora tildes y mayúsculas: "reves" encuentra "Revés".
// - Busca palabra a palabra: "dejada globo" encuentra los ejercicios que
//   tienen las dos palabras en cualquier sitio, no la frase exacta.
// - Mira el nombre, el texto (descripción, objetivos, pasos, consejos,
//   variantes) y las etiquetas (golpes, efecto, aspecto, situación de juego,
//   tipo de actividad, categoría y fase).
// - Tolera plurales ("voleas" → "volea") y entiende sinónimos habituales
//   ("smash" → "remate", "drive" → "derecha").

// Palabras que no aportan nada a la búsqueda.
const STOPWORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "e",
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
  "u",
  "un",
  "una",
  "y",
]);

// Grupos de sinónimos (ya normalizados: minúsculas y sin tildes). Escribir
// cualquiera de ellos busca todos los del grupo.
const SYNONYM_GROUPS: string[][] = [
  ["remate", "smash"],
  ["derecha", "drive", "forehand"],
  ["reves", "backhand"],
  ["saque", "servicio", "serve"],
  ["resto", "devolucion"],
  ["globo", "lob"],
  ["dejada", "drop"],
  ["volea", "volley"],
  ["pista", "cancha"],
  ["cesta", "cesto", "canasto", "canasta"],
  ["monitor", "entrenador", "profesor"],
  ["calentamiento", "activacion"],
  ["fisico", "fisica"],
];

const SYNONYMS = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) SYNONYMS.set(word, group);
}

/** Minúsculas, sin tildes y con cualquier signo convertido en espacio. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palabras de la búsqueda, sin repetidas ni palabras vacías. */
export function tokenizeSearch(term: string): string[] {
  const words = normalizeSearchText(term).split(" ").filter(Boolean);
  const meaningful = words.filter((w) => !STOPWORDS.has(w));
  // Si todo eran palabras vacías ("de la"), se busca tal cual.
  return Array.from(new Set(meaningful.length > 0 ? meaningful : words));
}

/**
 * Raíz sin plural, para buscarla como fragmento: "voleas" → "volea",
 * "reveses" → "reves", "golpes" → "golp" (encuentra golpe y golpes).
 * Las palabras cortas no se tocan para no perder "reves" o "tres".
 */
export function singularize(word: string): string {
  if (/\d/.test(word)) return word;
  if (word.endsWith("es") && word.length >= 6) return word.slice(0, -2);
  if (word.endsWith("s") && word.length >= 4) return word.slice(0, -1);
  return word;
}

/**
 * Formas que cuentan como acierto para una palabra de la búsqueda: su raíz
 * y la de sus sinónimos. Se buscan como fragmento, así que "volea" también
 * encuentra "voleas" y "voleando".
 */
export function searchVariants(word: string): string[] {
  const group = SYNONYMS.get(word) ?? SYNONYMS.get(singularize(word)) ?? [];
  const variants = new Set<string>();
  for (const w of [word, ...group]) variants.add(singularize(w));
  // Si una forma contiene a otra, basta con la más corta.
  const list = Array.from(variants);
  return list.filter(
    (v) => !list.some((other) => other !== v && v.includes(other))
  );
}

const ACCENTED = "áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ";
const PLAIN = "aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc";

// Todo lo buscable de un ejercicio en un solo texto, sin tildes y en
// minúsculas. Las categorías y fases se guardan con códigos en inglés, así
// que se traducen a como las ve el monitor.
const searchDocument = sql`lower(translate(concat_ws(' ',
  ${exercises.name},
  ${exercises.description},
  ${exercises.objectives},
  ${exercises.tips},
  ${exercises.variantes},
  ${exercises.observaciones},
  ${exercises.steps}::text,
  ${exercises.golpes}::text,
  ${exercises.efecto}::text,
  ${exercises.aspectoJuego},
  ${exercises.aspectosJuego}::text,
  ${exercises.situacionJuego}::text,
  ${exercises.tipoActividad}::text,
  ${exercises.tiposActividad}::text,
  case ${exercises.category}
    when 'technique' then 'tecnica'
    when 'tactics' then 'tactica'
    when 'fitness' then 'fisico'
    when 'warm-up' then 'calentamiento'
  end,
  replace(replace(replace(
    coalesce(${exercises.fases}::text, ${exercises.phase}::text, ''),
    'activation', 'calentamiento'),
    'cooldown', 'vuelta a la calma'),
    'main', 'parte principal')
), ${ACCENTED}, ${PLAIN}))`;

/**
 * Condición SQL para buscar ejercicios. Cada palabra tiene que aparecer
 * (o un sinónimo suyo) en algún campo; devuelve undefined si no hay nada
 * que buscar.
 */
export function exerciseSearchCondition(term: string): SQL | undefined {
  const words = tokenizeSearch(term);
  if (words.length === 0) return undefined;
  // Los fragmentos solo llevan [a-z0-9 ], así que no hay comodines que escapar.
  const perWord = words.map((word) =>
    or(
      ...searchVariants(word).map(
        (variant) => sql`${searchDocument} like ${`%${variant}%`}`
      )
    )
  );
  return and(...perWord);
}
