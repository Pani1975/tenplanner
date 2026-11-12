import { describe, expect, it } from "vitest";
import {
  addMinutesToTime,
  formatScheduleTimes,
  isValidScheduleEntry,
  scheduleEntryMinutes,
  scheduleMinutesForDate,
} from "@/lib/groups/schedule";
import {
  scheduleEntrySchema,
  weeklyScheduleSchema,
} from "@/lib/groups/schedule-schema";

describe("hora de finalización del horario", () => {
  it("calcula la duración y la muestra como intervalo", () => {
    expect(scheduleEntryMinutes({ time: "17:00", endTime: "18:30" })).toBe(90);
    expect(scheduleEntryMinutes({ time: "17:00" })).toBeNull();
    expect(formatScheduleTimes({ time: "17:00", endTime: "18:30" })).toBe(
      "17:00–18:30"
    );
    expect(formatScheduleTimes({ time: "17:00" })).toBe("17:00");
  });

  it("suma minutos sin salirse del día", () => {
    expect(addMinutesToTime("17:00", 60)).toBe("18:00");
    expect(addMinutesToTime("23:30", 90)).toBe("23:59");
  });

  it("acepta horarios antiguos sin hora de fin, pero no fin <= inicio", () => {
    expect(isValidScheduleEntry({ weekday: 2, time: "17:00" })).toBe(true);
    expect(
      isValidScheduleEntry({ weekday: 2, time: "17:00", endTime: "18:00" })
    ).toBe(true);
    expect(
      isValidScheduleEntry({ weekday: 2, time: "17:00", endTime: "17:00" })
    ).toBe(false);
    expect(
      isValidScheduleEntry({ weekday: 2, time: "17:00", endTime: "16:00" })
    ).toBe(false);
  });

  it("la API exige hora de fin posterior a la de inicio, y al menos un día", () => {
    expect(
      scheduleEntrySchema.safeParse({ weekday: 1, time: "17:00" }).success
    ).toBe(false);
    expect(
      scheduleEntrySchema.safeParse({
        weekday: 1,
        time: "18:00",
        endTime: "17:00",
      }).success
    ).toBe(false);
    expect(weeklyScheduleSchema.safeParse([]).success).toBe(false);
    expect(
      weeklyScheduleSchema.safeParse([
        { weekday: 1, time: "17:00", endTime: "18:00" },
        { weekday: 1, time: "19:00", endTime: "20:00" },
      ]).success
    ).toBe(false);
    expect(
      weeklyScheduleSchema.safeParse([
        { weekday: 1, time: "17:00", endTime: "18:30" },
        { weekday: 3, time: "19:00", endTime: "20:00" },
      ]).success
    ).toBe(true);
  });

  it("la duración de una fecha sale del día de la semana del horario", () => {
    const schedule = [
      { weekday: 2, time: "17:00", endTime: "18:30" }, // martes
      { weekday: 4, time: "10:00" }, // jueves, sin fin
    ];
    // Martes 17 de noviembre de 2026, 17:00 en Madrid (16:00 UTC).
    expect(
      scheduleMinutesForDate(schedule, new Date("2026-11-17T16:00:00Z"))
    ).toBe(90);
    // Jueves: está en el horario pero sin hora de fin.
    expect(
      scheduleMinutesForDate(schedule, new Date("2026-11-19T09:00:00Z"))
    ).toBeNull();
    // Miércoles: no hay clase fija.
    expect(
      scheduleMinutesForDate(schedule, new Date("2026-11-18T16:00:00Z"))
    ).toBeNull();
  });
});
