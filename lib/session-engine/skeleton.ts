// Esqueleto de la clase por duración (minutos objetivo de cada hueco).
// La intensidad no cambia los huecos: mueve minutos hacia o desde los
// huecos de puntos (suave menos, alta más).

import type { Duration, Intensity, Phase, SlotKind } from "./types";

export type Slot = { kind: SlotKind; phase: Phase; minutes: number };

const BASE: Record<Duration, [SlotKind, number][]> = {
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

export function buildSkeleton(
  duration: Duration,
  intensity: Intensity
): Slot[] {
  const slots: Slot[] = BASE[duration].map(([kind, minutes]) => ({
    kind,
    phase: phaseOf(kind),
    minutes,
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
