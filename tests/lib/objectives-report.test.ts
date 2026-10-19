import { describe, expect, it } from "vitest";
import {
  summarizeObjectivesByLevel,
  type AspectId,
  type BallId,
  type ObjectiveItem,
} from "@/lib/objectives-taxonomy";

let n = 0;
function item(
  ball: BallId,
  achieved: boolean,
  achievedAt: string | null = null,
  aspect: AspectId = "tecnico"
): ObjectiveItem {
  n += 1;
  return {
    id: `id-${n}`,
    code: `c-${n}`,
    ball,
    aspect,
    block: "Derecha",
    title: `Objetivo ${n}`,
    criterion: null,
    source: "rfet",
    sortOrder: n,
    achieved,
    achievedAt: achieved ? (achievedAt ?? "2026-08-01T10:00:00Z") : null,
  };
}

const period = {
  from: new Date("2026-07-01T00:00:00Z"),
  to: new Date("2026-09-30T23:59:59Z"),
};

describe("summarizeObjectivesByLevel", () => {
  it("niveles completos solo se mencionan; el nivel con pendientes lista conseguidos y pendientes", () => {
    const items = [
      item("roja", true),
      item("roja", true),
      item("naranja", true),
      item("verde", true),
      item("verde", false),
      item("verde", false),
    ];
    const out = summarizeObjectivesByLevel(items, period);
    expect(out.map((l) => [l.ball, l.status])).toEqual([
      ["roja", "complete"],
      ["naranja", "complete"],
      ["verde", "partial"],
    ]);
    const verde = out[2];
    expect(verde.achieved).toHaveLength(1);
    expect(verde.pending).toHaveLength(2);
    expect(verde.total).toBe(3);
  });

  it("el primer nivel sin completar se muestra aunque no tenga nada conseguido", () => {
    const items = [
      item("roja", false),
      item("roja", false),
      item("naranja", false),
      item("verde", false),
    ];
    const out = summarizeObjectivesByLevel(items);
    expect(out.map((l) => l.ball)).toEqual(["roja"]);
    expect(out[0].status).toBe("partial");
    expect(out[0].pending).toHaveLength(2);
  });

  it("los niveles posteriores sin nada conseguido no aparecen, pero sí los que ya tienen algo", () => {
    const items = [
      item("roja", true),
      item("roja", false),
      item("naranja", true),
      item("naranja", false),
      item("verde", false),
    ];
    const out = summarizeObjectivesByLevel(items);
    expect(out.map((l) => l.ball)).toEqual(["roja", "naranja"]);
  });

  it("cuenta los objetivos conseguidos dentro del periodo", () => {
    const items = [
      item("roja", true, "2026-08-10T10:00:00Z"),
      item("roja", true, "2026-05-10T10:00:00Z"),
      item("roja", false),
    ];
    const [roja] = summarizeObjectivesByLevel(items, period);
    expect(roja.newInPeriod).toBe(1);
  });

  it("sin objetivos no devuelve niveles", () => {
    expect(summarizeObjectivesByLevel([], period)).toEqual([]);
  });
});
