import { describe, expect, it } from "vitest";
import {
  computeStandings,
  generateRoundRobin,
  roundRobinMatchCount,
  type PlayedMatch,
} from "@/lib/tournaments/round-robin";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);

describe("generateRoundRobin", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 11])(
    "%i participantes: todos contra todos una vez",
    (n) => {
      const ps = generateRoundRobin(ids(n));
      expect(ps).toHaveLength(roundRobinMatchCount(n));
      const pairs = new Set(
        ps.map((p) => [p.entryA, p.entryB].sort().join("|"))
      );
      expect(pairs.size).toBe(ps.length);
      // Un partido por jornada como mucho para cada participante.
      const byRound = new Map<number, string[]>();
      for (const p of ps) {
        const list = byRound.get(p.round) ?? [];
        list.push(p.entryA, p.entryB);
        byRound.set(p.round, list);
      }
      for (const list of byRound.values()) {
        expect(new Set(list).size).toBe(list.length);
      }
      expect(byRound.size).toBe(n % 2 === 0 ? n - 1 : n);
      // Posiciones únicas por jornada (clave única en la base).
      const slots = new Set(ps.map((p) => `${p.round}-${p.position}`));
      expect(slots.size).toBe(ps.length);
    }
  );

  it("errores", () => {
    expect(() => generateRoundRobin(["a"])).toThrow("min_two_entries");
    expect(() => generateRoundRobin(["a", "b", "a"])).toThrow(
      "duplicate_entries"
    );
  });
});

const m = (
  a: string,
  b: string,
  winner: string | null,
  sets: [number, number] = [2, 0],
  games: [number, number] = [12, 4]
): PlayedMatch => ({
  entryA: a,
  entryB: b,
  winner,
  setsWon: { a: sets[0], b: sets[1] },
  games: { a: games[0], b: games[1] },
});

describe("computeStandings", () => {
  it("ordena por partidos ganados", () => {
    const rows = computeStandings(
      ["a", "b", "c"],
      [m("a", "b", "a"), m("a", "c", "a"), m("b", "c", "b")]
    );
    expect(rows.map((r) => [r.entry, r.won, r.position])).toEqual([
      ["a", 2, 1],
      ["b", 1, 2],
      ["c", 0, 3],
    ]);
    expect(rows[0]).toMatchObject({
      played: 2,
      setsFor: 4,
      setsAgainst: 0,
      gamesFor: 24,
      gamesAgainst: 8,
    });
  });

  it("empate a dos: decide el enfrentamiento directo aunque el otro tenga mejor diferencia", () => {
    const rows = computeStandings(
      ["a", "b", "c", "d"],
      [
        m("a", "b", "a", [2, 1], [13, 12]),
        m("b", "c", "b", [2, 0], [12, 0]),
        m("b", "d", "b", [2, 0], [12, 0]),
        m("a", "c", "c", [0, 2], [5, 12]),
        m("a", "d", "a", [2, 1], [13, 12]),
        m("c", "d", "d", [1, 2], [12, 13]),
      ]
    );
    // a y b: 2 victorias; a ganó a b.
    expect(rows.slice(0, 2).map((r) => r.entry)).toEqual(["a", "b"]);
  });

  it("empate a tres en círculo: decide la diferencia de sets", () => {
    const rows = computeStandings(
      ["a", "b", "c"],
      [
        m("a", "b", "a", [2, 1], [13, 11]),
        m("b", "c", "b", [2, 0], [12, 3]),
        m("c", "a", "c", [2, 1], [13, 12]),
      ]
    );
    // Sets: a 3-3, b 3-2, c 2-3 → b, a, c.
    expect(rows.map((r) => r.entry)).toEqual(["b", "a", "c"]);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
  });

  it("empate total: comparten puesto y se mantiene el orden de entrada", () => {
    const rows = computeStandings(["a", "b", "c"], []);
    expect(rows.map((r) => [r.entry, r.position])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 1],
    ]);
  });

  it("walkover cuenta como victoria sin sets ni juegos; sin jugar no cuenta", () => {
    const rows = computeStandings(
      ["a", "b", "c"],
      [
        { entryA: "a", entryB: "b", winner: "b" },
        { entryA: "a", entryB: "c", winner: null },
      ]
    );
    expect(rows[0]).toMatchObject({
      entry: "b",
      won: 1,
      played: 1,
      setsFor: 0,
      gamesFor: 0,
    });
    expect(rows.find((r) => r.entry === "c")).toMatchObject({ played: 0 });
  });

  it("ignora partidos de participantes que ya no están", () => {
    const rows = computeStandings(
      ["a", "b"],
      [m("a", "x", "a"), m("a", "b", "b")]
    );
    expect(rows.map((r) => [r.entry, r.won])).toEqual([
      ["b", 1],
      ["a", 0],
    ]);
  });
});
