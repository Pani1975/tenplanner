import { describe, expect, it } from "vitest";
import { createExerciseSchema } from "@/app/api/exercises/validation";
import {
  IMPORT_MAX_CHARS,
  keepCatalog,
  levelCodesForSport,
  sanitizeClass,
  sanitizeExercise,
  validateImportText,
  type AiClass,
  type AiExercise,
} from "@/lib/import/schema";
import type { SkillLevel } from "@/lib/skill-levels";

const levels: SkillLevel[] = [
  { code: "descubrimiento", sport: "tenis", track: "base", position: 2, labelEs: "D" },
  { code: "desarrollo", sport: "tenis", track: "base", position: 3, labelEs: "D" },
  { code: "iniciacion", sport: "padel", track: "base", position: 1, labelEs: "I" },
];
const ctx = {
  levelCodes: levelCodesForSport(levels, "tenis", true),
  newId: () => "id",
};

describe("keepCatalog", () => {
  it("normaliza, descarta lo desconocido y no repite", () => {
    expect(
      keepCatalog(["Derecha", " REVÉS ", "derecha", "bandeja_falsa", "volea"], [
        "derecha",
        "reves",
        "volea",
      ])
    ).toEqual(["derecha", "reves", "volea"]);
  });
});

describe("levelCodesForSport", () => {
  it("usa solo la escala del deporte", () => {
    expect(levelCodesForSport(levels, "tenis", true)).toEqual([
      "descubrimiento",
      "desarrollo",
    ]);
    expect(levelCodesForSport(levels, "padel", false)).toEqual(["iniciacion"]);
  });
});

describe("sanitizeExercise", () => {
  const raw: AiExercise = {
    name: "  Derecha cruzada  ",
    description: "Peloteo cruzado",
    durationMinutes: 12,
    golpes: ["Derecha", "inventado"],
    niveles: ["desarrollo", "nivel_falso"],
    aspectoJuego: "tecnica",
    tiposActividad: ["peloteo", "otro"],
    steps: [{ title: "Paso 1", description: "x" }, { title: "", description: "y" }],
    materials: ["Pelotas", ""],
    parametros: ["altura", "color"],
    numJugadores: 40,
  };

  it("deja solo códigos del catálogo y rellena lo derivable", () => {
    const e = sanitizeExercise(raw, ctx)!;
    expect(e.name).toBe("Derecha cruzada");
    expect(e.golpes).toEqual(["derecha"]);
    expect(e.niveles).toEqual(["desarrollo"]);
    expect(e.tiposActividad).toEqual(["peloteo"]);
    expect(e.parametros).toEqual(["altura"]);
    expect(e.category).toBe("technique");
    expect(e.duracionRango).toBe("10-15");
    expect(e.steps).toHaveLength(1);
    expect(e.materials).toEqual(["Pelotas"]);
    expect(e.numJugadores).toBeNull();
  });

  it("rechaza un ejercicio sin nombre", () => {
    expect(sanitizeExercise({ ...raw, name: "  " }, ctx)).toBeNull();
  });

  it("el resultado pasa el esquema de creación de ejercicios", () => {
    const e = sanitizeExercise(raw, ctx)!;
    const { steps, images, formMode, ...rest } = e;
    void images;
    void formMode;
    const parsed = createExerciseSchema.safeParse({
      ...rest,
      steps: steps.map((s) => ({ title: s.title, description: s.description })),
    });
    expect(parsed.success).toBe(true);
  });

  it("un nivel de otro deporte se descarta", () => {
    const e = sanitizeExercise({ ...raw, niveles: ["iniciacion"] }, ctx)!;
    expect(e.niveles).toEqual([]);
  });
});

describe("sanitizeClass", () => {
  const raw: AiClass = {
    name: "Clase de volea",
    alumnosTipo: "Grupal",
    niveles: ["descubrimiento", "x"],
    golpes: ["volea", "zzz"],
    blocks: [
      { title: "Calentamiento", items: [{ title: "Trote", description: "5 min", durationMinutes: 5 }] },
      { title: "Principal", items: [{ title: "Volea", description: "", durationMinutes: 30 }] },
      { title: "Final", items: [] },
      { title: "Extra", items: [{ title: "Estiramientos", durationMinutes: 10 }] },
    ],
  };

  it("máximo 3 bloques, borrador y duración sumada", () => {
    const c = sanitizeClass(raw, ctx)!;
    expect(c.status).toBe("draft");
    expect(c.blocks.map((b) => b.orderIndex)).toEqual([1, 2, 3]);
    expect(c.blocks[2].items).toHaveLength(1);
    expect(c.duracionMinutes).toBe(45);
    expect(c.alumnosTipo).toBe("grupal");
    expect(c.niveles).toEqual(["descubrimiento"]);
    expect(c.golpes).toEqual(["volea"]);
    expect(c.blocks[1].items[0].freeText).toBe("Volea");
  });

  it("sin duración ni actividades usa 60 minutos", () => {
    expect(sanitizeClass({ name: "X" }, ctx)!.duracionMinutes).toBe(60);
  });
});

describe("validateImportText", () => {
  it("valida vacío, corto y demasiado largo", () => {
    expect(validateImportText("").ok).toBe(false);
    expect(validateImportText("hola").ok).toBe(false);
    expect(validateImportText("a".repeat(IMPORT_MAX_CHARS + 1)).ok).toBe(false);
    expect(validateImportText("Ejercicio de derecha cruzada 10 min").ok).toBe(true);
  });
});
