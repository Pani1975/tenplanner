import { describe, expect, it } from "vitest";
import { splitAssignable } from "@/lib/club-coaches";

describe("splitAssignable", () => {
  const allowed = ["a", "b", "c"];

  it("acepta los monitores del club", () => {
    expect(splitAssignable(["a", "c"], allowed)).toEqual({
      valid: ["a", "c"],
      invalid: [],
    });
  });

  it("marca como no válidos los que no son del club", () => {
    expect(splitAssignable(["a", "x"], allowed)).toEqual({
      valid: ["a"],
      invalid: ["x"],
    });
  });

  it("quita duplicados y conserva el orden pedido", () => {
    expect(splitAssignable(["c", "a", "c", "a"], allowed)).toEqual({
      valid: ["c", "a"],
      invalid: [],
    });
  });

  it("una lista vacía quita todas las asignaciones", () => {
    expect(splitAssignable([], allowed)).toEqual({ valid: [], invalid: [] });
  });

  it("sin monitores en el club nada es asignable", () => {
    expect(splitAssignable(["a"], [])).toEqual({
      valid: [],
      invalid: ["a"],
    });
  });
});
