import { describe, expect, it } from "vitest";
import {
  availabilityGrid,
  bookingDays,
  isPlaceFree,
  isValidFullName,
  localDateOf,
  localToUtc,
  type BookablePlace,
} from "@/lib/bookings/availability";

describe("hora de Canarias", () => {
  it("convierte hora local a UTC en invierno (UTC+0) y verano (UTC+1)", () => {
    expect(localToUtc("2026-11-09", 17 * 60).toISOString()).toBe(
      "2026-11-09T17:00:00.000Z"
    );
    expect(localToUtc("2026-07-15", 17 * 60).toISOString()).toBe(
      "2026-07-15T16:00:00.000Z"
    );
  });

  it("fecha local y días reservables", () => {
    expect(localDateOf(new Date("2026-07-15T23:30:00Z"))).toBe("2026-07-16");
    expect(bookingDays(new Date("2026-11-09T12:00:00Z"), 3)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
    ]);
  });
});

describe("disponibilidad de pistas", () => {
  const now = new Date("2026-11-09T09:00:00Z");
  const pista1: BookablePlace = {
    id: "p1",
    name: "Pista 1",
    openMinute: 8 * 60,
    closeMinute: 22 * 60,
    // Sesión 17:00-18:30
    busy: [
      {
        start: new Date("2026-11-09T17:00:00Z"),
        end: new Date("2026-11-09T18:30:00Z"),
      },
    ],
  };
  const pista2: BookablePlace = {
    ...pista1,
    id: "p2",
    name: "Pista 2",
    busy: [],
  };

  it("una sesión ocupa la pista y no deja reservar encima", () => {
    expect(isPlaceFree(pista1, "2026-11-09", 16 * 60, 60, now)).toBe(true);
    expect(isPlaceFree(pista1, "2026-11-09", 16 * 60 + 30, 60, now)).toBe(
      false
    );
    expect(isPlaceFree(pista1, "2026-11-09", 18 * 60, 60, now)).toBe(false);
    expect(isPlaceFree(pista1, "2026-11-09", 18 * 60 + 30, 90, now)).toBe(true);
  });

  it("respeta horario, horas pasadas y cierre", () => {
    expect(isPlaceFree(pista2, "2026-11-09", 7 * 60, 60, now)).toBe(false);
    expect(isPlaceFree(pista2, "2026-11-09", 8 * 60 + 30, 60, now)).toBe(false); // ya pasó
    expect(isPlaceFree(pista2, "2026-11-09", 21 * 60, 90, now)).toBe(false); // acaba 22:30
    expect(isPlaceFree(pista2, "2026-11-09", 20 * 60 + 30, 90, now)).toBe(true);
  });

  it("la rejilla marca libre si alguna pista lo está", () => {
    const grid = availabilityGrid([pista1, pista2], "2026-11-09", 60, now);
    const at17 = grid.find((r) => r.label === "17:00")!;
    expect(at17.freePlaceIds).toEqual(["p2"]);
    const onlyP1 = availabilityGrid([pista1], "2026-11-09", 60, now);
    expect(onlyP1.find((r) => r.label === "17:00")!.freePlaceIds).toEqual([]);
    expect(grid[0].label).toBe("08:00");
    expect(grid.at(-1)!.label).toBe("21:00");
  });

  it("pide nombre y apellidos", () => {
    expect(isValidFullName("Ana")).toBe(false);
    expect(isValidFullName("Ana López")).toBe(true);
    expect(isValidFullName("  José María  Pérez ")).toBe(true);
    expect(isValidFullName("1 2")).toBe(false);
  });
});
