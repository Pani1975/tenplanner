import { describe, expect, it } from "vitest";
import {
  evaluateResult,
  evaluateScore,
  flipScore,
  formatScore,
  setWinner,
  type ScoringRules,
} from "@/lib/tournaments/score";

const FULL: ScoringRules = { bestOf: 3, gamesPerSet: 6, finalSet: "full" };
const STB: ScoringRules = {
  bestOf: 3,
  gamesPerSet: 6,
  finalSet: "super_tiebreak",
};

describe("setWinner", () => {
  it.each([
    [6, 0, "a"],
    [4, 6, "b"],
    [7, 5, "a"],
    [6, 7, "b"],
  ] as const)("%i-%i → %s", (a, b, w) => {
    expect(setWinner({ a, b }, 6).winner).toBe(w);
  });

  it.each([
    [6, 5],
    [6, 6],
    [7, 4],
    [8, 6],
    [5, 3],
  ])("%i-%i no es un set terminado", (a, b) => {
    expect(setWinner({ a, b }, 6).winner).toBeNull();
  });

  it("7-6 con tie-break coherente", () => {
    expect(setWinner({ a: 7, b: 6, tiebreak: { a: 7, b: 5 } }, 6).winner).toBe(
      "a"
    );
    expect(
      setWinner({ a: 7, b: 6, tiebreak: { a: 12, b: 10 } }, 6).winner
    ).toBe("a");
  });

  it("tie-break incoherente o mal cerrado", () => {
    // Gana el tie-break quien pierde el set.
    expect(setWinner({ a: 7, b: 6, tiebreak: { a: 5, b: 7 } }, 6).error).toBe(
      "invalid_tiebreak"
    );
    // 7-6 sin dos de diferencia; 12-9 pasado el 7 no vale.
    expect(setWinner({ a: 7, b: 6, tiebreak: { a: 7, b: 6 } }, 6).error).toBe(
      "invalid_tiebreak"
    );
    expect(setWinner({ a: 7, b: 6, tiebreak: { a: 12, b: 9 } }, 6).error).toBe(
      "invalid_tiebreak"
    );
    // Tie-break en un 6-4.
    expect(setWinner({ a: 6, b: 4, tiebreak: { a: 7, b: 2 } }, 6).error).toBe(
      "invalid_tiebreak"
    );
  });

  it("sets cortos a 4 juegos (minitenis)", () => {
    expect(setWinner({ a: 4, b: 2 }, 4).winner).toBe("a");
    expect(setWinner({ a: 5, b: 4 }, 4).winner).toBe("a");
    expect(setWinner({ a: 4, b: 3 }, 4).winner).toBeNull();
  });

  it("rechaza números no válidos", () => {
    expect(setWinner({ a: -1, b: 6 }, 6).error).toBe("invalid_number");
    expect(setWinner({ a: 6.5, b: 2 }, 6).error).toBe("invalid_number");
  });
});

