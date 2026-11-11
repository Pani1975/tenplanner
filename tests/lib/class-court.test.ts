import { describe, expect, it } from "vitest";
import raw from "@/lib/exercise-diagrams/diagrams.json";
import animated from "@/lib/exercise-diagrams/diagrams-animated.json";
import { buildTimeline } from "@/lib/exercise-diagrams/animate";
import { withIdleMotion } from "@/lib/exercise-diagrams/idle";
import type { Diagram } from "@/lib/exercise-diagrams/types";
import {
  COURT,
  NET_X,
  SINGLES_BOTTOM,
  SINGLES_TOP,
  courtPoint,
} from "@/lib/classes/court-geometry";
import { buildAnimationTimeline } from "@/lib/classes/animation";

const all = {
  ...(raw as unknown as Record<string, Diagram>),
  ...(animated as unknown as Record<string, Diagram>),
};

describe("esquemas sobre la pista alargada", () => {
  it("la red de la pista completa cae en la red de la animación", () => {
    for (const court of ["tenis", "mini", "libre"] as const) {
      expect(courtPoint(court, [50, 50]).x).toBe(NET_X);
      expect(courtPoint(court, [50, 0]).x).toBe(COURT.x);
      expect(courtPoint(court, [50, 100]).x).toBe(COURT.x + COURT.w);
    }
  });

  it("la media pista ocupa el campo derecho, con la red en y = 0", () => {
    expect(courtPoint("medio", [50, 0]).x).toBe(NET_X);
    expect(courtPoint("medio", [50, 100]).x).toBe(COURT.x + COURT.w);
  });

  it("la minipista va entre las líneas de individuales", () => {
    expect(courtPoint("mini", [0, 50]).y).toBe(SINGLES_TOP);
    expect(courtPoint("mini", [100, 50]).y).toBe(SINGLES_BOTTOM);
  });
});

describe("movimiento mínimo de los esquemas", () => {
  it("ningún esquema con jugadores se queda quieto", () => {
    for (const [id, d] of Object.entries(all)) {
      const hasPlayers = d.elements.some((e) => e.t === "player");
      if (!hasPlayers) continue;
      const tl = buildTimeline(withIdleMotion(d));
      expect(tl.steps.length, id).toBeGreaterThan(0);
    }
  });

  it("no toca los esquemas que ya se mueven", () => {
    const moving = Object.values(all).find(
      (d) => buildTimeline(d).steps.length > 0
    )!;
    expect(withIdleMotion(moving)).toBe(moving);
  });

  it("el monitor lanza por turnos a los alumnos", () => {
    const d: Diagram = {
      court: "medio",
      elements: [
        { t: "player", at: [50, 80], role: "monitor" },
        { t: "player", at: [30, 20] },
        { t: "player", at: [70, 20] },
      ],
    };
    const tl = buildTimeline(withIdleMotion(d));
    expect(tl.steps.filter((s) => s.ball).length).toBe(4);
    expect(tl.steps[0].swing).toBe(0);
  });
});

describe("escenas de las actividades sin esquema", () => {
  const one = (title: string, text: string, blockPos = 1) =>
    buildAnimationTimeline(
      [0, 1, 2].map((i) => ({
        orderIndex: i + 1,
        items:
          i === blockPos
            ? [
                {
                  kind: "exercise",
                  exerciseName: title,
                  exerciseDescription: text,
                },
              ]
            : [{ kind: "text", freeText: "Descanso" }],
      }))
    ).steps.find((s) => s.title === title)!.scene;

  it("el título manda sobre la descripción", () => {
    expect(
      one(
        "Cesta de derecha: intensidad con control",
        "El monitor alimenta; se juega a puntos con el resto."
      )
    ).toBe("neutral");
  });

  it("reconoce voleas, partidos, físico y charla", () => {
    expect(one("Volea-volea en la red", "Por parejas.")).toBe("volley");
    expect(one("Super tie-break de presión", "Se juega a 10.")).toBe("match");
    expect(one("Fuerza del core antirrotación", "Con goma.")).toBe("circuit");
    expect(one("La pizarra del partido", "Se repasa el plan.", 2)).toBe("talk");
  });

  it("'el resto' de alumnos no es un resto de saque", () => {
    expect(
      one("Resistencia con balón medicinal", "El resto espera su turno.")
    ).not.toBe("serve");
  });
});
