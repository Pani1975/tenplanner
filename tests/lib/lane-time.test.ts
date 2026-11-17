import { describe, expect, it } from "vitest";
import { blockStudentMinutes } from "@/lib/sessions/lane-time";

describe("blockStudentMinutes", () => {
  it("el ejemplo: 4 alumnos, peloteo por turnos de 5 min y saque 20 min → 5 + 15", () => {
    const r = blockStudentMinutes(
      [
        { label: "Peloteo", court: 1, minutes: 20, turnMinutes: 5 },
        { label: "Saque", court: 2, minutes: 20 },
      ],
      4
    );
    expect(r.blockMinutes).toBe(20);
    expect(r.perStudent).toEqual([
      { label: "Peloteo", minutes: 5, kind: "turno" },
      { label: "Saque", minutes: 15, kind: "resto" },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("de dos en dos: 4 alumnos, turnos de 10 min → 20 min", () => {
    const r = blockStudentMinutes(
      [
        { label: "Peloteo", court: 1, minutes: 20, turnMinutes: 10, turnSize: 2 },
        { label: "Saque", court: 2, minutes: 20 },
      ],
      4
    );
    expect(r.perStudent.map((p) => p.minutes)).toEqual([10, 10]);
    expect(r.warnings).toEqual([]);
  });

  it("varias actividades en la otra pista se reparten el resto", () => {
    const r = blockStudentMinutes(
      [
        { label: "Peloteo", court: 1, minutes: 30, turnMinutes: 5 },
        { label: "Cesta", court: 2, minutes: 10 },
        { label: "Volea", court: 2, minutes: 10 },
        { label: "Saque", court: 2, minutes: 10 },
      ],
      6
    );
    expect(r.perStudent.filter((p) => p.kind === "resto").map((p) => p.minutes)).toEqual([8.3, 8.3, 8.3]);
  });

  it("avisa si no caben o sobran minutos", () => {
    const corto = blockStudentMinutes(
      [
        { label: "Peloteo", court: 1, minutes: 15, turnMinutes: 5 },
        { label: "Saque", court: 2, minutes: 15 },
      ],
      4
    );
    expect(corto.warnings[0]).toContain("son 20 min y la actividad dura 15");
    const largo = blockStudentMinutes(
      [
        { label: "Peloteo", court: 1, minutes: 25, turnMinutes: 5 },
        { label: "Saque", court: 2, minutes: 25 },
      ],
      4
    );
    expect(largo.warnings[0]).toContain("sobran 5 min");
  });

  it("sin turnos no calcula nada", () => {
    const r = blockStudentMinutes(
      [
        { label: "A", court: 1, minutes: 10 },
        { label: "B", court: 2, minutes: 10 },
      ],
      4
    );
    expect(r.perStudent).toEqual([]);
    expect(r.blockMinutes).toBe(10);
  });
});
