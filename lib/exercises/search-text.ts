// Funciones de texto del buscador de ejercicios, sin dependencias de la base
// de datos: se pueden usar también en el navegador (p. ej. para enseñar en
// vivo lo que Ten Planner entiende de unos objetivos).

const NO_STEM = new Set(["reves", "tenis", "mas", "pies", "dos", "tres"]);

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
