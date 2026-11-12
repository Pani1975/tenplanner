// Ajuste de minutos: la suma de la clase es exactamente la duración pedida.

export type FitItem = {
  /** Minutos objetivo del hueco. */
  target: number;
  /** Duración propia del ejercicio. */
  exerciseMinutes: number;
  pinned: boolean;
  /** Minutos fijados a mano (solo si pinned). */
  fixedMinutes?: number;
  isPuntos: boolean;
};

/**
 * Devuelve los minutos de cada elemento. Cada ejercicio no fijado se
 * mueve dentro de ±40 % de su duración propia; lo que no cabe va al hueco
 * de puntos (o al último no fijado). Nunca menos de 1 minuto.
 */
export function fitDurations(items: FitItem[], total: number): number[] {
  const mins = items.map((it) =>
    it.pinned && it.fixedMinutes
      ? it.fixedMinutes
      : clamp(it.target, lower(it), upper(it))
  );
  const free = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !(it.pinned && it.fixedMinutes));
  if (free.length === 0) return mins;

  let diff = total - sum(mins);
  // Reparto proporcional, minuto a minuto, respetando ±40 %.
  let guard = 0;
  while (diff !== 0 && guard++ < 2000) {
    const step = diff > 0 ? 1 : -1;
    const room = free.filter(({ it, i }) =>
      step > 0 ? mins[i] < upper(it) : mins[i] > lower(it)
    );
    if (room.length === 0) break;
    // El que más se aleja de su objetivo en la dirección contraria, primero.
    room.sort(
      (a, b) =>
        step * (mins[a.i] - a.it.target) - step * (mins[b.i] - b.it.target) ||
        a.i - b.i
    );
    mins[room[0].i] += step;
    diff -= step;
  }

  // Lo que sobra o falta, al hueco de puntos (sin límite de ±40 %).
  if (diff !== 0) {
    const sink =
      [...free].reverse().find(({ it }) => it.isPuntos) ??
      free[free.length - 1];
    mins[sink.i] += diff;
    if (mins[sink.i] < 1) {
      // Caso extremo: repartir el déficit entre el resto.
      let deficit = 1 - mins[sink.i];
      mins[sink.i] = 1;
      for (const { i } of free) {
        while (deficit > 0 && mins[i] > 1 && i !== sink.i) {
          mins[i] -= 1;
          deficit -= 1;
        }
      }
    }
  }
  return mins;
}

function lower(it: FitItem) {
  return Math.max(1, Math.round(it.exerciseMinutes * 0.6));
}
function upper(it: FitItem) {
  return Math.max(lower(it), Math.round(it.exerciseMinutes * 1.4));
}
function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function sum(a: number[]) {
  return a.reduce((x, y) => x + y, 0);
}
