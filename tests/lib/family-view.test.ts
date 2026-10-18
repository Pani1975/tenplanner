import { describe, expect, it } from "vitest";
import { ageFromBirthDate, attendanceSummary } from "@/lib/family-view";

describe("attendanceSummary", () => {
  it("sin datos no inventa un porcentaje", () => {
    expect(attendanceSummary([])).toEqual({
      present: 0,
      absent: 0,
      unrecorded: 0,
      rate: null,
    });
    expect(attendanceSummary([{ attended: null }]).rate).toBeNull();
  });
  it("calcula el % solo sobre las sesiones con asistencia anotada", () => {
    const s = attendanceSummary([
      { attended: true },
      { attended: true },
      { attended: false },
      { attended: null },
    ]);
    expect(s).toEqual({ present: 2, absent: 1, unrecorded: 1, rate: 67 });
  });
});

describe("ageFromBirthDate", () => {
  const today = new Date(2026, 9, 18); // 18 oct 2026
  it("cuenta los años cumplidos", () => {
    expect(ageFromBirthDate("2016-10-18", today)).toBe(10);
    expect(ageFromBirthDate("2016-10-19", today)).toBe(9);
  });
  it("sin fecha o con fecha futura devuelve null", () => {
    expect(ageFromBirthDate(null, today)).toBeNull();
    expect(ageFromBirthDate("2030-01-01", today)).toBeNull();
  });
});
