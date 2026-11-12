import { describe, expect, it } from "vitest";
import {
  generateSession,
  type EngineData,
  type EngineExercise,
  type GenerateInput,
} from "@/lib/session-engine";
import { fitDurations } from "@/lib/session-engine/fit";
import { resolveGroupLevel } from "@/lib/session-engine/level";
import {
  keywordHits,
  objectiveLabels,
  parseObjectiveLines,
  parseObjectives,
} from "@/lib/session-engine/objectives";
import { buildSkeleton } from "@/lib/session-engine/skeleton";
import type { SkillLevel } from "@/lib/skill-levels";

const LEVELS: SkillLevel[] = [
  "familiarizacion",
  "descubrimiento",
  "desarrollo",
  "consolidacion",
  "especializacion",
  "precompeticion",
  "competicion",
  "rendimiento",
].map((code, i) => ({
  code,
  sport: "tenis",
  track: "base",
  position: i + 1,
  labelEs: code,
}));

// Biblioteca de prueba: variedad de fases, niveles, golpes y carácter,
// con un tercio de ejercicios sin golpes (como en la base real).
function library(): EngineExercise[] {
  const out: EngineExercise[] = [];
  const golpes = ["derecha", "reves", "saque", "volea", "resto"];
  const niveles = ["descubrimiento", "desarrollo", "consolidacion"];
  const durs = [5, 8, 10, 15];
  let n = 0;
  for (const nivel of niveles) {
    for (const fase of ["activation", "main", "main", "main", "cooldown"]) {
      for (let k = 0; k < 6; k++) {
        n++;
        const g = n % 3 === 0 ? [] : [golpes[n % golpes.length]];
        out.push({
          id: `ex-${String(n).padStart(3, "0")}`,
          name: `Ejercicio ${n}`,
          durationMinutes: durs[n % durs.length],
          fases: [fase],
          niveles: [nivel],
          golpes: g,
          caracter: [["cooperativo", "reto", "competitivo"][n % 3]],
          aspectos: [["tecnica", "tactica", "fisico"][n % 3]],
          tipoActividad: ["tecnico_tactico", "ludico", "competitivo"][n % 3],
          tipoPelota: ["roja", "naranja", "verde"][n % 3],
          numJugadores: n % 5 === 0 ? 6 : null,
          hasSteps: n % 4 !== 0,
          hasVariantes: n % 2 === 0,
          hasMedia: n % 7 === 0,
          ratingAvg: null,
        });
      }
    }
  }
  return out;
}

function data(over: Partial<EngineData> = {}): EngineData {
  return {
    sport: "tenis",
    levels: LEVELS,
    attendeeLevels: ["desarrollo", "desarrollo", "consolidacion"],
    groupDefaultLevel: null,
    exercises: library(),
    recentSessions: [],
    ...over,
  };
}

function input(over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    groupId: "g1",
    durationMinutes: 60,
    intensity: "media",
    focus: "reves",
    attendeeIds: ["a", "b", "c", "d", "e", "f"],
    seed: "g1|2026-11-12",
    ...over,
  };
}

