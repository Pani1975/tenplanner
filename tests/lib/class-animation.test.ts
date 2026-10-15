import { describe, expect, it } from "vitest";
import {
  ANIMATION_MAX_SECONDS,
  buildAnimationTimeline,
  classMinuteAt,
  hasClassAnimation,
} from "@/lib/classes/animation";

// Estructura real de "Clase bola roja 01" (55 min).
const blocks = [
  {
    orderIndex: 1,
    title: "Calentamiento",
    items: [
      {
        kind: "exercise",
        exerciseId: "e1",
        exerciseName: "Carrera",
        durationMinutes: 5,
      },
    ],
  },
  {
    orderIndex: 2,
    title: "Parte principal",
    items: [
      {
        kind: "text",
        title: "Torre/Tee",
        freeText: "Nivel 1",
        durationMinutes: 10,
      },
      { kind: "text", title: "Descanso", freeText: "Agua", durationMinutes: 1 },
      {
        kind: "exercise",
        exerciseId: "e2",
        exerciseName: "Preparación",
        durationMinutes: 10,
      },
      { kind: "text", title: "Descanso", freeText: "Agua", durationMinutes: 1 },
      {
        kind: "exercise",
        exerciseId: "e3",
        exerciseName: "Control",
        durationMinutes: 10,
      },
      { kind: "text", title: "Descanso", freeText: "Agua", durationMinutes: 1 },
      {
        kind: "exercise",
        exerciseId: "e4",
        exerciseName: "Malabares",
        durationMinutes: 10,
      },
      { kind: "text", title: "Descanso", freeText: "Agua", durationMinutes: 2 },
    ],
  },
  {
    orderIndex: 3,
    title: "Vuelta a la calma",
    items: [
      {
        kind: "exercise",
        exerciseId: "e5",
        exerciseName: "Estiramientos",
        durationMinutes: 5,
      },
    ],
  },
];

describe("animación de clase", () => {
  it("solo está activa para la clase piloto", () => {
    expect(hasClassAnimation("3dded14b-8003-4cf7-8c99-3f59cc3ddbe4")).toBe(
      true
    );
    expect(hasClassAnimation("otra")).toBe(false);
  });

  it("dura como máximo 30 s y respeta el orden y las escenas", () => {
    const tl = buildAnimationTimeline(blocks);
    expect(tl.totalSeconds).toBeLessThanOrEqual(ANIMATION_MAX_SECONDS + 1e-9);
    expect(tl.totalClassMinutes).toBe(55);
    expect(tl.steps).toHaveLength(10);
    expect(tl.steps.map((s) => s.scene)).toEqual([
      "warmup",
      "rally",
      "rest",
      "rally",
      "rest",
      "rally",
      "rest",
      "rally",
      "rest",
      "cooldown",
    ]);
    for (const s of tl.steps)
      expect(s.end - s.start).toBeGreaterThanOrEqual(1.6 - 1e-9);
    // Una actividad de 10 min se ve más que un descanso de 1 min.
    expect(tl.steps[1].end - tl.steps[1].start).toBeGreaterThan(
      tl.steps[2].end - tl.steps[2].start
    );
  });

  it("el reloj recorre de 0 a la duración de la clase", () => {
    const tl = buildAnimationTimeline(blocks);
    expect(classMinuteAt(tl, 0)).toBe(0);
    expect(classMinuteAt(tl, tl.steps[1].start)).toBeCloseTo(5);
    expect(classMinuteAt(tl, tl.totalSeconds)).toBe(55);
  });
});
