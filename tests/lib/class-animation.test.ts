import { describe, expect, it } from "vitest";
import {
  ANIMATION_MAX_SECONDS,
  buildAnimationTimeline,
  classMinuteAt,
  hasClassAnimation,
  splitSentences,
} from "@/lib/classes/animation";

const ex = (
  name: string,
  minutes: number,
  description: string,
  objectives: string | null = null
) => ({
  kind: "exercise",
  exerciseId: "e",
  exerciseName: name,
  exerciseDescription: description,
  exerciseObjectives: objectives,
  durationMinutes: minutes,
});
const txt = (title: string, minutes: number, freeText: string) => ({
  kind: "text",
  title,
  freeText,
  durationMinutes: minutes,
});
const rest = (m: number) =>
  txt("Descanso", m, `DESCANSO (${m} min): agua, recogida de pelotas.`);

// Estructura real de "Clase bola roja 01" (55 min).
const blocks = [
  {
    orderIndex: 1,
    title: "Calentamiento",
    items: [
      ex(
        "Carrera y movilidad articular",
        5,
        "Los alumnos corren 3 vueltas a la pista mientras el profesor va indicando ejercicios de movilidad."
      ),
    ],
  },
  {
    orderIndex: 2,
    title: "Parte principal",
    items: [
      txt(
        "Torre/Tee con monitor (derecha)",
        10,
        "NIVEL 1. La bola se coloca sobre la torre/tee a la altura de la cintura del alumno. El monitor acompaña el gesto.\nRETO: 5 golpes de derecha dirigidos a un aro en el suelo.\nOrganización: mientras uno golpea, el resto hace sombras."
      ),
      rest(1),
      ex(
        "Preparación guiada con el profesor",
        10,
        "El profesor coloca su mano sobre las cuerdas de la raqueta del alumno para guiarle la preparación. El alumno realiza 15 golpes."
      ),
      rest(1),
      ex(
        "Raqueta y pelota: control y coordinación",
        10,
        "Recorrido en zig-zag llevando la pelota encima de las cuerdas de la raqueta. Después, 5 toques hacia arriba."
      ),
      rest(1),
      ex(
        "¡Malabares mágicos!",
        10,
        "Cada niño tiene una raqueta y una pelota. La pelota debe mantenerse en la cuerda sin caer.",
        "Desarrollar el control de la raqueta."
      ),
      rest(2),
    ],
  },
  {
    orderIndex: 3,
    title: "Vuelta a la calma",
    items: [
      ex(
        "Estiramientos de vuelta a la calma",
        5,
        "Estiramientos de cuello, antebrazo, tríceps y gemelos para finalizar la sesión."
      ),
    ],
  },
];

