import { describe, expect, it } from "vitest";
import type { ObjectiveItem } from "@/lib/objectives-taxonomy";
import { planPlace, resolveObjectives } from "@/lib/objectives-resolve";

function item(
  id: string,
  sortOrder: number,
  group: Partial<Pick<ObjectiveItem, "ball" | "aspect" | "block">> = {}
): ObjectiveItem {
  return {
    id,
    code: id,
    ball: "roja",
    aspect: "tecnico",
    block: "Derecha",
    title: id,
    criterion: null,
    source: "desglose",
    sortOrder,
    isFinal: false,
    achieved: false,
    achievedAt: null,
    scope: "base",
    hidden: false,
    overriddenAt: [],
    ...group,
  };
}

const derecha = { ball: "roja", aspect: "tecnico", block: "Derecha" };
const reves = { ball: "roja", aspect: "tecnico", block: "Revés" };

describe("planPlace", () => {
  const items = [
    item("a", 1),
    item("b", 2),
    item("c", 3),
    item("x", 10, { block: "Revés" }),
    item("y", 11, { block: "Revés" }),
  ];

  it("lleva un objetivo al principio de su grupo", () => {
    expect(planPlace(items, "c", derecha, "a")).toEqual([
      { id: "c", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
      { id: "b", sortOrder: 3 },
    ]);
  });

  it("lleva un objetivo al final de su grupo", () => {
    expect(planPlace(items, "a", derecha, null)).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
      { id: "a", sortOrder: 3 },
    ]);
  });

  it("no cambia nada si ya está en su sitio", () => {
    expect(planPlace(items, "b", derecha, "c")).toBeNull();
  });

  it("mueve un objetivo a otro grupo, en medio", () => {
    expect(planPlace(items, "a", reves, "y")).toEqual([
      { id: "a", sortOrder: 11, group: reves },
      { id: "y", sortOrder: 12 },
    ]);
  });

  it("mueve un objetivo a un grupo vacío conservando su posición", () => {
    const naranja = { ball: "naranja", aspect: "tactico", block: "Peloteo" };
    expect(planPlace(items, "b", naranja, null)).toEqual([
      { id: "b", sortOrder: 2, group: naranja },
    ]);
  });

  it("numera seguido si el grupo tenía posiciones repetidas", () => {
    const dup = [item("a", 5), item("b", 5), item("c", 5)];
    // "c" ya tiene la 5: solo cambian los demás.
    expect(planPlace(dup, "c", derecha, "a")).toEqual([
      { id: "a", sortOrder: 6 },
      { id: "b", sortOrder: 7 },
    ]);
  });
});

describe("resolveObjectives con grupo movido", () => {
  it("aplica bola, aspecto y bloque del ajuste y lo marca como editado", () => {
    const [res] = resolveObjectives(
      [
        {
          id: "a",
          code: "a",
          ball: "roja",
          aspect: "tecnico",
          block: "Derecha",
          title: "A",
          criterion: null,
          source: "desglose",
          sortOrder: 1,
          isActive: true,
          isFinal: false,
          clubId: null,
          coachId: null,
          studentId: null,
        },
      ],
      [
        {
          objectiveId: "a",
          clubId: "club",
          coachId: null,
          studentId: null,
          hidden: null,
          title: null,
          criterion: null,
          sortOrder: 4,
          ball: "naranja",
          aspect: "tactico",
          block: "Peloteo",
        },
      ],
      new Map(),
      { studentId: null, clubId: "club", coachId: "coach" }
    );
    expect(res).toMatchObject({
      ball: "naranja",
      aspect: "tactico",
      block: "Peloteo",
      sortOrder: 4,
      overriddenAt: ["club"],
    });
  });
});
