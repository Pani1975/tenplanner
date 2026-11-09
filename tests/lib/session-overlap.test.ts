import { describe, expect, it } from "vitest";
import { findOverlaps, slotsOverlap } from "@/lib/sessions/overlap";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 9, h, m));

describe("choques de horario en la misma pista", () => {
  it("detecta solapes y no cuenta las que se tocan", () => {
    const a = { start: at(17), durationMinutes: 90 }; // 17:00-18:30
    expect(slotsOverlap(a, { start: at(18), durationMinutes: 60 })).toBe(true);
    expect(slotsOverlap(a, { start: at(16), durationMinutes: 61 })).toBe(true);
    expect(slotsOverlap(a, { start: at(18, 30), durationMinutes: 60 })).toBe(
      false
    );
    expect(slotsOverlap(a, { start: at(16), durationMinutes: 60 })).toBe(false);
  });

  it("ignora la propia sesión al editarla y no repite resultados", () => {
    const existing = [
      { id: "x", title: "Propia", start: at(17), durationMinutes: 60 },
      { id: "y", title: "Otra", start: at(17, 30), durationMinutes: 60 },
      { id: "z", title: "Lejos", start: at(20), durationMinutes: 60 },
    ];
    const slots = [
      { start: at(17), durationMinutes: 60 },
      { start: at(17, 15), durationMinutes: 60 },
    ];
    expect(findOverlaps(slots, existing, "x").map((s) => s.id)).toEqual(["y"]);
  });
});
