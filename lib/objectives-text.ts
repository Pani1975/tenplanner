// Los campos de objetivos de ejercicios, clases, sesiones y grupos son texto
// libre. Al cargar objetivos del catálogo se añaden como líneas nuevas al
// final, sin repetir los que ya están escritos.

/** Quita la numeración o viñeta del principio de una línea ("1) ", "- ", "• "). */
export function stripObjectivePrefix(line: string): string {
  return line
    .trim()
    .replace(/^(?:\d+\s*[).:-]|[-•*·])\s*/, "")
    .trim();
}

function normalize(s: string) {
  return stripObjectivePrefix(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.;,]+$/, "")
    .trim();
}

/** Objetivos ya escritos en el texto (una línea por objetivo, sin numeración). */
export function objectiveLines(text: string | null | undefined): string[] {
  return (text ?? "").split(/\r?\n/).map(stripObjectivePrefix).filter(Boolean);
}

/** ¿Está ya este objetivo en el texto? */
export function textHasObjective(
  text: string | null | undefined,
  title: string
): boolean {
  const target = normalize(title);
  return objectiveLines(text).some((l) => normalize(l) === target);
}

/**
 * Añade los objetivos al final del texto, uno por línea. Con `numbered`
 * continúa la numeración "1) 2) …" de las líneas que ya haya. Los que ya
 * están escritos no se repiten.
 */
export function appendObjectiveLines(
  current: string | null | undefined,
  titles: string[],
  opts: { numbered?: boolean } = {}
): string {
  const base = (current ?? "").replace(/\s+$/, "");
  const seen = new Set(objectiveLines(base).map(normalize));
  const fresh: string[] = [];
  for (const t of titles) {
    const clean = t.trim();
    const key = normalize(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    fresh.push(clean);
  }
  if (fresh.length === 0) return current ?? "";

  // Sigue la numeración más alta ya escrita (también "1) … 2) …" en una línea).
  const used = [...base.matchAll(/(?:^|\s)(\d+)\)/g)].map((m) => Number(m[1]));
  let next = used.length
    ? Math.max(...used) + 1
    : objectiveLines(base).length + 1;
  const lines = fresh.map((t) => (opts.numbered ? `${next++}) ${t}` : t));
  return base ? `${base}\n${lines.join("\n")}` : lines.join("\n");
}
