import { describe, expect, it } from "vitest";
import {
  emptySet,
  needsTiebreak,
  rowsToScore,
  scoreLayout,
  scoreToRows,
} from "@/lib/tournaments/score-form";
import { evaluateScore, type ScoringRules } from "@/lib/tournaments/score";

const STB: ScoringRules = {
  bestOf: 3,
  gamesPerSet: 6,
  finalSet: "super_tiebreak",
};
const row = (a: string, b: string, tbA = "", tbB = "") => ({ a, b, tbA, tbB });

describe("scoreLayout", () => {
  it("filas de set y super tie-break", () => {
    expect(scoreLayout(STB)).toEqual({ setRows: 2, superTiebreak: true });
    expect(scoreLayout({ ...STB, finalSet: "full" })).toEqual({
      setRows: 3,
      superTiebreak: false,
    });
    expect(scoreLayout({ ...STB, bestOf: 1 })).toEqual({
      setRows: 1,
      superTiebreak: false,
    });
  });
});

describe("rowsToScore", () => {
  it("dos sets, filas vacías ignoradas", () => {
    const r = rowsToScore([row("6", "4"), row("6", "3")], { a: "", b: "" }, 6);
    expect(r).toEqual({
      ok: true,
      score: {
        sets: [
          { a: 6, b: 4 },
          { a: 6, b: 3 },
        ],
      },
    });
    expect(r.ok && evaluateScore(r.score, STB).ok).toBe(true);
  });

  it("7-6 con tie-break y super tie-break", () => {
    const r = rowsToScore(
      [row("7", "6", "7", "5"), row("3", "6")],
      { a: "10", b: "8" },
      6
    );
    expect(r).toEqual({
      ok: true,
      score: {
        sets: [
          { a: 7, b: 6, tiebreak: { a: 7, b: 5 } },
          { a: 3, b: 6 },
        ],
        superTiebreak: { a: 10, b: 8 },
      },
    });
  });

  it("7-6 sin detallar el tie-break también vale", () => {
    const r = rowsToScore([row("7", "6"), row("6", "0")], null, 6);
    expect(r.ok && r.score.sets[0].tiebreak).toBeUndefined();
  });

  it("casillas a medias o con letras: error", () => {
    expect(rowsToScore([row("6", "")], null, 6)).toEqual({
      ok: false,
      error: "invalid_number",
    });
    expect(rowsToScore([row("6", "x")], null, 6).ok).toBe(false);
    expect(rowsToScore([row("7", "6", "7", "")], null, 6).ok).toBe(false);
    expect(rowsToScore([row("6", "4")], { a: "10", b: "" }, 6).ok).toBe(false);
  });

  it("tie-break escrito en un set que no lo lleva se ignora", () => {
    const r = rowsToScore([row("6", "4", "7", "2")], null, 6);
    expect(r).toEqual({ ok: true, score: { sets: [{ a: 6, b: 4 }] } });
  });
});

describe("needsTiebreak / scoreToRows", () => {
  it("solo con g+1 / g", () => {
    expect(needsTiebreak(row("7", "6"), 6)).toBe(true);
    expect(needsTiebreak(row("6", "7"), 6)).toBe(true);
    expect(needsTiebreak(row("7", "5"), 6)).toBe(false);
    expect(needsTiebreak(row("5", "4"), 4)).toBe(true);
    expect(needsTiebreak(emptySet(), 6)).toBe(false);
  });

  it("ida y vuelta", () => {
    const score = {
      sets: [
        { a: 7, b: 6, tiebreak: { a: 9, b: 7 } },
        { a: 2, b: 6 },
      ],
      superTiebreak: { a: 11, b: 9 },
    };
    const { rows, superRow } = scoreToRows(score, STB);
    expect(rowsToScore(rows, superRow, 6)).toEqual({ ok: true, score });
    expect(scoreToRows(null, STB).rows).toHaveLength(2);
  });
});
