import { describe, expect, it } from "vitest";
import {
  appendObjectiveLines,
  objectiveLines,
  textHasObjective,
} from "@/lib/objectives-text";

describe("appendObjectiveLines", () => {
  it("añade una línea por objetivo a un texto vacío", () => {
    expect(appendObjectiveLines("", ["Sacar por arriba", "Volear"])).toBe(
      "Sacar por arriba\nVolear"
    );
  });

  it("mantiene lo escrito y añade al final", () => {
    expect(appendObjectiveLines("Mi objetivo libre", ["Volear"])).toBe(
      "Mi objetivo libre\nVolear"
    );
  });

  it("no repite objetivos ya escritos (sin distinguir tildes ni numeración)", () => {
    const text = "1) Peloteo cruzado\n2) Volea";
    expect(
      appendObjectiveLines(text, ["peloteo cruzado", "Remate"], {
        numbered: true,
      })
    ).toBe("1) Peloteo cruzado\n2) Volea\n3) Remate");
  });

  it("continúa la numeración escrita en una sola línea", () => {
    expect(
      appendObjectiveLines("1) preparar 2) terminar", ["Recuperar"], {
        numbered: true,
      })
    ).toBe("1) preparar 2) terminar\n3) Recuperar");
  });

  it("devuelve el texto igual si no hay nada nuevo", () => {
    expect(appendObjectiveLines("Volea", ["volea."])).toBe("Volea");
  });
});

describe("objectiveLines / textHasObjective", () => {
  it("quita viñetas y numeración", () => {
    expect(objectiveLines("- a\n• b\n3) c\n\n")).toEqual(["a", "b", "c"]);
  });

  it("detecta un objetivo ya incluido", () => {
    expect(textHasObjective("1) Saque dentro", "saque dentro")).toBe(true);
    expect(textHasObjective("1) Saque dentro", "Resto")).toBe(false);
  });
});
