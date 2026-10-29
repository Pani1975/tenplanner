/**
 * Convierte una query string de filtros (la misma que usan /exercises y
 * /classes) en el objeto de parámetros que esperan getFilteredExerciseIds /
 * getFilteredClassIds. Las claves repetidas se agrupan en arrays.
 */
export function queryStringToParams(
  query: string
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const sp = new URLSearchParams(query.replace(/^\?/, ""));
  for (const [key, value] of sp.entries()) {
    if (key === "page") continue;
    const current = out[key];
    if (current === undefined) out[key] = value;
    else if (Array.isArray(current)) current.push(value);
    else out[key] = [current, value];
  }
  return out;
}

/** Máximo de elementos que se añaden de golpe a una lista desde una búsqueda. */
export const MAX_SAVE_SEARCH_RESULTS = 500;
