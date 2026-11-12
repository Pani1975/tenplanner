// Esqueleto de la clase por duración (minutos objetivo de cada hueco).
// La intensidad no cambia los huecos: mueve minutos hacia o desde los
// huecos de puntos (suave menos, alta más).

import type { Duration, Intensity, Phase, SlotKind } from "./types";

export type Slot = { kind: SlotKind; phase: Phase; minutes: number };

const BASE: Record<30 | 45 | 60 | 90, [SlotKind, number][]> = {
  30: [
    ["activation", 5],
    ["tecnica", 10],
    ["puntos", 11],
    ["cooldown", 4],
  ],
  45: [
    ["activation", 7],
    ["tecnica", 14],
    ["tactica", 9],
    ["puntos", 10],
    ["cooldown", 5],
  ],
  60: [
    ["activation", 8],
    ["tecnica", 14],
    ["tactica", 8],
    ["puntos", 10],
    ["puntos", 15],
    ["cooldown", 5],
  ],
  90: [
    ["activation", 12],
    ["tecnica", 20],
    ["tactica", 15],
    ["puntos", 15],
    ["puntos", 20],
    ["cooldown", 8],
  ],
};

export function phaseOf(kind: SlotKind): Phase {
  if (kind === "activation") return "activation";
  if (kind === "cooldown") return "cooldown";
  return "main";
}

/** Fracción de los minutos de puntos que se mueve según la intensidad. */
const INTENSITY_SHIFT: Record<Intensity, number> = {
  suave: -0.25,
  media: 0,
  alta: 0.25,
};

/** Plantilla más cercana a la duración pedida. */
function templateFor(duration: number): 30 | 45 | 60 | 90 {
  const keys = [30, 45, 60, 90] as const;
  return keys.reduce((best, k) =>
    Math.abs(k - duration) < Math.abs(best - duration) ? k : best
  );
}

/**
 * Esqueleto para cualquier duración (la de la sesión en el calendario): se
 * toma la plantilla más cercana y se escalan sus minutos para que sumen
 * exactamente la duración pedida.
 */
export function buildSkeleton(
  duration: Duration,
  intensity: Intensity
): Slot[] {
  const template = BASE[templateFor(duration)];
  const base = template.reduce((n, [, m]) => n + m, 0);
  const scaled = template.map(([, m]) =>
    Math.max(2, Math.round((m * duration) / base))
  );
  // Ajuste fino para que la suma sea exacta (sobre los huecos centrales).
  let diff = duration - scaled.reduce((n, m) => n + m, 0);
  for (let i = 1; diff !== 0 && i < 1000; i++) {
    const idx = 1 + (i % Math.max(1, scaled.length - 2));
    if (diff < 0 && scaled[idx] <= 2) continue;
    scaled[idx] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  const slots: Slot[] = template.map(([kind], i) => ({
    kind,
    phase: phaseOf(kind),
    minutes: scaled[i],
  }));
  const shift = INTENSITY_SHIFT[intensity];
  if (shift === 0) return slots;

  const puntos = slots.filter((s) => s.kind === "puntos");
  const work = slots.filter(
    (s) => s.kind === "tecnica" || s.kind === "tactica"
  );
  const puntosTotal = puntos.reduce((n, s) => n + s.minutes, 0);
  const delta = Math.round(puntosTotal * shift);
  // Reparte delta: suma a puntos y resta de técnica/táctica (o al revés).
  spread(puntos, delta);
  spread(work, -delta);
  return slots;
}

/** Suma `delta` minutos repartidos entre los huecos (mínimo 3 por hueco). */
function spread(slots: Slot[], delta: number) {
  let left = delta;
  let i = 0;
  let guard = 0;
  while (left !== 0 && slots.length > 0 && guard++ < 1000) {
    const s = slots[i % slots.length];
    const step = left > 0 ? 1 : -1;
    if (step < 0 && s.minutes <= 3) {
      i++;
      if (slots.every((x) => x.minutes <= 3)) break;
      continue;
    }
    s.minutes += step;
    left -= step;
    i++;
  }
}
