import { describe, expect, it } from "vitest";
import {
  tournamentDayRanges,
  tournamentDays,
  tournamentHoursSchema,
  tournamentIntervals,
} from "@/lib/tournaments/hours";

describe("horario del torneo en pistas", () => {
  it("lista los días del torneo", () => {
    expect(tournamentDays("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(tournamentDays("2026-12-30", null)).toEqual(["2026-12-30"]);
  });

  it("todo el día ocupa de 00:00 a 24:00 en hora de España", () => {
    const [i] = tournamentIntervals({ startDate: "2026-12-10", playHours: null });
    expect(i.start.toISOString()).toBe("2026-12-09T23:00:00.000Z");
    expect(i.end.toISOString()).toBe("2026-12-10T23:00:00.000Z");
  });

  it("mismo horario cada día", () => {
    const r = tournamentDayRanges({
      startDate: "2026-12-10",
      endDate: "2026-12-11",
      playHours: { mode: "daily", start: 600, end: 840 },
    });
    expect(r).toEqual([
      { date: "2026-12-10", start: 600, end: 840 },
      { date: "2026-12-11", start: 600, end: 840 },
    ]);
  });

  it("por días: un día sin horario no ocupa las pistas", () => {
    const r = tournamentDayRanges({
      startDate: "2026-12-10",
      endDate: "2026-12-12",
      playHours: {
        mode: "by_day",
        days: [
          { date: "2026-12-10", start: 960, end: 1260 },
          { date: "2026-12-12", start: 540, end: 840 },
          { date: "2026-12-20", start: 540, end: 840 },
        ],
      },
    });
    expect(r.map((d) => d.date)).toEqual(["2026-12-10", "2026-12-12"]);
  });

  it("Canarias va una hora por detrás", () => {
    const [i] = tournamentIntervals({
      startDate: "2026-12-10",
      playHours: { mode: "daily", start: 600, end: 720 },
      timeZone: "Atlantic/Canary",
    });
    expect(i.start.toISOString()).toBe("2026-12-10T10:00:00.000Z");
  });

  it("rechaza un horario que acaba antes de empezar", () => {
    expect(
      tournamentHoursSchema.safeParse({ mode: "daily", start: 900, end: 600 })
        .success
    ).toBe(false);
  });
});
