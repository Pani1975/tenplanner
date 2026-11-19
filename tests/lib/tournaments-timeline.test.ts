import { describe, expect, it } from "vitest";
import { timelineTab, todayInMadrid } from "@/lib/tournaments/timeline";

const today = "2026-11-19";

describe("timelineTab", () => {
  it("por estado: finalizado es pasado y en curso es actual", () => {
    expect(
      timelineTab(
        { status: "finished", startDate: "2027-01-01", endDate: null },
        today
      )
    ).toBe("past");
    expect(
      timelineTab(
        { status: "in_progress", startDate: "2027-01-01", endDate: null },
        today
      )
    ).toBe("current");
  });

  it("por fechas cuando aún no ha empezado", () => {
    expect(
      timelineTab(
        { status: "open", startDate: "2026-12-20", endDate: null },
        today
      )
    ).toBe("upcoming");
    expect(
      timelineTab(
        { status: "closed", startDate: "2026-11-18", endDate: "2026-11-20" },
        today
      )
    ).toBe("current");
    expect(
      timelineTab(
        { status: "closed", startDate: "2026-11-19", endDate: null },
        today
      )
    ).toBe("current");
    expect(
      timelineTab(
        { status: "open", startDate: "2026-11-10", endDate: "2026-11-12" },
        today
      )
    ).toBe("past");
  });
});

describe("todayInMadrid", () => {
  it("usa la hora de España (pasada la medianoche allí, ya es el día siguiente)", () => {
    expect(todayInMadrid(new Date("2026-11-19T23:30:00Z"))).toBe("2026-11-20");
    expect(todayInMadrid(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
  });
});
