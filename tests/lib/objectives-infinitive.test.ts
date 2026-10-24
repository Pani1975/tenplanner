import { describe, expect, it } from "vitest";

import { objectiveToInfinitive } from "@/lib/objectives-infinitive";
import { objectiveLines, textHasObjective } from "@/lib/objectives-text";

describe("objectiveToInfinitive", () => {
  it.each([
    [
      "Abre ángulos con golpes cruzados cortos",
      "Abrir ángulos con golpes cruzados cortos",
    ],
    [
      "Saque: aprovecha el impulso del tren inferior contra el suelo",
      "Saque: aprovechar el impulso del tren inferior contra el suelo",
    ],
    [
      "Remate: se coloca de lado con la raqueta atrás",
      "Remate: colocarse de lado con la raqueta atrás",
    ],
    [
      "Consolida su patrón de juego y lo usa en los puntos importantes",
      "Consolidar su patrón de juego y usarlo en los puntos importantes",
    ],
    [
      "Defiende y neutraliza cuando pierde la ventaja",
      "Defender y neutralizar cuando pierde la ventaja",
    ],
    [
      "Gestiona la frustración tras fallar (respira, reintenta)",
      "Gestionar la frustración tras fallar (respirar, reintentar)",
    ],
  ])("%s", (present, inf) => {
    expect(objectiveToInfinitive(present)).toBe(inf);
  });
});

describe("objectiveLines con clases en una línea", () => {
  it("separa '1) … . 2) … .'", () => {
    expect(
      objectiveLines("1) Abrir ángulos con golpes. 2) Cerrar jugadas.")
    ).toEqual(["Abrir ángulos con golpes.", "Cerrar jugadas."]);
  });
  it("detecta un objetivo en infinitivo ya escrito", () => {
    expect(
      textHasObjective("1) Abrir ángulos. 2) Cerrar jugadas.", "Cerrar jugadas")
    ).toBe(true);
  });
});
