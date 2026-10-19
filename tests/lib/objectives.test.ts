import { describe, expect, it } from "vitest";
import { defaultBallForStudent } from "@/lib/objectives-taxonomy";

const today = new Date("2026-10-19T12:00:00Z");

describe("defaultBallForStudent", () => {
  it("usa el nivel si es una de las tres etapas", () => {
    expect(defaultBallForStudent("descubrimiento", null, today)).toBe("roja");
    expect(defaultBallForStudent("desarrollo", null, today)).toBe("naranja");
    expect(defaultBallForStudent("consolidacion", null, today)).toBe("verde");
  });
  it("el nivel manda sobre la edad", () => {
    expect(defaultBallForStudent("desarrollo", "2015-01-01", today)).toBe(
      "naranja"
    );
  });
  it("sin nivel de etapa usa la edad", () => {
    expect(defaultBallForStudent(null, "2021-03-01", today)).toBe("roja");
    expect(defaultBallForStudent("beginner", "2019-03-01", today)).toBe(
      "naranja"
    );
    expect(defaultBallForStudent(null, "2017-03-01", today)).toBe("verde");
  });
  it("cumple 6 y 8 años hoy cambia de bola", () => {
    expect(defaultBallForStudent(null, "2020-10-19", today)).toBe("naranja");
    expect(defaultBallForStudent(null, "2018-10-19", today)).toBe("verde");
    expect(defaultBallForStudent(null, "2020-10-20", today)).toBe("roja");
  });
  it("sin datos o fecha inválida → roja", () => {
    expect(defaultBallForStudent(null, null, today)).toBe("roja");
    expect(defaultBallForStudent(null, "no-es-fecha", today)).toBe("roja");
  });
});
