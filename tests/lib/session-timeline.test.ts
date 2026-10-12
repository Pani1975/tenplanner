import { describe, expect, it } from "vitest";
import {
  buildBlocksPayload,
  computeTimelineDuration,
  buildExercisesPayload,
  createTextItem,
  hasPlanContent,
  planItemsToWizard,
  textItemsFromBlocks,
} from "@/components/app/session-wizard/timeline";
import type { WizardExercise } from "@/components/app/session-wizard/types";
import { sumBlocksDuration } from "@/lib/block-items";

const ex = (
  id: string,
  phase: WizardExercise["phase"] = null
): WizardExercise => ({
  exerciseId: id,
  name: id,
  category: "technique",
  durationMinutes: 10,
  overrideDuration: null,
  notes: "",
  phase,
  intensity: null,
});

describe("session timeline", () => {
  it("keeps exercises and free text in order inside each block", () => {
    const state = {
      blocks: [],
      exercises: [
        ex("11111111-1111-1111-1111-111111111111", "activation"),
        createTextItem("Explicación inicial", "activation", 3),
        ex("22222222-2222-2222-2222-222222222222", "main"),
        createTextItem("Descanso y agua", "main"),
        createTextItem("   ", "main"), // vacío: se ignora
        createTextItem("Estiramientos", "cooldown", 5, "suave"),
      ],
    };
    const blocks = buildBlocksPayload(state);
    expect(blocks.map((b) => b.orderIndex)).toEqual([1, 2, 3]);
    expect(blocks[0].items).toEqual([
      {
        kind: "exercise",
        exerciseId: "11111111-1111-1111-1111-111111111111",
        durationMinutes: null,
        notes: null,
      },
      {
        kind: "text",
        freeText: "Explicación inicial",
        title: null,
        durationMinutes: 3,
        notes: null,
        aspecto: null,
      },
    ]);
    expect(blocks[1].items.map((i) => i.exerciseId ?? i.freeText)).toEqual([
      "22222222-2222-2222-2222-222222222222",
      "Descanso y agua",
    ]);
    expect(blocks[2].items).toEqual([
      {
        kind: "text",
        freeText: "Estiramientos",
        title: null,
        durationMinutes: 5,
        notes: "suave",
        aspecto: null,
      },
    ]);
  });

  it("never sends free text as an exercise id", () => {
    const payload = buildExercisesPayload({
      exercises: [
        createTextItem("Hola"),
        ex("33333333-3333-3333-3333-333333333333"),
      ],
    });
    expect(payload.map((p) => p.exerciseId)).toEqual([
      "33333333-3333-3333-3333-333333333333",
    ]);
  });

  it("a session with only free text is valid", () => {
    expect(hasPlanContent({ exercises: [createTextItem("Juego libre")] })).toBe(
      true
    );
    expect(hasPlanContent({ exercises: [createTextItem("  ")] })).toBe(false);
    expect(hasPlanContent({ exercises: [] })).toBe(false);
  });

  it("round-trips a saved plan into the wizard", () => {
    const items = planItemsToWizard([
      {
        kind: "exercise",
        exerciseId: "44444444-4444-4444-4444-444444444444",
        name: "Cesta derecha",
        category: "technique",
        defaultDurationMinutes: 10,
        durationMinutes: 12,
        notes: "altura",
        phase: "main",
      },
      {
        kind: "text",
        text: "Partido a 7 puntos",
        title: null,
        durationMinutes: null,
        notes: null,
        phase: "cooldown",
      },
    ]);
    expect(items[0]).toMatchObject({
      exerciseId: "44444444-4444-4444-4444-444444444444",
      overrideDuration: 12,
      notes: "altura",
      phase: "main",
    });
    expect(items[1]).toMatchObject({
      kind: "text",
      freeText: "Partido a 7 puntos",
      phase: "cooldown",
    });
    const blocks = buildBlocksPayload({ blocks: [], exercises: items });
    expect(blocks[2].items[0].freeText).toBe("Partido a 7 puntos");
  });

  it("recovers free text stored inside blocks (old drafts / classes)", () => {
    const items = textItemsFromBlocks([
      {
        orderIndex: 1,
        title: "Bloque inicial",
        notes: "",
        items: [
          { exerciseId: "55555555-5555-5555-5555-555555555555" },
          { freeText: "Movilidad articular", durationMinutes: 5 },
        ],
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "text",
      freeText: "Movilidad articular",
      phase: "activation",
      overrideDuration: 5,
    });
  });

  it("free text items carry an optional bold title through the payload", () => {
    const annotation = createTextItem(
      "",
      "main",
      null,
      "",
      "Recordatorio: traer petos"
    );
    expect(annotation.overrideDuration).toBeNull(); // anotación: sin duración
    const activity = createTextItem(
      "Partido corto",
      "main",
      8,
      "",
      "Partido final"
    );
    expect(activity.overrideDuration).toBe(8); // actividad: con duración

    const blocks = buildBlocksPayload({
      blocks: [],
      exercises: [annotation, activity],
    });
    expect(blocks[1].items).toEqual([
      {
        kind: "text",
        freeText: null,
        title: "Recordatorio: traer petos",
        durationMinutes: null,
        notes: null,
        aspecto: null,
      },
      {
        kind: "text",
        freeText: "Partido corto",
        title: "Partido final",
        durationMinutes: 8,
        notes: null,
        aspecto: null,
      },
    ]);
  });

  it("computes the real session duration from its content, not a stale manual value", () => {
    const state = {
      blocks: [],
      exercises: [
        ex("11111111-1111-1111-1111-111111111111", "activation"), // 10 min default
        createTextItem("Juego", "main", 15), // actividad con duración explícita
        createTextItem("", "cooldown", null, "", "Aviso"), // anotación sin duración
      ],
    };
    // El total de la línea de tiempo (lo que ve el monitor) debe coincidir
    // con lo que el servidor calcularía a partir del mismo plan guardado.
    expect(computeTimelineDuration(state)).toBe(10 + 15 + 5);

    const blocks = buildBlocksPayload(state);
    const exerciseDurationById = new Map([
      ["11111111-1111-1111-1111-111111111111", 10],
    ]);
    expect(sumBlocksDuration(blocks, exerciseDurationById)).toBe(10 + 15 + 5);
  });
});
