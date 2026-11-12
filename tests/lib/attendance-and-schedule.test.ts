import { describe, expect, it } from "vitest";
import { nextScheduleOccurrenceInZone } from "@/lib/groups/schedule";
import { effectiveAttended } from "@/lib/sessions/attendance";

describe("effectiveAttended", () => {
  it("un 'no viene' solo es falta si la sesión se completó", () => {
    expect(effectiveAttended(false, "scheduled")).toBeNull();
    expect(effectiveAttended(false, "cancelled")).toBeNull();
    expect(effectiveAttended(false, "completed")).toBe(false);
  });

  it("las presencias y lo no anotado no cambian", () => {
    expect(effectiveAttended(true, "scheduled")).toBe(true);
    expect(effectiveAttended(true, "completed")).toBe(true);
    expect(effectiveAttended(null, "completed")).toBeNull();
  });
});

describe("nextScheduleOccurrenceInZone", () => {
  // Lunes 18:00 en Madrid.
  const schedule = [{ weekday: 1, time: "18:00" }];

  it("interpreta la hora en Madrid (invierno, UTC+1)", () => {
    // Miércoles 12/11/2026 10:00 UTC → próximo lunes 16/11 18:00 Madrid = 17:00 UTC.
    const at = nextScheduleOccurrenceInZone(
      schedule,
      new Date("2026-11-12T10:00:00Z")
    );
    expect(at?.toISOString()).toBe("2026-11-16T17:00:00.000Z");
  });

  it("interpreta la hora en Madrid (verano, UTC+2)", () => {
    const at = nextScheduleOccurrenceInZone(
      schedule,
      new Date("2026-06-10T10:00:00Z")
    );
    expect(at?.toISOString()).toBe("2026-06-15T16:00:00.000Z");
  });

  it("una clase empezada hace menos del margen sigue siendo la próxima", () => {
    // Lunes 16/11 17:30 UTC = 18:30 Madrid; empezó hace 30 min.
    const now = new Date("2026-11-16T17:30:00Z");
    expect(
      nextScheduleOccurrenceInZone(
        schedule,
        now,
        "Europe/Madrid",
        60
      )?.toISOString()
    ).toBe("2026-11-16T17:00:00.000Z");
    expect(
      nextScheduleOccurrenceInZone(
        schedule,
        now,
        "Europe/Madrid",
        0
      )?.toISOString()
    ).toBe("2026-11-23T17:00:00.000Z");
  });

  it("sin horario devuelve null", () => {
    expect(nextScheduleOccurrenceInZone(null)).toBeNull();
  });
});
