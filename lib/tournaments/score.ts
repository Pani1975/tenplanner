// Marcador de tenis: sets, juegos, tie-break y super tie-break.
// Funciones puras, sin acceso a base de datos.

export type Side = "a" | "b";

export type PointsScore = { a: number; b: number };

export type SetScore = {
  a: number; // juegos
  b: number;
  tiebreak?: PointsScore; // puntos del tie-break si el set acabó 7-6
};

export type MatchScore = {
  sets: SetScore[];
  // Super tie-break a 10 en lugar del set decisivo.
  superTiebreak?: PointsScore;
};

export type ResultType = "normal" | "walkover" | "retired";

export type ScoringRules = {
  bestOf: 1 | 3 | 5;
  gamesPerSet: number; // 6 normalmente; 4 en sets cortos de minitenis
  finalSet: "full" | "super_tiebreak";
};

export const DEFAULT_RULES: ScoringRules = {
  bestOf: 3,
  gamesPerSet: 6,
  finalSet: "super_tiebreak",
};

export type ScoreError =
  | "empty"
  | "invalid_number"
  | "invalid_set"
  | "invalid_tiebreak"
  | "invalid_super_tiebreak"
  | "too_many_sets"
  | "unfinished"
  | "super_tiebreak_not_allowed"
  | "super_tiebreak_misplaced";

const isCount = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 99;

/** Tie-break a `target` puntos con dos de diferencia. */
function tiebreakWinner(p: PointsScore, target: number): Side | null {
  const hi = Math.max(p.a, p.b);
  const lo = Math.min(p.a, p.b);
  if (hi < target) return null;
  if (hi - lo < 2) return null;
  // Pasado el objetivo, solo se gana por exactamente dos.
  if (hi > target && hi - lo !== 2) return null;
  return p.a > p.b ? "a" : "b";
}

/** Ganador de un set terminado, o null si el marcador no es válido. */
export function setWinner(
  set: SetScore,
  gamesPerSet: number
): { winner: Side | null; error?: ScoreError } {
  if (!isCount(set.a) || !isCount(set.b)) {
    return { winner: null, error: "invalid_number" };
  }
  const g = gamesPerSet;
  const hi = Math.max(set.a, set.b);
  const lo = Math.min(set.a, set.b);
  const side: Side = set.a > set.b ? "a" : "b";

  // 6-0 … 6-4
  if (hi === g && lo <= g - 2) {
    return set.tiebreak
      ? { winner: null, error: "invalid_tiebreak" }
      : { winner: side };
  }
  // 7-5
  if (hi === g + 1 && lo === g - 1) {
    return set.tiebreak
      ? { winner: null, error: "invalid_tiebreak" }
      : { winner: side };
  }
  // 7-6 con tie-break
  if (hi === g + 1 && lo === g) {
    if (!set.tiebreak) return { winner: side }; // tie-break sin detallar
    if (!isCount(set.tiebreak.a) || !isCount(set.tiebreak.b)) {
      return { winner: null, error: "invalid_number" };
    }
    const tb = tiebreakWinner(set.tiebreak, 7);
    if (tb !== side) return { winner: null, error: "invalid_tiebreak" };
    return { winner: side };
  }
  return { winner: null, error: "invalid_set" };
}

export type ScoreResult =
  | { ok: true; winner: Side; setsWon: PointsScore; games: PointsScore }
  | { ok: false; error: ScoreError };

/**
 * Valida un partido completo y devuelve el ganador.
 * Con `retired`, el marcador puede quedar a medias (último set sin
 * terminar) y el ganador lo indica `retiredSide` (quien se retira pierde).
 */
