import { describe, expect, it } from "vitest";
import {
  computeTrainingStats,
  strokeMinutes,
  type StatExerciseInfo,
} from "@/lib/stats/training-stats";

const ex = new Map<string, StatExerciseInfo>([
  [
    "peloteo2",
    {
      name: "Peloteo",
      tipos: ["peloteo"],
      golpes: ["derecha", "reves"],
      aspectos: ["tecnica"],
    },
  ],
  [
    "peloteo1",
    {
      name: "Peloteo derecha",
      tipos: ["peloteo"],
      golpes: ["derecha"],
      aspectos: ["tecnica", "tactica"],
    },
  ],
  [
    "puntos",
    {
      name: "Puntos",
      tipos: ["juego_puntos"],
      golpes: ["derecha", "saque"],
      aspectos: ["tactica"],
    },
  ],
  [
    "tecnico",
    {
      name: "Saque y volea",
      tipos: ["tecnico_cerrado"],
      golpes: ["saque", "volea"],
      aspectos: ["tecnica"],
    },
  ],
  [
    "mixto",
    {
      name: "Peloteo con puntos",
      tipos: ["peloteo", "juego_puntos"],
      golpes: ["derecha", "reves", "volea"],
    },
  ],
]);

describe("reparto de golpes", () => {
  it("peloteo: cada golpe suma el tiempo entero", () => {
    expect(Object.fromEntries(strokeMinutes(ex.get("peloteo2"), 10))).toEqual({
      derecha: 10,
      reves: 10,
    });
    expect(Object.fromEntries(strokeMinutes(ex.get("peloteo1"), 10))).toEqual({
      derecha: 10,
    });
    expect(Object.fromEntries(strokeMinutes(ex.get("mixto"), 10))).toEqual({
      derecha: 10,
      reves: 10,
      volea: 10,
    });
  });
  it("puntos: no suma a golpes", () => {
    expect(strokeMinutes(ex.get("puntos"), 10).size).toBe(0);
  });
  it("resto: reparte a partes iguales", () => {
    expect(Object.fromEntries(strokeMinutes(ex.get("tecnico"), 10))).toEqual({
      saque: 5,
      volea: 5,
    });
  });
});

describe("estadística de entrenamiento", () => {
  const stats = computeTrainingStats(
    [
      {
        id: "s1",
        durationMinutes: 60,
        blocks: [
          {
            orderIndex: 1,
            items: [
              { kind: "exercise", exerciseId: "peloteo2", durationMinutes: 10 },
            ],
          },
          {
            orderIndex: 2,
            items: [
              { kind: "exercise", exerciseId: "peloteo1", durationMinutes: 20 },
              { kind: "warmup", durationMinutes: 5 },
              { kind: "exercise", exerciseId: "puntos", durationMinutes: 15 },
            ],
          },
          {
            orderIndex: 3,
            items: [
              {
                kind: "text",
                title: "Estiramientos",
                aspectoJuego: "fisico",
                durationMinutes: 10,
              },
            ],
          },
        ],
      },
      {
        id: "s2",
        durationMinutes: 45,
        blocks: [
          {
            orderIndex: 2,
            items: [
              { kind: "exercise", exerciseId: "peloteo1", durationMinutes: 20 },
            ],
          },
        ],
      },
    ],
    ex
  );

  it("suma horas y fases (con descansos)", () => {
    expect(stats.totalMinutes).toBe(105);
    expect(stats.phases.map((p) => [p.key, p.minutes])).toEqual([
      ["activation", 10],
      ["main", 60],
      ["cooldown", 10],
    ]);
  });

  it("aspectos sin descansos y repartidos", () => {
    const m = Object.fromEntries(stats.aspects.map((a) => [a.key, a.minutes]));
    expect(m).toEqual({ tecnica: 30, tactica: 35, fisico: 10, mental: 0 });
  });

  it("golpes y ejercicio más hecho", () => {
    expect(stats.strokes[0]).toMatchObject({ key: "derecha", minutes: 50 });
    expect(stats.strokes.find((s) => s.key === "reves")?.minutes).toBe(10);
    expect(stats.topExercises[0]).toMatchObject({
      name: "Peloteo derecha",
      times: 2,
      minutes: 40,
    });
    expect(stats.types[0].key).toBe("peloteo");
  });
});