describe("generateSession", () => {
  it.each([30, 45, 60, 90] as const)(
    "la suma de minutos es exactamente %i",
    (d) => {
      for (const intensity of ["suave", "media", "alta"] as const) {
        const plan = generateSession(
          input({ durationMinutes: d, intensity }),
          data()
        );
        expect(plan.durationMinutes).toBe(d);
        expect(plan.items.reduce((n, it) => n + it.minutes, 0)).toBe(d);
        expect(plan.items.every((it) => it.minutes >= 1)).toBe(true);
      }
    }
  );

  it("es determinista con la misma semilla", () => {
    const a = generateSession(input(), data());
    const b = generateSession(input(), data());
    expect(a.items.map((i) => i.exerciseId)).toEqual(
      b.items.map((i) => i.exerciseId)
    );
  });

  it("respeta las fases: empieza en calentamiento y acaba en vuelta a la calma", () => {
    const plan = generateSession(input({ durationMinutes: 90 }), data());
    expect(plan.items[0].phase).toBe("activation");
    expect(plan.items[plan.items.length - 1].phase).toBe("cooldown");
    expect(new Set(plan.items.map((i) => i.exerciseId)).size).toBe(
      plan.items.length
    );
  });

  it("'Otra propuesta' cambia al menos la mitad de lo no fijado y respeta lo fijado", () => {
    const first = generateSession(input(), data());
    const pinned = first.items[1];
    const second = generateSession(
      input({
        seed: "g1|2026-11-12#2",
        previousIds: first.items.map((i) => i.exerciseId),
        pinned: [
          {
            slotIndex: pinned.slotIndex,
            exerciseId: pinned.exerciseId,
            minutes: pinned.minutes,
          },
        ],
      }),
      data()
    );
    const kept = second.items.find((i) => i.slotIndex === pinned.slotIndex)!;
    expect(kept.exerciseId).toBe(pinned.exerciseId);
    expect(kept.minutes).toBe(pinned.minutes);
    expect(kept.pinned).toBe(true);
    const free = second.items.filter((i) => !i.pinned);
    const prev = new Set(first.items.map((i) => i.exerciseId));
    const changed = free.filter((i) => !prev.has(i.exerciseId)).length;
    expect(changed / free.length).toBeGreaterThanOrEqual(0.5);
    expect(second.durationMinutes).toBe(60);
  });

  it("no repite ejercicios de las 3 últimas sesiones completadas", () => {
    const first = generateSession(input(), data());
    const recent = [first.items.map((i) => i.exerciseId)];
    const next = generateSession(
      input({ seed: "otra" }),
      data({ recentSessions: recent })
    );
    const used = new Set(recent[0]);
    expect(next.items.some((i) => used.has(i.exerciseId))).toBe(false);
    expect(next.repeatedRecent).toBe(false);
  });

  it("grupo sin niveles: usa el nivel por defecto del grupo y si no, descubrimiento", () => {
    const withDefault = generateSession(
      input(),
      data({ attendeeLevels: [null, null], groupDefaultLevel: "consolidacion" })
    );
    expect(withDefault.groupLevel).toBe("consolidacion");
    expect(withDefault.levelSource).toBe("grupo");
    const none = generateSession(
      input(),
      data({ attendeeLevels: [null], groupDefaultLevel: null })
    );
    expect(none.groupLevel).toBe("descubrimiento");
    expect(none.levelSource).toBe("defecto");
    expect(none.durationMinutes).toBe(60);
  });

  it("grupo de 2 asistentes: no propone ejercicios para más jugadores", () => {
    const lib = library();
    const plan = generateSession(
      input({ attendeeIds: ["a", "b"] }),
      data({ exercises: lib })
    );
    const byId = new Map(lib.map((e) => [e.id, e]));
    for (const it of plan.items) {
      const n = byId.get(it.exerciseId)!.numJugadores;
      if (it.relaxStep < 5) expect(n === null || n <= 2).toBe(true);
    }
    expect(plan.durationMinutes).toBe(60);
  });

  it("ejercicios sin golpes: relaja el filtro de golpe y lo explica", () => {
    const lib = library().map((e) => ({ ...e, golpes: [] }));
    const plan = generateSession(
      input({ focus: "reves" }),
      data({ exercises: lib })
    );
    const tecnica = plan.items.find((i) => i.kind === "tecnica")!;
    expect(tecnica.relaxStep).toBeGreaterThanOrEqual(2);
    expect(plan.explanations.some((t) => t.includes("Técnica"))).toBe(true);
    expect(plan.durationMinutes).toBe(60);
  });

  it("foco automático: el golpe menos trabajado", () => {
    const plan = generateSession(
      input({ focus: "auto" }),
      data({
        recentGolpeCounts: {
          derecha: 5,
          reves: 4,
          saque: 0,
          volea: 3,
          resto: 2,
        },
      })
    );
    expect(plan.focus).toBe("saque");
    expect(plan.focusWasAuto).toBe(true);
    expect(plan.explanations[0]).toContain("Saque");
  });

  it("más difícil sube el nivel solo en ese hueco", () => {
    const base = generateSession(input(), data());
    const tIdx = base.items.find((i) => i.kind === "tecnica")!.slotIndex;
    const harder = generateSession(
      input({
        pinned: base.items
          .filter((i) => i.slotIndex !== tIdx)
          .map((i) => ({
            slotIndex: i.slotIndex,
            exerciseId: i.exerciseId,
            minutes: i.minutes,
          })),
        slotAdjust: {
          slotIndex: tIdx,
          levelShift: 1,
          excludeIds: [
            base.items.find((i) => i.slotIndex === tIdx)!.exerciseId,
          ],
        },
      }),
      data()
    );
    const lib = new Map(library().map((e) => [e.id, e]));
    const it = harder.items.find((i) => i.slotIndex === tIdx)!;
    expect(it.exerciseId).not.toBe(
      base.items.find((i) => i.slotIndex === tIdx)!.exerciseId
    );
    if (it.relaxStep === 0)
      expect(lib.get(it.exerciseId)!.niveles).toContain("consolidacion");
  });
});

describe("resolveGroupLevel", () => {
  it("moda de los que vienen; empate, el más bajo", () => {
    expect(
      resolveGroupLevel(LEVELS, ["desarrollo", "consolidacion"], null).code
    ).toBe("desarrollo");
    expect(
      resolveGroupLevel(
        LEVELS,
        ["consolidacion", "consolidacion", "desarrollo"],
        null
      ).code
    ).toBe("consolidacion");
  });
});

describe("buildSkeleton", () => {
  it("la intensidad mueve minutos hacia o desde los puntos sin cambiar el total", () => {
    const sum = (k: string, i: "suave" | "media" | "alta") =>
      buildSkeleton(60, i)
        .filter((s) => s.kind === k)
        .reduce((n, s) => n + s.minutes, 0);
    expect(sum("puntos", "suave")).toBeLessThan(sum("puntos", "media"));
    expect(sum("puntos", "alta")).toBeGreaterThan(sum("puntos", "media"));
    for (const i of ["suave", "media", "alta"] as const) {
      expect(buildSkeleton(60, i).reduce((n, s) => n + s.minutes, 0)).toBe(60);
    }
  });
});

