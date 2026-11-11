import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NIVELES, NIVEL_LEGACY, PADEL_NIVELES } from "@/lib/exercise-taxonomy";
import {
  isLevelOfSport,
  scaleSportFor,
  skillLevelsForSport,
  type SkillLevel,
} from "@/lib/skill-levels";

// Filas que siembra la migración 0094, leídas del propio archivo SQL para
// que este test falle si el código y la escalera de la base se separan.
function seededLevels(): SkillLevel[] {
  const sql = readFileSync(
    join(process.cwd(), "db/migrations/0094_skill_levels.sql"),
    "utf8"
  );
  const rows = [
    ...sql.matchAll(
      /\('([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z_]+)',\s*(\d+),\s*'([^']+)'\)/g
    ),
  ];
  return rows.map(([, code, sport, track, position, labelEs]) => ({
    code,
    sport: sport as SkillLevel["sport"],
    track,
    position: Number(position),
    labelEs,
  }));
}

const levels = seededLevels();

describe("escalera sembrada en la migración 0094", () => {
  it("tiene la escalera base de tenis en orden 1..8", () => {
    const base = levels
      .filter((l) => l.sport === "tenis" && l.track === "base")
      .sort((a, b) => a.position - b.position)
      .map((l) => l.code);
    expect(base).toEqual([
      "familiarizacion",
      "descubrimiento",
      "desarrollo",
      "consolidacion",
      "especializacion",
      "precompeticion",
      "competicion",
      "rendimiento",
    ]);
  });

  it("incluye todos los niveles que ofrece la app", () => {
    const codes = new Set(levels.map((l) => l.code));
    for (const n of [...NIVELES, ...NIVEL_LEGACY, ...PADEL_NIVELES]) {
      expect(codes, n.id).toContain(n.id);
    }
  });

  it("no repite posición dentro de un deporte y vía", () => {
    const keys = levels.map((l) => `${l.sport}/${l.track}/${l.position}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("skillLevelsForSport", () => {
  it("pádel usa su propia escala", () => {
    expect(skillLevelsForSport(levels, "padel").map((l) => l.code)).toEqual([
      "iniciacion",
      "medio",
      "avanzado",
    ]);
  });

  it("pickleball y tenis playa usan la de tenis, base antes que adultos", () => {
    for (const sport of ["tenis", "pickleball", "tenis_playa", null]) {
      const codes = skillLevelsForSport(levels, sport).map((l) => l.code);
      expect(codes[0]).toBe("familiarizacion");
      expect(codes.slice(-2)).toEqual([
        "adultos_iniciacion",
        "adultos_medio_alto",
      ]);
      expect(codes).not.toContain("medio");
    }
  });
});

describe("isLevelOfSport", () => {
  it("acepta solo niveles de la escala del deporte", () => {
    expect(isLevelOfSport(levels, "desarrollo", "tenis")).toBe(true);
    expect(isLevelOfSport(levels, "desarrollo", "pickleball")).toBe(true);
    expect(isLevelOfSport(levels, "desarrollo", "padel")).toBe(false);
    expect(isLevelOfSport(levels, "medio", "padel")).toBe(true);
    expect(isLevelOfSport(levels, "intermediate", "tenis")).toBe(false);
  });

  it("scaleSportFor agrupa los deportes por escala", () => {
    expect(scaleSportFor("padel")).toBe("padel");
    expect(scaleSportFor("tenis_playa")).toBe("tenis");
    expect(scaleSportFor(undefined)).toBe("tenis");
  });
});
