/**
 * Límite de páginas de la biblioteca (ejercicios y clases) para visitantes
 * sin cuenta: 10 páginas distintas (listas y fichas, todo junto) y después se
 * pide registrarse. Lo cuenta una cookie del navegador, así que es un freno
 * suave, no una barrera: quien borre las cookies empieza de nuevo. No afecta
 * a quien tiene sesión ni a los buscadores (Google sigue indexando).
 */
export const FREE_VIEWS_LIMIT = 10;
export const FREE_VIEWS_COOKIE = "tp_free_views";
export const FREE_VIEWS_MAX_AGE = 60 * 60 * 24 * 30;

const BOT_RE =
  /bot|crawl|spider|slurp|googleother|google-inspectiontool|mediapartners|apis-google|facebookexternalhit|embedly|whatsapp|telegram|linkedin|pinterest|preview|lighthouse|pagespeed/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  return !!ua && BOT_RE.test(ua);
}

/** ¿Es una página de la biblioteca pública? (no la API) */
export function isLibraryPath(pathname: string): boolean {
  return (
    pathname === "/exercises" ||
    pathname === "/classes" ||
    pathname.startsWith("/exercises/") ||
    pathname.startsWith("/classes/")
  );
}

/** Clave corta y estable de una página (ruta + filtros). */
export function viewKey(pathname: string, search: string): string {
  const s = `${pathname.replace(/\/+$/, "")}?${search.replace(/^\?/, "")}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function parseViews(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(".")
    .filter((k) => /^[0-9a-z]{1,8}$/.test(k))
    .slice(0, FREE_VIEWS_LIMIT);
}

/** Resultado de contar una visita. */
export function countView(
  raw: string | undefined,
  key: string
): { allowed: boolean; views: string[]; changed: boolean } {
  const views = parseViews(raw);
  if (views.includes(key)) return { allowed: true, views, changed: false };
  if (views.length >= FREE_VIEWS_LIMIT)
    return { allowed: false, views, changed: false };
  return { allowed: true, views: [...views, key], changed: true };
}
