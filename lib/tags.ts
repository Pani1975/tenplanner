/** Etiquetas sin vacías ni duplicadas (sin distinguir mayúsculas); null si no queda ninguna. */
export function normalizeTags(
  tags: string[] | null | undefined
): string[] | null {
  if (!tags) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.length > 0 ? out : null;
}
