import { describe, expect, it } from "vitest";
import {
  circuitStandings,
  DEFAULT_POINTS,
  knockoutStages,
  playerKey,
  tournamentPoints,
  type ResultMatch,
} from "@/lib/tournaments/circuit";
import { applyWinner, generateKnockout } from "@/lib/tournaments/bracket";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);

/** Cuadro jugado donde siempre gana el de mejor cabeza de serie. */
function playedKnockout(n: number): ResultMatch[] {
  let ms = generateKnockout(ids(n));
  const rank = (id: string) => Number(id.slice(1));
  for (let pass = 0; pass < 10; pass++) {
    for (const m of ms) {
      if (m.status !== "pending" || !m.entryA || !m.entryB) continue;
      const w = rank(m.entryA) < rank(m.entryB) ? m.entryA : m.entryB;
      const r = applyWinner(ms, m.key, w);
      if (r.ok) ms = r.matches;
    }
  }
  return ms.map((m) => ({
    round: m.round,
    entryA: m.entryA,
    entryB: m.entryB,
    status: m.status,
    winner: m.winner,
  }));
}

describe("knockoutStages", () => {
  it("8 jugadores: campeón, finalista, semis y cuartos", () => {
    const st = knockoutStages(playedKnockout(8));
    expect(st.get("e1")).toBe("winner");
    expect(st.get("e2")).toBe("final");
    expect([st.get("e3"), st.get("e4")]).toEqual(["semifinal", "semifinal"]);
    expect(st.get("e8")).toBe("quarterfinal");
  });

  it("con byes: quien pasa directo y pierde en semis queda en semis", () => {
    const st = knockoutStages(playedKnockout(5));
    expect(st.get("e1")).toBe("winner");
    expect(st.get("e3")).toBe("semifinal");
    // e5 pierde en la 1.ª ronda de un cuadro de 8 (cuartos).
    expect(st.get("e5")).toBe("quarterfinal");
  });

  it("partidos sin jugar no dan puesto", () => {
    expect(knockoutStages(generateKnockout(ids(4))).size).toBe(0);
  });
});

describe("tournamentPoints", () => {
  it("eliminatoria con la tabla por defecto", () => {
    const pts = tournamentPoints("knockout", ids(8), playedKnockout(8));
    expect(pts.get("e1")).toBe(100);
    expect(pts.get("e2")).toBe(70);
    expect(pts.get("e3")).toBe(50);
    expect(pts.get("e5")).toBe(35);
  });

  it("quien se inscribió y no aparece en el cuadro suma la participación", () => {
    const pts = tournamentPoints(
      "knockout",
      ["x", ...ids(4)],
      playedKnockout(4)
    );
    expect(pts.get("x")).toBe(DEFAULT_POINTS.participation);
  });

  it("liguilla: por puesto, empatados con los mismos puntos", () => {
    const matches: ResultMatch[] = [
      { round: 1, entryA: "a", entryB: "b", status: "played", winner: "a" },
      { round: 2, entryA: "a", entryB: "c", status: "played", winner: "a" },
      { round: 3, entryA: "b", entryB: "c", status: "played", winner: "b" },
    ];
    const pts = tournamentPoints("round_robin", ["a", "b", "c"], matches);
    expect([pts.get("a"), pts.get("b"), pts.get("c")]).toEqual([100, 70, 50]);
  });

  it("tabla propia", () => {
    const table = {
      ...DEFAULT_POINTS,
      knockout: { ...DEFAULT_POINTS.knockout, winner: 250 },
    };
    expect(
      tournamentPoints("knockout", ids(4), playedKnockout(4), table).get("e1")
    ).toBe(250);
  });
});

describe("playerKey", () => {
  it("ficha, correo, teléfono y nombre, por ese orden", () => {
    expect(
      playerKey({ studentId: "s1", email: "a@x.com", firstName: "A" })
    ).toBe("s:s1");
    expect(
      playerKey({ email: " A@X.com ", phone: "600112233", firstName: "A" })
    ).toBe("e:a@x.com");
    expect(playerKey({ phone: "600 11 22 33", firstName: "A" })).toBe(
      "p:+34600112233"
    );
    expect(playerKey({ firstName: "Lucía", lastName: " García  López " })).toBe(
      "n:lucia garcia lopez"
    );
  });
});

describe("circuitStandings", () => {
  const ko = (id: string, order: string[]) => ({
    id,
    format: "knockout" as const,
    entries: order.map((p, i) => ({
      id: `${id}-e${i + 1}`,
      players: [{ key: p, name: p.toUpperCase() }],
    })),
    matches: playedKnockout(order.length).map((m) => ({
      ...m,
      entryA: m.entryA && `${id}-${m.entryA}`,
      entryB: m.entryB && `${id}-${m.entryB}`,
      winner: m.winner && `${id}-${m.winner}`,
    })),
  });

  it("suma puntos de varios torneos", () => {
    const rows = circuitStandings([
      ko("t1", ["ana", "bea", "carla", "dani"]),
      ko("t2", ["bea", "ana", "dani", "eva"]),
    ]);
    // ana: 100 + 70; bea: 70 + 100 → empate a 170 y mismo mejor resultado.
    expect(rows.slice(0, 2).map((r) => [r.key, r.points, r.position])).toEqual([
      ["ana", 170, 1],
      ["bea", 170, 1],
    ]);
    const eva = rows.find((r) => r.key === "eva")!;
    expect(eva).toMatchObject({ tournaments: 1, points: 50 });
    expect(rows.find((r) => r.key === "carla")!.byTournament).toEqual({
      t1: 50,
    });
  });

  it("dobles: cada jugador de la pareja suma", () => {
    const rows = circuitStandings([
      {
        id: "t",
        format: "knockout",
        entries: [
          {
            id: "p1",
            players: [
              { key: "a", name: "A" },
              { key: "b", name: "B" },
            ],
          },
          {
            id: "p2",
            players: [
              { key: "c", name: "C" },
              { key: "d", name: "D" },
            ],
          },
        ],
        matches: [
          {
            round: 1,
            entryA: "p1",
            entryB: "p2",
            status: "played",
            winner: "p1",
          },
        ],
      },
    ]);
    expect(rows.map((r) => [r.key, r.points])).toEqual([
      ["a", 100],
      ["b", 100],
      ["c", 70],
      ["d", 70],
    ]);
  });

  it("desempate por mejor resultado y luego por torneos jugados", () => {
    const rows = circuitStandings([
      ko("t1", ["x", "y"]), // x 100, y 70
      ko("t2", ["z", "y"]), // z 100, y 70 → y 140
      ko("t3", ["w", "x"]), // w 100, x 70 → x 170
    ]);
    expect(rows.map((r) => r.key)).toEqual(["x", "y", "w", "z"]);
    // w y z: 100 puntos, mismo mejor y mismos torneos → comparten puesto.
    expect(rows[2].position).toBe(rows[3].position);
  });
});
