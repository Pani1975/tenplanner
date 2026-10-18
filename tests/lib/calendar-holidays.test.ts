import { describe, expect, it } from "vitest";
import { holidayAppliesTo } from "@/lib/calendar/holidays";
import { holidaySchema } from "@/lib/calendar/holiday-schema";

const navidad = {
  startDate: "2026-12-23",
  endDate: "2027-01-06",
  groupId: null,
};

describe("holidayAppliesTo", () => {
  it("incluye el primer y el último día del rango", () => {
    expect(holidayAppliesTo(navidad, "2026-12-23", "g1")).toBe(true);
    expect(holidayAppliesTo(navidad, "2027-01-06", "g1")).toBe(true);
  });
  it("no afecta fuera del rango", () => {
    expect(holidayAppliesTo(navidad, "2026-12-22", "g1")).toBe(false);
    expect(holidayAppliesTo(navidad, "2027-01-07", "g1")).toBe(false);
  });
  it("un festivo de todo el espacio afecta también a sesiones sin grupo", () => {
    expect(holidayAppliesTo(navidad, "2026-12-30", null)).toBe(true);
  });
  it("un festivo de grupo solo afecta a ese grupo", () => {
    const solo = { ...navidad, groupId: "g1" };
    expect(holidayAppliesTo(solo, "2026-12-30", "g1")).toBe(true);
    expect(holidayAppliesTo(solo, "2026-12-30", "g2")).toBe(false);
    expect(holidayAppliesTo(solo, "2026-12-30", null)).toBe(false);
  });
});

describe("holidaySchema", () => {
  it("rechaza un rango con la fecha final anterior a la inicial", () => {
    const r = holidaySchema.safeParse({
      title: "Puente",
      startDate: "2026-12-08",
      endDate: "2026-12-07",
    });
    expect(r.success).toBe(false);
  });
  it("acepta un festivo de un solo día", () => {
    const r = holidaySchema.safeParse({
      title: "Día de Canarias",
      startDate: "2027-05-30",
      endDate: "2027-05-30",
    });
    expect(r.success).toBe(true);
  });
});
