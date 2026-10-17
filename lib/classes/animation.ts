// Animación de los bloques de una clase (prueba piloto).
//
// Convierte los bloques/items de una clase en una línea de tiempo que
// reproduce ClassAnimationPlayer: cada actividad se explica frase a frase
// (con su descripción completa) mientras la pista muestra la organización.
// La duración de cada actividad depende de cuánto texto hay que leer, no de
// sus minutos reales (esos los marca el reloj de la clase).
//
// La lógica vive aquí, separada del componente, para poder testearla y
// para extenderla a todas las clases cuando se valide el piloto: basta con
// ampliar `hasClassAnimation`.

import {
  DEFAULT_BLOCK_ITEM_DURATION,
  resolveItemKind,
  type BlockItemKind,
} from "@/lib/block-items";

// Clases con animación (piloto): se van añadiendo una a una.
const ANIMATED_CLASS_IDS = new Set([
  "3dded14b-8003-4cf7-8c99-3f59cc3ddbe4", // Clase bola roja 01
  "03003301-79dd-40cf-ae93-702f563a121e", // Grupo Naranja/Verde 1
]);

export function hasClassAnimation(classId: string): boolean {
  return ANIMATED_CLASS_IDS.has(classId);
}

// Sesiones con animación (piloto): se van añadiendo una a una.
const ANIMATED_SESSION_IDS = new Set([
  "9113f402-0ed1-4537-9e79-17e4775b4504", // 261016_Galácticas
]);

export function hasSessionAnimation(sessionId: string): boolean {
  return ANIMATED_SESSION_IDS.has(sessionId);
}

/** Duración máxima de la animación completa, en segundos. */
export const ANIMATION_MAX_SECONDS = 240;
/** Velocidad de lectura cómoda (caracteres por segundo). */
const READ_CHARS_PER_SEC = 16;
/** Pausa extra por frase para que el ojo salte a la siguiente. */
const SENTENCE_BASE_SECONDS = 1.2;
/** Tiempo con solo el título en pantalla antes de la primera frase. */
const STEP_LEAD_SECONDS = 2;
/** Margen al final de cada actividad para terminar de leer. */
const STEP_TAIL_SECONDS = 1.5;
const MIN_STEP_SECONDS = 4.5;
/** Escenas que necesitan más tiempo para verse completas. */
const SCENE_MIN_SECONDS: Partial<Record<AnimationScene, number>> = {
  // Las dos variantes de la reina de la pista, enteras.
  points: 2 * 6.7 + 1,
  // Varias rondas de saque para que se vea subir al fondo y el +1.
  elevator: 12,
};
const REST_SECONDS = 5;
const REST_LEAD_SECONDS = 0.6;
const INTRO_LEAD_SECONDS = 2.5;
const OUTRO_SECONDS = 4;

export type AnimationScene =
  | "warmup"
  | "tee"
  | "guided"
  | "juggle"
  | "rally"
  | "pairs"
  | "relay"
  | "shadow"
  | "stations"
  | "serve"
  | "game"
  | "mirror"
  | "reaction"
  | "alley"
  | "points"
  | "elevator"
  | "rest"
  | "cooldown";

export interface AnimationInputItem {
  kind?: string | null;
  exerciseId?: string | null;
  exerciseName?: string | null;
  exerciseDescription?: string | null;
  exerciseObjectives?: string | null;
  freeText?: string | null;
  title?: string | null;
  durationMinutes?: number | null;
  stations?: unknown;
}

export interface AnimationInputBlock {
  orderIndex: number;
  title?: string | null;
  items: AnimationInputItem[];
}

export interface AnimationSentence {
  /** Etiqueta opcional ("RETO", "Organización"…) extraída del texto. */
  label: string | null;
  text: string;
  /** Segundo de la animación en el que aparece. */
  at: number;
}

export interface AnimationStep {
  blockIndex: number; // 0..n-1 (posición del bloque)
  blockTitle: string;
  title: string;
  sentences: AnimationSentence[];
  kind: BlockItemKind;
  isRest: boolean;
  scene: AnimationScene;
  minutes: number;
  /** Minuto de la clase en el que empieza la actividad. */
  classStartMin: number;
  /** Segundo de la animación en el que empieza / acaba. */
  start: number;
  end: number;
}

export interface AnimationTimeline {
  /** Objetivos de la clase, frase a frase, durante la presentación. */
  intro: AnimationSentence[];
  steps: AnimationStep[];
  totalClassMinutes: number;
  introSeconds: number;
  /** Fin de la última actividad (empieza el cierre). */
  stepsEnd: number;
  totalSeconds: number;
}

const DEFAULT_BLOCK_TITLES = [
  "Bloque inicial",
  "Bloque principal",
  "Bloque final",
];

function isRestItem(item: AnimationInputItem, kind: BlockItemKind) {
  if (kind === "warmup") return true;
  const name = (item.title ?? item.exerciseName ?? "").trim().toLowerCase();
  return name === "descanso" || name.startsWith("descanso ");
}

