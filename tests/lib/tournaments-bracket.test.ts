import { describe, expect, it } from "vitest";
import {
  applyWinner,
  bracketSize,
  champion,
  clearResult,
  generateKnockout,
  orderForDraw,
  roundLabelKey,
  seedOrder,
  shuffle,
  type BracketMatch,
} from "@/lib/tournaments/bracket";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);
const get = (ms: BracketMatch[], key: string) => ms.find((m) => m.key === key)!;

describe("bracketSize / seedOrder", () => {
  it("potencias de 2", () => {
    expect([2, 3, 4, 5, 8, 9, 16, 17].map(bracketSize)).toEqual([
      2, 4, 4, 8, 8, 16, 16, 32,
    ]);
  });
  it("orden estándar", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("generateKnockout", () => {
  it("4 participantes: 2 semis y final, sin byes", () => {
    const ms = generateKnockout(ids(4));
    expect(ms).toHaveLength(3);
    expect(get(ms, "r1-p1")).toMatchObject({
      entryA: "e1",
      entryB: "e4",
      nextKey: "r2-p1",
      nextSlot: "a",
    });
    expect(get(ms, "r1-p2")).toMatchObject({
      entryA: "e2",
      entryB: "e3",
      nextKey: "r2-p1",
      nextSlot: "b",
    });
    expect(get(ms, "r2-p1")).toMatchObject({
      entryA: null,
      entryB: null,
      nextKey: null,
    });
    expect(ms.filter((m) => m.status === "bye")).toHaveLength(0);
  });

  it("5 participantes: 3 byes para los mejores, ya colocados en la 2.ª ronda", () => {
    const ms = generateKnockout(ids(5));
    expect(ms).toHaveLength(7);
    const byes = ms.filter((m) => m.status === "bye");
    expect(byes.map((m) => m.winner).sort()).toEqual(["e1", "e2", "e3"]);
    // e4 contra e5 es el único partido real de la 1.ª ronda.
    const real = ms.filter((m) => m.round === 1 && m.status === "pending");
    expect(real).toHaveLength(1);
    expect([real[0].entryA, real[0].entryB].sort()).toEqual(["e4", "e5"]);
    // e1 espera en semis al ganador de e4-e5.
    expect(get(ms, "r2-p1")).toMatchObject({ entryA: "e1", entryB: null });
    expect(get(ms, "r2-p2")).toMatchObject({ entryA: "e2", entryB: "e3" });
  });

  it("nunca bye contra bye y todos los participantes aparecen una vez", () => {
    for (let n = 2; n <= 33; n++) {
      const ms = generateKnockout(ids(n));
      const first = ms.filter((m) => m.round === 1);
      expect(first.every((m) => m.entryA || m.entryB)).toBe(true);
      const placed = first.flatMap((m) => [m.entryA, m.entryB]).filter(Boolean);
      expect(new Set(placed).size).toBe(n);
      expect(ms).toHaveLength(bracketSize(n) - 1);
      expect(ms.filter((m) => m.status === "bye")).toHaveLength(
        bracketSize(n) - n
      );
    }
  });

  it("2 participantes: solo la final", () => {
    const ms = generateKnockout(ids(2));
    expect(ms).toEqual([
      expect.objectContaining({
        key: "r1-p1",
        entryA: "e1",
        entryB: "e2",
        nextKey: null,
      }),
    ]);
  });

  it("errores", () => {
    expect(() => generateKnockout(["a"])).toThrow("min_two_entries");
    expect(() => generateKnockout(["a", "a"])).toThrow("duplicate_entries");
  });
});

describe("applyWinner / clearResult", () => {
  it("el ganador avanza hasta el campeón", () => {
    let ms = generateKnockout(ids(4));
    const step = (key: string, w: string) => {
      const r = applyWinner(ms, key, w);
      if (!r.ok) throw new Error(r.error);
      ms = r.matches;
    };
    step("r1-p1", "e4");
    step("r1-p2", "e2");
    expect(get(ms, "r2-p1")).toMatchObject({ entryA: "e4", entryB: "e2" });
    expect(champion(ms)).toBeNull();
    step("r2-p1", "e2");
    expect(champion(ms)).toBe("e2");
  });

  it("con bye: el ganador de la 1.ª ronda se cruza con el que pasó directo", () => {
    let ms = generateKnockout(ids(3));
    const r = applyWinner(ms, "r1-p2", "e3");
    expect(r.ok).toBe(true);
    if (r.ok) ms = r.matches;
    expect(get(ms, "r2-p1")).toMatchObject({ entryA: "e1", entryB: "e3" });
  });

  it("corregir un resultado antes de jugar el siguiente cambia quién pasa", () => {
    let ms = generateKnockout(ids(4));
    ms = (
      applyWinner(ms, "r1-p1", "e1") as { ok: true; matches: BracketMatch[] }
    ).matches;
    ms = (
      applyWinner(ms, "r1-p1", "e4") as { ok: true; matches: BracketMatch[] }
    ).matches;
    expect(get(ms, "r2-p1").entryA).toBe("e4");
  });

  it("no deja corregir si el siguiente ya se jugó", () => {
    let ms = generateKnockout(ids(4));
    for (const [k, w] of [
      ["r1-p1", "e1"],
      ["r1-p2", "e2"],
      ["r2-p1", "e1"],
    ] as const) {
      ms = (applyWinner(ms, k, w) as { ok: true; matches: BracketMatch[] })
        .matches;
    }
    expect(applyWinner(ms, "r1-p1", "e4")).toEqual({
      ok: false,
      error: "next_already_played",
    });
    expect(clearResult(ms, "r1-p1")).toEqual({
      ok: false,
      error: "next_already_played",
    });
    // Repetir el mismo ganador sí se permite (p. ej. corregir el marcador).
    expect(applyWinner(ms, "r1-p1", "e1").ok).toBe(true);
  });

  it("errores de entrada", () => {
    const ms = generateKnockout(ids(4));
    expect(applyWinner(ms, "r9-p9", "e1")).toEqual({
      ok: false,
      error: "match_not_found",
    });
    expect(applyWinner(ms, "r2-p1", "e1")).toEqual({
      ok: false,
      error: "missing_opponent",
    });
    expect(applyWinner(ms, "r1-p1", "e2")).toEqual({
      ok: false,
      error: "winner_not_in_match",
    });
  });

  it("borrar un resultado saca al ganador del siguiente partido", () => {
    let ms = generateKnockout(ids(4));
    ms = (
      applyWinner(ms, "r1-p2", "e3") as { ok: true; matches: BracketMatch[] }
    ).matches;
    const r = clearResult(ms, "r1-p2");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(get(r.matches, "r1-p2")).toMatchObject({
        status: "pending",
        winner: null,
      });
      expect(get(r.matches, "r2-p1").entryB).toBeNull();
    }
  });
});

describe("orderForDraw / shuffle / roundLabelKey", () => {
  it("cabezas de serie primero, el resto barajado", () => {
    const seq = [0.9, 0.1, 0.5, 0.3];
    let i = 0;
    const rnd = () => seq[i++ % seq.length];
    const out = orderForDraw(
      [
        { id: "x", seed: null },
        { id: "s2", seed: 2 },
        { id: "y", seed: null },
        { id: "s1", seed: 1 },
        { id: "z", seed: null },
      ],
      rnd
    );
    expect(out.slice(0, 2)).toEqual(["s1", "s2"]);
    expect(out.slice(2).sort()).toEqual(["x", "y", "z"]);
  });

  it("shuffle no pierde elementos ni cambia el original", () => {
    const a = [1, 2, 3, 4, 5];
    const s = shuffle(a, () => 0.42);
    expect(s.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(a).toEqual([1, 2, 3, 4, 5]);
  });

  it("nombres de ronda", () => {
    expect(roundLabelKey(4, 4)).toEqual({ key: "final" });
    expect(roundLabelKey(3, 4)).toEqual({ key: "semifinal" });
    expect(roundLabelKey(2, 4)).toEqual({ key: "quarterfinal" });
    expect(roundLabelKey(1, 4)).toEqual({ key: "round_of", size: 16 });
  });
});