export function evaluateScore(
  score: MatchScore,
  rules: ScoringRules = DEFAULT_RULES
): ScoreResult {
  const sets = score.sets ?? [];
  if (sets.length === 0 && !score.superTiebreak) {
    return { ok: false, error: "empty" };
  }
  const toWin = Math.ceil(rules.bestOf / 2);
  const won = { a: 0, b: 0 };
  const games = { a: 0, b: 0 };

  for (const set of sets) {
    if (won.a === toWin || won.b === toWin) {
      return { ok: false, error: "too_many_sets" };
    }
    const r = setWinner(set, rules.gamesPerSet);
    if (!r.winner) return { ok: false, error: r.error ?? "invalid_set" };
    won[r.winner] += 1;
    games.a += set.a;
    games.b += set.b;
  }

  if (score.superTiebreak) {
    if (rules.finalSet !== "super_tiebreak" || rules.bestOf === 1) {
      return { ok: false, error: "super_tiebreak_not_allowed" };
    }
    // Solo sustituye al set decisivo: hay que llegar empatados a él.
    if (won.a !== toWin - 1 || won.b !== toWin - 1) {
      return { ok: false, error: "super_tiebreak_misplaced" };
    }
    const st = score.superTiebreak;
    if (!isCount(st.a) || !isCount(st.b)) {
      return { ok: false, error: "invalid_number" };
    }
    const w = tiebreakWinner(st, 10);
    if (!w) return { ok: false, error: "invalid_super_tiebreak" };
    won[w] += 1;
    // El super tie-break cuenta como un set ganado 1-0 en juegos.
    games[w] += 1;
  }

  if (won.a === toWin) return { ok: true, winner: "a", setsWon: won, games };
  if (won.b === toWin) return { ok: true, winner: "b", setsWon: won, games };
  return { ok: false, error: "unfinished" };
}

export type MatchResultInput = {
  resultType: ResultType;
  score?: MatchScore | null;
  // Walkover / retirada: quién gana.
  winner?: Side;
};

export type MatchResult =
  | {
      ok: true;
      winner: Side;
      resultType: ResultType;
      score: MatchScore | null;
      setsWon: PointsScore;
      games: PointsScore;
    }
  | { ok: false; error: ScoreError | "winner_required" };

/** Resultado de un partido: normal, walkover (no presentado) o retirada. */
export function evaluateResult(
  input: MatchResultInput,
  rules: ScoringRules = DEFAULT_RULES
): MatchResult {
  if (input.resultType === "walkover") {
    if (!input.winner) return { ok: false, error: "winner_required" };
    return {
      ok: true,
      winner: input.winner,
      resultType: "walkover",
      score: null,
      setsWon: { a: 0, b: 0 },
      games: { a: 0, b: 0 },
    };
  }
  if (input.resultType === "retired") {
    if (!input.winner) return { ok: false, error: "winner_required" };
    // Se guardan los juegos jugados; los sets terminados deben ser válidos.
    const sets = input.score?.sets ?? [];
    const won = { a: 0, b: 0 };
    const games = { a: 0, b: 0 };
    for (const [i, set] of sets.entries()) {
      if (!isCount(set.a) || !isCount(set.b)) {
        return { ok: false, error: "invalid_number" };
      }
      games.a += set.a;
      games.b += set.b;
      const r = setWinner(set, rules.gamesPerSet);
      if (r.winner) won[r.winner] += 1;
      else if (i < sets.length - 1) {
        // Solo el último set puede quedar a medias.
        return { ok: false, error: r.error ?? "invalid_set" };
      }
    }
    return {
      ok: true,
      winner: input.winner,
      resultType: "retired",
      score: input.score ?? null,
      setsWon: won,
      games,
    };
  }
  if (!input.score) return { ok: false, error: "empty" };
  const r = evaluateScore(input.score, rules);
  if (!r.ok) return r;
  return { ...r, resultType: "normal", score: input.score };
}

/** "6-4 3-6 [10-8]", "7-6(5) 6-2". Desde el lado de A. */
export function formatScore(score: MatchScore | null | undefined): string {
  if (!score) return "";
  const parts = score.sets.map((s) => {
    const tb = s.tiebreak ? `(${Math.min(s.tiebreak.a, s.tiebreak.b)})` : "";
    return `${s.a}-${s.b}${tb}`;
  });
  if (score.superTiebreak) {
    parts.push(`[${score.superTiebreak.a}-${score.superTiebreak.b}]`);
  }
  return parts.join(" ");
}

/** Cambia el orden del marcador (de A-B a B-A). */
export function flipScore(score: MatchScore): MatchScore {
  return {
    sets: score.sets.map((s) => ({
      a: s.b,
      b: s.a,
      ...(s.tiebreak ? { tiebreak: { a: s.tiebreak.b, b: s.tiebreak.a } } : {}),
    })),
    ...(score.superTiebreak
      ? {
          superTiebreak: { a: score.superTiebreak.b, b: score.superTiebreak.a },
        }
      : {}),
  };
}