function sceneFor(
  blockPos: number,
  blockCount: number,
  isRest: boolean,
  kind: BlockItemKind,
  text: string
): AnimationScene {
  if (isRest) return "rest";
  const t = text.toLowerCase();
  if (kind === "stations") return "stations";
  const isGame = /\bvidas\b|eliminad/.test(t);
  // Ejercicios con organización propia, en cualquier bloque.
  // (En la torre/tee "espejo" describe las sombras, no el ejercicio.)
  if (/\bespejo\b/.test(t) && !/\btorre\b|\btee\b/.test(t)) return "mirror";
  if (/\breacci[oó]n\b|\breactiv[ao]s?\b/.test(t)) return "reaction";
  if (/pasillo de dobles/.test(t)) return "alley";
  if (/\bascensor\b/.test(t) && /\bsaque\b|\bservicio\b|\bsirven\b/.test(t))
    return "elevator";
  if (
    /\b(rey|reina) de la pista|\bpuntos? en (el|los) cuadros? de saque/.test(t)
  )
    return "points";
  if (blockPos === 0 && blockCount > 1) {
    if (/pelote[oa]n?\b|\bpelotear\b/.test(t)) return "pairs";
    if (/\baros?\b/.test(t) && /\bequipos?\b|relevo/.test(t)) return "relay";
    return "warmup";
  }
  if (blockPos === blockCount - 1 && blockCount > 1) {
    if (!/estiramiento/.test(t) && isGame) return "game";
    return "cooldown";
  }
  if (/\btorre\b|\btee\b/.test(t)) return "tee";
  // "zona de servicio" es solo un lugar de la pista, no un saque.
  if (
    /\bsaque\b|\bsacar[aá]n?\b|\bsirven\b/.test(t) ||
    /(?<!zona de )\bservicio\b/.test(t)
  )
    return "serve";
  // "guiada" antes que "malabares": "la mano sobre las cuerdas" del monitor
  // describe un golpe guiado, no un ejercicio de control de pelota.
  if (/guiad|mano sobre|acompaña/.test(t)) return "guided";
  if (/\bsombra\b/.test(t)) return "shadow";
  if (isGame) return "game";
  if (/malabar|toques|(sobre|encima de) las cuerdas|equilibrio/.test(t))
    return "juggle";
  return "rally";
}

const LABEL_RE = /^([A-ZÁÉÍÓÚÑa-záéíóúñ][\wÁÉÍÓÚÑáéíóúñ ]{1,22}):\s+(.+)$/;

/**
 * Parte un texto en frases legibles. Respeta los saltos de línea, separa en
 * puntos/exclamaciones/interrogaciones y en listas "1) … 2) …", junta los
 * trozos muy cortos (p. ej. "NIVEL 1.") con la frase siguiente y extrae
 * etiquetas del tipo "RETO: …".
 */
