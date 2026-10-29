import { describe, expect, it } from "vitest";
import base from "@/lib/exercise-diagrams/diagrams.json";
import animated from "@/lib/exercise-diagrams/diagrams-animated.json";

const diagrams = { ...base, ...animated };
import { diagramMapSchema } from "@/lib/exercise-diagrams/schema";
import { buildScene } from "@/lib/exercise-diagrams/scene";

describe("exercise diagrams", () => {
  it("todos los esquemas son válidos", () => {
    const parsed = diagramMapSchema.safeParse(diagrams);
    expect(parsed.success).toBe(true);
  });

  it("todos se pueden convertir en escena", () => {
    for (const [id, d] of Object.entries(diagrams)) {
      const scene = buildScene(d as never);
      expect(scene.prims.length, id).toBeGreaterThan(0);
    }
  });
});
