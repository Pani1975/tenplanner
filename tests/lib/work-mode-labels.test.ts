import { describe, expect, it } from "vitest";
import {
  libraryHeading,
  personalTitle,
  spaceTitle,
  type WorkMode,
} from "@/lib/work-mode-labels";

const club: WorkMode = {
  kind: "club",
  clubId: "c1",
  clubName: "CT Tenerife",
};
const particular: WorkMode = {
  kind: "particular",
  ownerName: "David Paniagua",
};
const tp: WorkMode = { kind: "tenplanner", ownerName: "David Paniagua" };

describe("cabeceras con el dueño del espacio", () => {
  it("nombra el club, el monitor o Ten Planner", () => {
    expect(spaceTitle("Ejercicios", club)).toBe("Ejercicios CT Tenerife");
    expect(spaceTitle("Ejercicios", particular)).toBe("Ejercicios de David");
    expect(spaceTitle("Objetivos", tp)).toBe("Objetivos Ten Planner");
  });

  it("la Biblioteca pública siempre es de Ten Planner", () => {
    expect(libraryHeading("Clases", club, true).title).toBe(
      "Clases Ten Planner"
    );
    expect(libraryHeading("Clases", null, false).title).toBe(
      "Clases Ten Planner"
    );
    expect(libraryHeading("Clases", club, false).title).toBe(
      "Clases CT Tenerife"
    );
  });

  it("los datos propios en Modo Ten Planner son del monitor", () => {
    expect(personalTitle("Alumnos", tp)).toBe("Alumnos de David");
    expect(personalTitle("Alumnos", club)).toBe("Alumnos CT Tenerife");
  });
});