export function splitSentences(
  text: string | null | undefined
): { label: string | null; text: string }[] {
  if (!text) return [];
  const pieces = text
    .split(/\n+/)
    .flatMap((line) =>
      line
        .split(/(?<=[.!?…])\s+(?=[¡¿"«(A-ZÁÉÍÓÚÑ0-9])|\s+(?=\d+\)\s)/)
        .map((p) => p.trim())
    )
    .filter(Boolean);

  const merged: string[] = [];
  let carry = "";
  for (const p of pieces) {
    const joined = carry ? `${carry} ${p}` : p;
    if (joined.length < 14) carry = joined;
    else {
      merged.push(joined);
      carry = "";
    }
  }
  if (carry) {
    if (merged.length) merged[merged.length - 1] += ` ${carry}`;
    else merged.push(carry);
  }

  return merged.map((s) => {
    const m = s.match(LABEL_RE);
    // Una etiqueta es corta y no es una frase normal con dos puntos.
    if (m && m[1].split(" ").length <= 3)
      return { label: m[1].trim(), text: m[2].trim() };
    return { label: null, text: s };
  });
}

function readSeconds(text: string) {
  return SENTENCE_BASE_SECONDS + text.length / READ_CHARS_PER_SEC;
}

const REST_FALLBACK = "Agua, recoger pelotas y breve comentario del monitor.";

function restText(item: AnimationInputItem) {
  const raw = (item.freeText ?? "").trim();
  // "DESCANSO (1 min): agua, …" → "Agua, …"
  const clean = raw.replace(/^descanso\s*(\([^)]*\))?\s*:?\s*/i, "");
  if (!clean) return REST_FALLBACK;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function buildAnimationTimeline(
  blocks: AnimationInputBlock[],
  options: { objectives?: string | null; maxSeconds?: number } = {}
): AnimationTimeline {
  const maxSeconds = options.maxSeconds ?? ANIMATION_MAX_SECONDS;
  const ordered = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);

  type Draft = Omit<AnimationStep, "start" | "end" | "sentences"> & {
    parts: { label: string | null; text: string }[];
  };
  const drafts: Draft[] = [];
  let classMin = 0;

  ordered.forEach((block, blockPos) => {
    const blockTitle =
      block.title?.trim() ||
      DEFAULT_BLOCK_TITLES[block.orderIndex - 1] ||
      "Bloque";
    for (const item of block.items) {
      const kind = resolveItemKind(item);
      const isRest = isRestItem(item, kind);
      const minutes = item.durationMinutes ?? DEFAULT_BLOCK_ITEM_DURATION;
      const stationCount = Array.isArray(item.stations)
        ? item.stations.length
        : 0;
      const hasName = !!(item.exerciseName || item.title);
      const title = isRest
        ? "Descanso"
        : kind === "stations"
          ? `Estaciones (${stationCount})`
          : item.exerciseName ||
            item.title ||
            splitSentences(item.freeText)[0]?.text.slice(0, 60) ||
            "Actividad";
      // Texto de la explicación: la descripción del ejercicio de biblioteca
      // o el texto libre del item (si no se ha usado ya como título).
      const isStations = kind === "stations";
      const body = isRest
        ? restText(item)
        : item.exerciseDescription?.trim() ||
          (hasName || isStations ? item.freeText : null) ||
          "";
      let parts = splitSentences(body);
      if (!hasName && !isRest && !isStations && parts.length > 1)
        parts = parts.slice(1);
      if (isStations) {
        const names = (Array.isArray(item.stations) ? item.stations : [])
          .map((st) => {
            const o = st as {
              exerciseName?: string | null;
              title?: string | null;
            };
            return (o?.exerciseName || o?.title || "").trim();
          })
          .filter(Boolean);
        if (names.length)
          parts = [...parts, { label: "Estaciones", text: names.join(" · ") }];
      }
      const objective = isRest ? null : item.exerciseObjectives?.trim();
      if (objective) parts = [...parts, { label: "Objetivo", text: objective }];
      drafts.push({
        blockIndex: blockPos,
        blockTitle,
        title,
        parts,
        kind,
        isRest,
        scene: sceneFor(
          blockPos,
          ordered.length,
          isRest,
          kind,
          `${title} ${body}`
        ),
        minutes,
        classStartMin: classMin,
      });
      classMin += minutes;
    }
  });

  const introParts = splitSentences(options.objectives);

  // Duraciones "naturales" (a velocidad de lectura cómoda).
  const introNatural =
    INTRO_LEAD_SECONDS +
    introParts.reduce((acc, p) => acc + readSeconds(p.text), 0) +
    (introParts.length ? STEP_TAIL_SECONDS : 0);
  const stepNatural = drafts.map((d) => {
    // Los descansos se repiten y su texto es siempre parecido: pausa corta.
    if (d.isRest) return REST_SECONDS;
    const reading = d.parts.reduce((acc, p) => acc + readSeconds(p.text), 0);
    return Math.max(
      MIN_STEP_SECONDS,
      SCENE_MIN_SECONDS[d.scene] ?? 0,
      STEP_LEAD_SECONDS + reading + STEP_TAIL_SECONDS
    );
  });
  const natural =
    introNatural + stepNatural.reduce((a, b) => a + b, 0) + OUTRO_SECONDS;
  // Si no cabe en el máximo, se acelera todo por igual.
  const k = natural > maxSeconds ? maxSeconds / natural : 1;

  const placeSentences = (
    parts: { label: string | null; text: string }[],
    from: number
  ) => {
    let at = from;
    return parts.map((p) => {
      const s = { ...p, at };
      at += readSeconds(p.text) * k;
      return s;
    });
  };

  const intro = placeSentences(introParts, INTRO_LEAD_SECONDS * k);
  const introSeconds = introNatural * k;

  let t = introSeconds;
  const steps: AnimationStep[] = drafts.map((d, i) => {
    const start = t;
    t += stepNatural[i] * k;
    const { parts, ...rest } = d;
    const lead = d.isRest ? REST_LEAD_SECONDS : STEP_LEAD_SECONDS;
    const sentences = placeSentences(parts, start + lead * k);
    return { ...rest, sentences, start, end: t };
  });

  return {
    intro,
    steps,
    totalClassMinutes: classMin,
    introSeconds,
    stepsEnd: t,
    totalSeconds: t + OUTRO_SECONDS * k,
  };
}

/** Minuto de clase (simulado) que corresponde al segundo `t` de animación. */
export function classMinuteAt(timeline: AnimationTimeline, t: number): number {
  const { steps } = timeline;
  if (steps.length === 0 || t <= timeline.introSeconds) return 0;
  if (t >= timeline.stepsEnd) return timeline.totalClassMinutes;
  const step = steps.find((s) => t >= s.start && t < s.end) ?? steps.at(-1)!;
  const p = (t - step.start) / (step.end - step.start);
  return step.classStartMin + step.minutes * Math.min(1, Math.max(0, p));
}
