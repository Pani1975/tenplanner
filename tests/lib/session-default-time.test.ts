import { describe, expect, it } from "vitest";
import { defaultScheduledAt } from "@/components/app/session-wizard/defaults";

// Fechas en hora local, igual que las usa el asistente.
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min);

describe("defaultScheduledAt", () => {
  it("propone la próxima hora en punto dentro del horario de club", () => {
    expect(defaultScheduledAt(at(2026, 11, 9, 10, 25))).toBe(
      "2026-11-09T11:00"
    );
  });

  it("de madrugada propone las 17:00 de ese día, no la 01:00", () => {
    expect(defaultScheduledAt(at(2026, 11, 9, 0, 49))).toBe("2026-11-09T17:00");
  });

  it("por la noche propone las 17:00 del día siguiente", () => {
    expect(defaultScheduledAt(at(2026, 11, 9, 22, 10))).toBe(
      "2026-11-10T17:00"
    );
    expect(defaultScheduledAt(at(2026, 11, 9, 23, 30))).toBe(
      "2026-11-10T17:00"
    );
  });

  it("a las 20:xx aún propone las 21:00", () => {
    expect(defaultScheduledAt(at(2026, 11, 9, 20, 5))).toBe("2026-11-09T21:00");
  });
});
