import { describe, expect, it } from "vitest";
import {
  computeSessionDates,
  defaultCourseEnd,
  MAX_RECURRING_SESSIONS,
  sessionCode,
} from "@/components/app/session-wizard/recurrence";

const base = {
  enabled: true,
  frequency: "weekly" as const,
  weeks: 4,
  weekdays: [] as number[],
};

describe("recurrence", () => {
  it("builds the session code AAMMDD_Grupo", () => {
    expect(sessionCode(new Date(2026, 8, 30, 17, 0), "Galácticas")).toBe(
      "260930_Galácticas"
    );
    expect(sessionCode(new Date(2027, 0, 4, 17, 0), "  ")).toBe("270104_SG");
  });

  it("proposes 30 June of the right year as end of course", () => {
    expect(defaultCourseEnd(new Date(2026, 8, 30))).toBe("2027-06-30");
    expect(defaultCourseEnd(new Date(2027, 1, 10))).toBe("2027-06-30");
  });

  it("creates every Monday until the end date, same time", () => {
    const first = new Date(2026, 9, 5, 17, 0); // lunes 5 oct 2026
    const { dates, truncated } = computeSessionDates(first, {
      ...base,
      mode: "until",
      until: "2027-06-30",
      weekdays: [1],
    });
    expect(truncated).toBe(false);
    expect(dates[0]).toEqual(first);
    expect(dates.every((d) => d.getDay() === 1)).toBe(true);
    expect(
      dates.every((d) => d.getHours() === 17 && d.getMinutes() === 0)
    ).toBe(true);
    // Del 5 oct 2026 al 28 jun 2027: 39 lunes.
    expect(dates).toHaveLength(39);
    expect(dates[dates.length - 1]).toEqual(new Date(2027, 5, 28, 17, 0));
  });

  it("supports several weekdays", () => {
    const first = new Date(2026, 9, 5, 17, 0); // lunes
    const { dates } = computeSessionDates(first, {
      ...base,
      mode: "until",
      until: "2026-10-18",
      weekdays: [1, 3], // lunes y miércoles
    });
    expect(dates.map((d) => d.getDate())).toEqual([5, 7, 12, 14]);
  });

  it("keeps the 'number of weeks' mode", () => {
    const first = new Date(2026, 9, 5, 17, 0);
    const { dates } = computeSessionDates(first, {
      ...base,
      weeks: 3,
      weekdays: [1],
    });
    expect(dates.map((d) => d.getDate())).toEqual([5, 12, 19]);
  });

  it("returns only the first date when not repeating", () => {
    const first = new Date(2026, 9, 5, 17, 0);
    expect(
      computeSessionDates(first, { ...base, enabled: false }).dates
    ).toEqual([first]);
  });

  it("caps the number of sessions", () => {
    const first = new Date(2026, 0, 1, 10, 0);
    const { dates, truncated } = computeSessionDates(first, {
      ...base,
      mode: "until",
      until: "2030-12-31",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    expect(dates).toHaveLength(MAX_RECURRING_SESSIONS);
    expect(truncated).toBe(true);
  });
});

describe("sessionCode: nombre automático", () => {
  const d = new Date(2026, 10, 17, 17, 0); // 17-nov-2026, hora local

  it("con grupo: año, mes, día y grupo", () => {
    expect(sessionCode(d, "Galácticas")).toBe("261117_Galácticas");
  });

  it("sin grupo (clase suelta): SG, y SG2, SG3… si hay más ese día", () => {
    expect(sessionCode(d, "")).toBe("261117_SG");
    expect(sessionCode(d, "  ", 1)).toBe("261117_SG");
    expect(sessionCode(d, "", 2)).toBe("261117_SG2");
    expect(sessionCode(d, "", 3)).toBe("261117_SG3");
  });

  it("el número solo cuenta sin grupo", () => {
    expect(sessionCode(d, "Galácticas", 4)).toBe("261117_Galácticas");
  });
});
