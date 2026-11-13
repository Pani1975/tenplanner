import { describe, expect, it } from "vitest";
import {
  applyChoices,
  buildChoicePrompt,
  collectActivities,
  type Candidate,
} from "@/lib/import/choose-exercises";
import type { ImportedClass, ImportedClassItem } from "@/lib/import/schema";

function item(title: string, freeText = title): ImportedClassItem {
  return {
    kind: "text",
    title,
    freeText,
    durationMinutes: 10,
    searchTerms: title.toLowerCase(),
    exerciseId: null,
    suggestions: [],
    tags: { golpes: ["derecha"], aspecto: "tecnica", tipo: "peloteo" },
    reason: null,
  };
}

const cand = (id: string, name: string): Candidate => ({
  id,
  name,
  description: `Descripción de ${name}`,
  durationMinutes: 10,
  golpes: ["derecha"],
  niveles: ["desarrollo"],
});

function setup() {
  const a = item("Peloteo cruzado", "Peloteo en dirección cruzada");
  const b = item("Juego divertido");
  const rest = item("Descanso");
  const cls: ImportedClass = {
    name: "C",
    duracionMinutes: 60,
    alumnosTipo: null,
    numAlumnos: null,
    objetivos: null,
    material: null,
    aspectosImportantes: null,
    niveles: ["desarrollo"],
    aspectosJuego: null,
    golpes: null,
    autoria: "libre",
    status: "draft",
    blocks: [{ orderIndex: 2, title: null, notes: null, items: [a, b, rest] }],
  };
  const pool = new Map<ImportedClassItem, Candidate[]>([
    [a, [cand("x1", "Peloteo clásico paralelo"), cand("x2", "Peloteo clásico cruzado")]],
    [b, [cand("y1", "Bolos con la raqueta")]],
  ]);
  const activities = collectActivities([cls], (it) => pool.get(it) ?? []);
  return { a, b, rest, activities };
}

describe("collectActivities", () => {
  it("solo actividades con candidatos, con referencia a0, a1…", () => {
    const { activities } = setup();
    expect(activities.map((x) => x.ref)).toEqual(["a0", "a1"]);
  });
});

describe("buildChoicePrompt", () => {
  it("incluye la descripción del monitor y candidatos e1, e2…", () => {
    const { activities } = setup();
    const p = buildChoicePrompt(activities, ["desarrollo"]);
    expect(p).toContain("Nivel del grupo: desarrollo");
    expect(p).toContain("Descripción del monitor: Peloteo en dirección cruzada");
    expect(p).toContain("- e2: Peloteo clásico cruzado");
    expect(p).not.toContain("Descanso");
  });
});

describe("applyChoices", () => {
  it("aplica la elección, pone el elegido primero y guarda el motivo", () => {
    const { a, b, activities } = setup();
    const n = applyChoices(activities, {
      choices: [
        { activity: "a0", exercise: "e2", reason: "Es peloteo cruzado" },
        { activity: "a1", exercise: null, reason: null },
      ],
    });
    expect(n).toBe(1);
    expect(a.exerciseId).toBe("x2");
    expect(a.reason).toBe("Es peloteo cruzado");
    expect(a.suggestions[0].id).toBe("x2");
    expect(b.exerciseId).toBeNull();
    expect(b.suggestions.map((s) => s.id)).toEqual(["y1"]);
  });

  it("ignora referencias inventadas o de otra actividad", () => {
    const { a, b, activities } = setup();
    const n = applyChoices(activities, {
      choices: [
        { activity: "a0", exercise: "e9", reason: "x" },
        { activity: "a1", exercise: "x2", reason: "uuid directo" },
        { activity: "a7", exercise: "e1", reason: "no existe" },
      ],
    });
    expect(n).toBe(0);
    expect(a.exerciseId).toBeNull();
    expect(b.exerciseId).toBeNull();
  });
});