describe("animación de clase", () => {
  it("solo está activa para la clase piloto", () => {
    expect(hasClassAnimation("3dded14b-8003-4cf7-8c99-3f59cc3ddbe4")).toBe(
      true
    );
    expect(hasClassAnimation("otra")).toBe(false);
  });

  it("parte el texto en frases, junta trozos cortos y extrae etiquetas", () => {
    const s = splitSentences(
      "NIVEL 1. La bola se coloca sobre la torre.\nRETO: 5 golpes al aro."
    );
    expect(s).toEqual([
      { label: null, text: "NIVEL 1. La bola se coloca sobre la torre." },
      { label: "RETO", text: "5 golpes al aro." },
    ]);
    expect(
      splitSentences("1) Mecanizar la derecha. 2) Jugar con la raqueta.")
    ).toHaveLength(2);
  });

  it("explica cada actividad frase a frase y asigna escenas", () => {
    const tl = buildAnimationTimeline(blocks, {
      objectives: "1) Mecanizar la derecha. 2) Familiarizarse con la raqueta.",
    });
    expect(tl.totalSeconds).toBeLessThanOrEqual(ANIMATION_MAX_SECONDS + 1e-9);
    expect(tl.totalSeconds).toBeGreaterThan(60);
    expect(tl.intro).toHaveLength(2);
    expect(tl.steps.map((s) => s.scene)).toEqual([
      "warmup",
      "tee",
      "rest",
      "guided",
      "rest",
      "juggle",
      "rest",
      "juggle",
      "rest",
      "cooldown",
    ]);
    const torre = tl.steps[1];
    expect(torre.sentences.map((s) => s.label)).toEqual([
      null,
      null,
      "RETO",
      "Organización",
    ]);
    expect(tl.steps[2].sentences[0].text).toBe("Agua, recogida de pelotas.");
    expect(tl.steps[7].sentences.at(-1)).toMatchObject({ label: "Objetivo" });
    for (const s of tl.steps) {
      for (const sen of s.sentences) {
        expect(sen.at).toBeGreaterThanOrEqual(s.start);
        expect(sen.at).toBeLessThan(s.end);
      }
    }
  });

  it("se acelera para no pasar del máximo", () => {
    const tl = buildAnimationTimeline(blocks, { maxSeconds: 40 });
    expect(tl.totalSeconds).toBeCloseTo(40);
  });

  it("el reloj recorre de 0 a la duración de la clase", () => {
    const tl = buildAnimationTimeline(blocks);
    expect(classMinuteAt(tl, 0)).toBe(0);
    expect(classMinuteAt(tl, tl.steps[1].start)).toBeCloseTo(5);
    expect(classMinuteAt(tl, tl.totalSeconds)).toBe(55);
  });
});

describe("animación Grupo Naranja/Verde 1", () => {
  const g = [
    {
      orderIndex: 1,
      title: "Calentamiento",
      items: [
        ex(
          "Carrera y movilidad articular",
          5,
          "Los alumnos corren 3 vueltas a la pista."
        ),
        ex(
          "Peloteo en media pista",
          5,
          "Peloteo libre con raqueta en media pista para activar el golpeo."
        ),
        ex(
          "Tres en raya",
          10,
          "El profesor divide el grupo en dos equipos. Se colocan 9 aros cerca de la red."
        ),
      ],
    },
    {
      orderIndex: 2,
      title: "Parte principal",
      items: [
        ex(
          "Prepara, golpea y termina",
          20,
          "Por parejas: un alumno golpea mientras el otro, situado justo detrás, hace de «sombra»."
        ),
        {
          kind: "stations",
          freeText:
            "Circuito técnico por estaciones de derecha y de revés: 6 estaciones de 3 minutos cada una.",
          durationMinutes: 25,
          stations: [
            { kind: "exercise", exerciseName: "Saque con progresiones" },
            { kind: "exercise", exerciseName: "Mini portería" },
          ],
        },
        ex(
          "Saque: primeros golpes",
          10,
          "Dependiendo del nivel, los alumnos sacarán desde media pista o desde el fondo."
        ),
      ],
    },
    {
      orderIndex: 3,
      title: "Vuelta a la calma",
      items: [
        ex(
          "El infierno",
          10,
          "Cada alumno tiene tres vidas. El alumno que pierda las dos vidas queda eliminado."
        ),
        ex("Estiramientos de vuelta a la calma", 5, "Estiramientos de cuello."),
      ],
    },
  ];

  it("está activa y asigna una escena a cada actividad", () => {
    expect(hasClassAnimation("03003301-79dd-40cf-ae93-702f563a121e")).toBe(
      true
    );
    const tl = buildAnimationTimeline(g);
    expect(tl.steps.map((s) => s.scene)).toEqual([
      "warmup",
      "pairs",
      "relay",
      "shadow",
      "stations",
      "serve",
      "game",
      "cooldown",
    ]);
    const st = tl.steps[4];
    expect(st.title).toBe("Estaciones (2)");
    expect(st.sentences.at(-1)).toMatchObject({
      label: "Estaciones",
      text: "Saque con progresiones · Mini portería",
    });
    expect(tl.totalClassMinutes).toBe(90);
  });
});