describe("evaluateScore", () => {
  it("6-4 6-3 a dos sets", () => {
    const r = evaluateScore(
      {
        sets: [
          { a: 6, b: 4 },
          { a: 6, b: 3 },
        ],
      },
      FULL
    );
    expect(r).toEqual({
      ok: true,
      winner: "a",
      setsWon: { a: 2, b: 0 },
      games: { a: 12, b: 7 },
    });
  });

  it("tercer set completo", () => {
    const r = evaluateScore(
      {
        sets: [
          { a: 6, b: 4 },
          { a: 3, b: 6 },
          { a: 5, b: 7 },
        ],
      },
      FULL
    );
    expect(r.ok && r.winner).toBe("b");
  });

  it("super tie-break en lugar del tercer set", () => {
    const r = evaluateScore(
      {
        sets: [
          { a: 6, b: 4 },
          { a: 3, b: 6 },
        ],
        superTiebreak: { a: 10, b: 8 },
      },
      STB
    );
    expect(r).toEqual({
      ok: true,
      winner: "a",
      setsWon: { a: 2, b: 1 },
      games: { a: 10, b: 10 },
    });
  });

  it("super tie-break: a 10 con dos de diferencia", () => {
    const base = {
      sets: [
        { a: 6, b: 4 },
        { a: 3, b: 6 },
      ],
    };
    expect(
      evaluateScore({ ...base, superTiebreak: { a: 10, b: 9 } }, STB)
    ).toEqual({ ok: false, error: "invalid_super_tiebreak" });
    expect(
      evaluateScore({ ...base, superTiebreak: { a: 9, b: 7 } }, STB)
    ).toEqual({ ok: false, error: "invalid_super_tiebreak" });
    expect(
      evaluateScore({ ...base, superTiebreak: { a: 14, b: 12 } }, STB).ok
    ).toBe(true);
  });

  it("super tie-break fuera de sitio o no permitido", () => {
    expect(
      evaluateScore(
        {
          sets: [
            { a: 6, b: 4 },
            { a: 6, b: 3 },
          ],
          superTiebreak: { a: 10, b: 2 },
        },
        STB
      )
    ).toEqual({ ok: false, error: "super_tiebreak_misplaced" });
    expect(
      evaluateScore(
        {
          sets: [
            { a: 6, b: 4 },
            { a: 3, b: 6 },
          ],
          superTiebreak: { a: 10, b: 2 },
        },
        FULL
      )
    ).toEqual({ ok: false, error: "super_tiebreak_not_allowed" });
  });

  it("sets de más, partido sin acabar y vacío", () => {
    expect(
      evaluateScore(
        {
          sets: [
            { a: 6, b: 4 },
            { a: 6, b: 3 },
            { a: 6, b: 0 },
          ],
        },
        FULL
      )
    ).toEqual({ ok: false, error: "too_many_sets" });
    expect(
      evaluateScore(
        {
          sets: [
            { a: 6, b: 4 },
            { a: 3, b: 6 },
          ],
        },
        STB
      )
    ).toEqual({ ok: false, error: "unfinished" });
    expect(evaluateScore({ sets: [] }, STB)).toEqual({
      ok: false,
      error: "empty",
    });
  });

  it("a un set", () => {
    const r = evaluateScore(
      { sets: [{ a: 7, b: 6 }] },
      { bestOf: 1, gamesPerSet: 6, finalSet: "full" }
    );
    expect(r.ok && r.winner).toBe("a");
  });

  it("a cinco sets", () => {
    const rules: ScoringRules = { bestOf: 5, gamesPerSet: 6, finalSet: "full" };
    const r = evaluateScore(
      {
        sets: [
          { a: 6, b: 4 },
          { a: 4, b: 6 },
          { a: 6, b: 4 },
          { a: 4, b: 6 },
          { a: 8, b: 6 },
        ],
      },
      rules
    );
    // 8-6 no es un set válido sin ventaja indefinida: aquí el 5.º set va a tie-break.
    expect(r.ok).toBe(false);
  });
});

describe("evaluateResult", () => {
  it("walkover: necesita ganador y no guarda marcador", () => {
    expect(evaluateResult({ resultType: "walkover" })).toEqual({
      ok: false,
      error: "winner_required",
    });
    const r = evaluateResult({ resultType: "walkover", winner: "b" });
    expect(r.ok && r.winner).toBe("b");
    expect(r.ok && r.score).toBeNull();
  });

  it("retirada: el último set puede quedar a medias", () => {
    const r = evaluateResult({
      resultType: "retired",
      winner: "a",
      score: {
        sets: [
          { a: 6, b: 4 },
          { a: 2, b: 1 },
        ],
      },
    });
    expect(r.ok && r.games).toEqual({ a: 8, b: 5 });
    expect(r.ok && r.setsWon).toEqual({ a: 1, b: 0 });
  });

  it("retirada: un set intermedio inválido falla", () => {
    const r = evaluateResult({
      resultType: "retired",
      winner: "a",
      score: {
        sets: [
          { a: 6, b: 5 },
          { a: 2, b: 1 },
        ],
      },
    });
    expect(r.ok).toBe(false);
  });

  it("normal sin marcador falla", () => {
    expect(evaluateResult({ resultType: "normal" })).toEqual({
      ok: false,
      error: "empty",
    });
  });
});

describe("formatScore / flipScore", () => {
  const s = {
    sets: [
      { a: 7, b: 6, tiebreak: { a: 7, b: 5 } },
      { a: 3, b: 6 },
    ],
    superTiebreak: { a: 10, b: 8 },
  };
  it("formato legible", () => {
    expect(formatScore(s)).toBe("7-6(5) 3-6 [10-8]");
    expect(formatScore(null)).toBe("");
  });
  it("dar la vuelta", () => {
    expect(formatScore(flipScore(s))).toBe("6-7(5) 6-3 [8-10]");
  });
});
