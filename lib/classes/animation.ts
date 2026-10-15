// Animación de los bloques de una clase (prueba piloto).
//
// Convierte los bloques/items de una clase en una línea de tiempo comprimida
// (≤ 30 s) que reproduce ClassAnimationPlayer. La lógica vive aquí, separada
// del componente, para poder testearla y para extenderla a todas las clases
// cuando se valide el piloto: basta con ampliar `hasClassAnimation`.

import {
  DEFAULT_BLOCK_ITEM_DURATION,
  resolveItemKind,
  type BlockItemKind,
} from "@/lib/block-items";

// Piloto: solo "Clase bola roja 01" de la Biblioteca.
const ANIMATED_CLASS_IDS = new Set(["3dded14b-8003-4cf7-8c99-3f59cc3ddbe4"]);

export function hasClassAnimation(classId: string): boolean {
  return ANIMATED_CLASS_IDS.has(classId);
}

/** Duración máxima de la animación completa, en segundos. */
export const ANIMATION_MAX_SECONDS = 30;
const INTRO_SECONDS = 1.6;
const OUTRO_SECONDS = 2.2;
/** Tiempo mínimo en pantalla de cada actividad (para que se pueda leer). */
const MIN_ITEM_SECONDS = 1.6;

export type AnimationScene = "warmup" | "rally" | "rest" | "cooldown";

export interface AnimationInputItem {
  kind?: string | null;
  exerciseId?: string | null;
  exerciseName?: string | null;
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

export interface AnimationStep {
  blockIndex: number; // 0..n-1 (posición del bloque)
  blockTitle: string;
  title: string;
  description: string | null;
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
  isRest: boolean
): AnimationScene {
  if (isRest) return "rest";
  if (blockPos === 0 && blockCount > 1) return "warmup";
  if (blockPos === blockCount - 1 && blockCount > 1) return "cooldown";
  return "rally";
}

function shortText(text: string | null | undefined, max = 150) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max).trimEnd()}…`;
}

export function buildAnimationTimeline(
  blocks: AnimationInputBlock[],
  maxSeconds = ANIMATION_MAX_SECONDS
): AnimationTimeline {
  const ordered = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const raw: Omit<AnimationStep, "start" | "end">[] = [];
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
      const title = isRest
        ? "Descanso"
        : kind === "stations"
          ? `Estaciones (${stationCount})`
          : item.exerciseName ||
            item.title ||
            shortText(item.freeText, 60) ||
            "Actividad";
      // Para un item de texto con título, el texto libre es su descripción;
      // sin título, ya se ha usado como nombre.
      const description = isRest
        ? "Agua, recoger pelotas y breve comentario del monitor."
        : item.exerciseName || item.title
          ? shortText(item.freeText)
          : null;
      raw.push({
        blockIndex: blockPos,
        blockTitle,
        title,
        description,
        kind,
        isRest,
        scene: sceneFor(blockPos, ordered.length, isRest),
        minutes,
        classStartMin: classMin,
      });
      classMin += minutes;
    }
  });

  const totalClassMinutes = classMin;
  const budget = Math.max(0, maxSeconds - INTRO_SECONDS - OUTRO_SECONDS);
  const n = raw.length;
  // Cada actividad recibe un mínimo legible y el resto del tiempo se reparte
  // en proporción a sus minutos reales. Si hay tantas que no cabe el mínimo,
  // se reparte a partes iguales.
  const minEach = n > 0 ? Math.min(MIN_ITEM_SECONDS, budget / n) : 0;
  const extra = budget - minEach * n;

  let t = INTRO_SECONDS;
  const steps: AnimationStep[] = raw.map((s) => {
    const share =
      totalClassMinutes > 0 ? (extra * s.minutes) / totalClassMinutes : 0;
    const start = t;
    t += minEach + share;
    return { ...s, start, end: t };
  });

  return {
    steps,
    totalClassMinutes,
    introSeconds: INTRO_SECONDS,
    stepsEnd: t,
    totalSeconds: t + OUTRO_SECONDS,
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
