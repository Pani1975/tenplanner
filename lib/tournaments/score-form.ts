// Del formulario de marcador (casillas de texto) a MatchScore y al revés.
// Funciones puras, usadas por el editor de resultados.

import type { MatchScore, ScoringRules } from "./score";

export type SetRow = { a: string; b: string; tbA: string; tbB: string };
export type PointsRow = { a: string; b: string };

export const emptySet = (): SetRow => ({ a: "", b: "", tbA: "", tbB: "" });

/** Filas de set y si hay fila de super tie-break, según las reglas. */
export function scoreLayout(rules: ScoringRules) {
  const superTiebreak = rules.finalSet === "super_tiebreak" && rules.bestOf > 1;
  return {
    setRows: superTiebreak ? rules.bestOf - 1 : rules.bestOf,
    superTiebreak,
  };
}

const num = (s: string) => {
  const t = s.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  return Number(t);
};

/** 7-6 (con sets a 6): el set se decidió en tie-break. */
export function needsTiebreak(row: SetRow, gamesPerSet: number) {
  const a = num(row.a);
  const b = num(row.b);
  if (a === null || b === null) return false;
  return Math.max(a, b) === gamesPerSet + 1 && Math.min(a, b) === gamesPerSet;
}

export type FormParse =
  | { ok: true; score: MatchScore }
  | { ok: false; error: "invalid_number" };

/**
 * Convierte las casillas en un marcador. Las filas vacías del final se
 * ignoran (partido decidido antes o retirada); una fila a medio rellenar o
 * con letras es un error.
 */
export function rowsToScore(
  rows: SetRow[],
  superRow: PointsRow | null,
  gamesPerSet: number
): FormParse {
  const sets: MatchScore["sets"] = [];
  for (const r of rows) {
    const empty = !r.a.trim() && !r.b.trim();
    if (empty) continue;
    const a = num(r.a);
    const b = num(r.b);
    if (a === null || b === null) return { ok: false, error: "invalid_number" };
    const set: MatchScore["sets"][number] = { a, b };
    if (needsTiebreak(r, gamesPerSet) && (r.tbA.trim() || r.tbB.trim())) {
      const ta = num(r.tbA);
      const tb = num(r.tbB);
      if (ta === null || tb === null) {
        return { ok: false, error: "invalid_number" };
      }
      set.tiebreak = { a: ta, b: tb };
    }
    sets.push(set);
  }
  const score: MatchScore = { sets };
  if (superRow && (superRow.a.trim() || superRow.b.trim())) {
    const a = num(superRow.a);
    const b = num(superRow.b);
    if (a === null || b === null) return { ok: false, error: "invalid_number" };
    score.superTiebreak = { a, b };
  }
  return { ok: true, score };
}

/** Para editar un resultado ya guardado. */
export function scoreToRows(
  score: MatchScore | null | undefined,
  rules: ScoringRules
): { rows: SetRow[]; superRow: PointsRow } {
  const { setRows } = scoreLayout(rules);
  const rows = Array.from({ length: setRows }, (_, i) => {
    const s = score?.sets[i];
    if (!s) return emptySet();
    return {
      a: String(s.a),
      b: String(s.b),
      tbA: s.tiebreak ? String(s.tiebreak.a) : "",
      tbB: s.tiebreak ? String(s.tiebreak.b) : "",
    };
  });
  const st = score?.superTiebreak;
  return {
    rows,
    superRow: st ? { a: String(st.a), b: String(st.b) } : { a: "", b: "" },
  };
}