describe("fitDurations", () => {
  it("cuadra el total aunque los ejercicios sean cortos", () => {
    const m = fitDurations(
      [
        { target: 10, exerciseMinutes: 5, pinned: false, isPuntos: false },
        { target: 30, exerciseMinutes: 5, pinned: false, isPuntos: true },
      ],
      40
    );
    expect(m[0] + m[1]).toBe(40);
  });
});

describe("duración libre y objetivos", () => {
  it.each([20, 55, 75, 120])("cualquier duración suma exacto (%i min)", (d) => {
    const plan = generateSession(input({ durationMinutes: d }), data());
    expect(plan.durationMinutes).toBe(d);
    expect(plan.items.every((it) => it.minutes >= 1)).toBe(true);
  });

  it("los objetivos eligen el foco automático y lo explican", () => {
    const plan = generateSession(
      input({
        focus: "auto",
        objectives:
          "Controlar peloteo\nDominar situaciones de juego\nConseguir seguridad en el servicio",
      }),
      data({ recentGolpeCounts: { saque: 9, derecha: 0 } })
    );
    expect(plan.focus).toBe("saque");
    expect(plan.explanations[0]).toContain("objetivos");
  });
});

describe("parseObjectives", () => {
  it("saca golpes y aspectos del texto", () => {
    const r = parseObjectives(
      "Controlar peloteo\nDominar situaciones de juego\nConseguir seguridad en el servicio"
    );
    expect(r.golpes).toEqual(["saque"]);
    expect(r.aspectos).toEqual(
      expect.arrayContaining(["tecnica", "tactica", "mental"])
    );
  });

  it("'red' es volea solo si no hay otro golpe", () => {
    expect(parseObjectives("Subir a la red").golpes).toEqual(["volea"]);
    expect(parseObjectives("Remate cerca de la red").golpes).toEqual([
      "remate",
    ]);
    expect(parseObjectives("").golpes).toEqual([]);
  });
});

describe("objetivos escritos por el monitor", () => {
  it("«Mejorar el control de la derecha» → derecha, técnica, dirección y profundidad", () => {
    const [line] = parseObjectiveLines("Mejorar el control de la derecha");
    expect(line.recognized).toBe(true);
    expect(line.golpes).toEqual(["derecha"]);
    expect(line.aspectos).toEqual(["tecnica"]);
    expect(line.parametros).toEqual(["direccion", "profundidad"]);
    expect(objectiveLabels(line)).toEqual([
      "Derecha",
      "Técnica",
      "Dirección",
      "Profundidad",
    ]);
  });

  it("reconoce situaciones, puntos y aspectos; avisa de lo que no entiende", () => {
    const lines = parseObjectiveLines(
      "• Defender con bolas altas\nJugar puntos atacando la red\nPasarlo bien"
    );
    expect(lines[0].situaciones).toContain("defensa");
    expect(lines[0].aspectos).toEqual(["tactica"]);
    expect(lines[0].parametros).toContain("altura");
    expect(lines[1].competitivo).toBe(true);
    expect(lines[1].situaciones).toContain("ataque");
    expect(lines[1].golpes).toEqual(["volea"]);
    expect(lines[2].recognized).toBe(false);
  });

  it("compara las raíces con el texto de la ficha", () => {
    const { keywords } = parseObjectives(
      "Dar seguridad al peloteo con bolas arqueadas"
    );
    expect(
      keywordHits(keywords, "pelotear con bolas arqueadas que pasan la red")
    ).toBeGreaterThan(0);
  });

  it("el motor prefiere los ejercicios cuya ficha encaja con los objetivos", () => {
    const lib = library().map((e) => ({
      ...e,
      text: "",
      parametros: [] as string[],
    }));
    // Marca un ejercicio de técnica de nivel desarrollo como el que encaja.
    const target = lib.find(
      (e) =>
        e.fases.includes("main") &&
        e.aspectos.includes("tecnica") &&
        e.niveles.includes("desarrollo")
    )!;
    target.text = "control de la derecha en diagonal";
    target.parametros = ["direccion", "profundidad"];
    target.golpes = ["derecha"];
    let hits = 0;
    for (let i = 0; i < 10; i++) {
      const plan = generateSession(
        input({
          seed: `obj-${i}`,
          focus: "auto",
          objectives: "Mejorar el control de la derecha",
        }),
        data({ exercises: lib })
      );
      if (plan.items.some((it) => it.exerciseId === target.id)) hits++;
      expect(
        plan.explanations.some((t) => t.startsWith("Por tus objetivos"))
      ).toBe(true);
    }
    expect(hits).toBeGreaterThanOrEqual(6);
  });
});
