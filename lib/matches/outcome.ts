/**
 * Victoria o derrota a partir del resultado final. El primer número de cada
 * set son los juegos del jugador y el segundo los del rival ("6-4 3-6 10-8").
 * Gana quien se lleva más sets; con los sets empatados (o sin resultado)
 * no se puede saber y devuelve null.
 */
export type MatchOutcome = "victoria" | "derrota";

export function matchOutcome(
  finalResult: string | null | undefined
): MatchOutcome | null {
  if (!finalResult) return null;
  let mine = 0;
  let theirs = 0;
  for (const set of finalResult.trim().split(/\s+/)) {
    // "7-6(5)": el desempate entre paréntesis no cuenta.
    const m = set.match(/^(\d{1,2})-(\d{1,2})(?:\(\d{1,2}\))?$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > b) mine++;
    else if (b > a) theirs++;
  }
  if (mine === theirs) return null;
  return mine > theirs ? "victoria" : "derrota";
}

export const OUTCOME_LABELS: Record<MatchOutcome, string> = {
  victoria: "Victoria",
  derrota: "Derrota",
};
