import { describe, expect, it } from "vitest";
import {
  madridParts,
  madridToIso,
  scheduleByDay,
  scheduleClashes,
} from "@/lib/tournaments/schedule";
import { canArchive } from "@/lib/tournaments/schedule-server";

describe("hora de España", () => {
  it("invierno (UTC+1) y verano (UTC+2)", () => {
    expect(madridToIso("2026-12-20", "10:30")).toBe("2026-12-20T09:30:00.000Z");
    expect(madridToIso("2026-07-04", "18:00")).toBe("2026-07-04T16:00:00.000Z");
  });
  it("ida y vuelta, también el día del cambio de hora", () => {
    for (const [d, h] of [
      ["2026-03-29", "12:00"],
      ["2026-10-25", "09:15"],
      ["2027-01-01", "00:00"],
    ]) {
      expect(madridParts(new Date(madridToIso(d, h)))).toEqual({
        date: d,
        time: h,
      });
    }
  });
});

describe("scheduleByDay", () => {
  const m = (
    id: string,
    at: string | null,
    court: string | null,
    round = 1,
    position = 0
  ) => ({
    id,
    scheduledAt: at,
    courtLabel: court,
    round,
    position,
  });
  it("agrupa por día de España, ordena por hora y pista y omite sin hora", () => {
    const days = scheduleByDay([
      m("c", madridToIso("2026-12-20", "11:00"), "Pista 1"),
      m("b", madridToIso("2026-12-20", "10:00"), "Pista 10"),
      m("a", madridToIso("2026-12-20", "10:00"), "Pista 2"),
      m("z", null, "Pista 1"),
      // 00:30 en España del 21 es el 20 en UTC: debe ir al día 21.
      m("d", madridToIso("2026-12-21", "00:30"), null),
    ]);
    expect(days.map((d) => d.date)).toEqual(["2026-12-20", "2026-12-21"]);
    expect(days[0].items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(days[0].items[0].time).toBe("10:00");
    expect(days[1].items[0].time).toBe("00:30");
  });
  it("detecta misma pista a la misma hora", () => {
    const at = madridToIso("2026-12-20", "10:00");
    const c = scheduleClashes([
      m("a", at, "Pista 1"),
      m("b", at, " pista 1 "),
      m("c", at, "Pista 2"),
      m("d", at, null),
    ]);
    expect([...c].sort()).toEqual(["a", "b"]);
  });
});

describe("canArchive", () => {
  it("solo torneos terminados", () => {
    const today = "2026-11-19";
    expect(
      canArchive(
        { status: "finished", startDate: "2026-12-01", endDate: null },
        today
      )
    ).toBe(true);
    expect(
      canArchive(
        { status: "closed", startDate: "2026-11-01", endDate: "2026-11-02" },
        today
      )
    ).toBe(true);
    expect(
      canArchive(
        { status: "open", startDate: "2026-12-01", endDate: null },
        today
      )
    ).toBe(false);
    expect(
      canArchive(
        { status: "in_progress", startDate: "2026-11-01", endDate: null },
        today
      )
    ).toBe(false);
  });
});
