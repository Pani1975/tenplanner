import { describe, expect, it } from "vitest";
import animated from "@/lib/exercise-diagrams/diagrams-animated.json";
import {
  buildTimeline,
  pathLength,
  pointAt,
  sampleTimeline,
} from "@/lib/exercise-diagrams/animate";
import type { Diagram } from "@/lib/exercise-diagrams/types";

const maps = animated as unknown as Record<string, Diagram>;

describe("animación de esquemas", () => {
  it("pointAt recorre una poligonal por longitud", () => {
    const path: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(pathLength(path)).toBe(20);
    expect(pointAt(path, 0)).toEqual([0, 0]);
    expect(pointAt(path, 0.5)).toEqual([10, 0]);
    expect(pointAt(path, 1)).toEqual([10, 10]);
  });

  it("deduce los pasos de shot/move y adjunta el move al vuelo anterior", () => {
    const d: Diagram = {
      court: "mini",
      elements: [
        { t: "player", at: [50, 90], role: "alumno", label: "A" },
        { t: "player", at: [50, 70], role: "monitor", label: "M" },
        { t: "shot", points: [[50, 70], [50, 88]] },
        { t: "shot", points: [[50, 90], [50, 10]] },
        { t: "move", points: [[50, 90], [30, 90]] },
      ],
    };
    const tl = buildTimeline(d);
    expect(tl.premium).toBe(false);
    expect(tl.steps).toHaveLength(2);
    expect(tl.steps[1].moves).toHaveLength(1);
    expect(tl.steps[0].swing).toBe(1); // lanza el monitor
    expect(tl.steps[1].swing).toBe(0); // golpea el alumno
    // Al final el jugador está donde acaba su desplazamiento.
    const end = sampleTimeline(tl, tl.duration);
    expect(end.players[0]).toEqual([30, 90]);
  });

  it("la pelota vuela con altura y reposa en el suelo al acabar", () => {
    const tl = buildTimeline(maps["9a4a7921-71d2-52ec-862c-ec502c1d421a"]);
    expect(tl.premium).toBe(true);
    const mid = sampleTimeline(tl, tl.steps[0].t0 + (tl.steps[0].t1 - tl.steps[0].t0) * 0.25);
    expect(mid.ball?.height).toBeGreaterThan(0);
    const end = sampleTimeline(tl, tl.duration);
    expect(end.ball?.height).toBe(0);
  });

  it("todos los pilotos tienen pasos que duran algo y jugadores dentro de la pista", () => {
    for (const [id, d] of Object.entries(maps)) {
      const tl = buildTimeline(d);
      expect(tl.steps.length, id).toBeGreaterThan(0);
      expect(tl.duration, id).toBeGreaterThan(2);
      for (let t = 0; t <= tl.duration; t += 0.25) {
        const s = sampleTimeline(tl, t);
        for (const p of s.players) {
          expect(p[0], id).toBeGreaterThan(-12);
          expect(p[0], id).toBeLessThan(112);
        }
      }
    }
  });
});
