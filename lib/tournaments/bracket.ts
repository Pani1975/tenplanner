// Cuadro de eliminatoria directa. Funciones puras: generan y actualizan una
// lista de partidos en memoria; guardarla en tournament_matches es cosa de
// la capa de servidor (las claves `key` se traducen a ids).

import type { Side } from "./score";

export type BracketMatch = {
  key: string; // "r{ronda}-p{posición}", posiciones desde 1
  round: number; // 1 = primera ronda
  position: number;
  entryA: string | null;
  entryB: string | null;
  // pending: falta jugar o falta rival. bye: un lado pasa sin jugar.
  status: "pending" | "played" | "bye";
  winner: string | null;
  nextKey: string | null;
  nextSlot: Side | null;
};

export const matchKey = (round: number, position: number) =>
  `r${round}-p${position}`;

/** Siguiente potencia de 2 (mínimo 2). */
export function bracketSize(n: number): number {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

/**
 * Orden estándar de cabezas de serie en un cuadro de `size` huecos:
 * para 8 → [1, 8, 4, 5, 2, 7, 3, 6]. Así 1 y 2 solo se cruzan en la final
 * y los huecos más altos (los byes) caen frente a los mejores.
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/**
 * Genera el cuadro. `entries` va ordenado por cabeza de serie: el primero
 * es el 1. Sin cabezas de serie, el que llama baraja antes (ver shuffle).
 * Con N no potencia de 2, los (tamaño − N) mejores pasan la 1.ª ronda por
 * bye y quedan ya colocados en la 2.ª.
 */
export function generateKnockout(entries: string[]): BracketMatch[] {
  if (entries.length < 2) throw new Error("min_two_entries");
  if (new Set(entries).size !== entries.length) {
    throw new Error("duplicate_entries");
  }
  const size = bracketSize(entries.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const slot = (seed: number) =>
    seed <= entries.length ? entries[seed - 1] : null;

  const matches: BracketMatch[] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let p = 1; p <= count; p++) {
      const isLast = r === rounds;
      matches.push({
        key: matchKey(r, p),
        round: r,
        position: p,
        entryA: r === 1 ? slot(order[(p - 1) * 2]) : null,
        entryB: r === 1 ? slot(order[(p - 1) * 2 + 1]) : null,
        status: "pending",
        winner: null,
        nextKey: isLast ? null : matchKey(r + 1, Math.ceil(p / 2)),
        nextSlot: isLast ? null : p % 2 === 1 ? "a" : "b",
      });
    }
  }

  // Byes de la primera ronda: el lado presente pasa directamente.
  let result = matches;
  for (const m of matches.filter((m) => m.round === 1)) {
    const present = m.entryA ?? m.entryB;
    if (m.entryA && m.entryB) continue;
    result = setMatch(result, m.key, { status: "bye", winner: present });
    if (present) result = placeInNext(result, m.key, present);
  }
  return result;
}

function setMatch(
  matches: BracketMatch[],
  key: string,
  patch: Partial<BracketMatch>
): BracketMatch[] {
  return matches.map((m) => (m.key === key ? { ...m, ...patch } : m));
}

function placeInNext(
  matches: BracketMatch[],
  key: string,
  entry: string | null
): BracketMatch[] {
  const m = matches.find((x) => x.key === key);
  if (!m?.nextKey || !m.nextSlot) return matches;
  return setMatch(
    matches,
    m.nextKey,
    m.nextSlot === "a" ? { entryA: entry } : { entryB: entry }
  );
}

export type ApplyError =
  | "match_not_found"
  | "missing_opponent"
  | "winner_not_in_match"
  | "next_already_played";

/**
 * Registra (o corrige) el ganador de un partido y lo pasa al siguiente.
 * No deja corregir si el partido siguiente ya se jugó: habría que borrar
 * antes ese resultado.
 */
export function applyWinner(
  matches: BracketMatch[],
  key: string,
  winner: string
): { ok: true; matches: BracketMatch[] } | { ok: false; error: ApplyError } {
  const m = matches.find((x) => x.key === key);
  if (!m) return { ok: false, error: "match_not_found" };
  if (!m.entryA || !m.entryB) return { ok: false, error: "missing_opponent" };
  if (winner !== m.entryA && winner !== m.entryB) {
    return { ok: false, error: "winner_not_in_match" };
  }
  const next = m.nextKey ? matches.find((x) => x.key === m.nextKey) : null;
  if (next && next.status === "played" && m.winner !== winner) {
    return { ok: false, error: "next_already_played" };
  }
  let result = setMatch(matches, key, { status: "played", winner });
  result = placeInNext(result, key, winner);
  return { ok: true, matches: result };
}

/** Borra el resultado de un partido y saca al ganador del siguiente. */
export function clearResult(
  matches: BracketMatch[],
  key: string
): { ok: true; matches: BracketMatch[] } | { ok: false; error: ApplyError } {
  const m = matches.find((x) => x.key === key);
  if (!m) return { ok: false, error: "match_not_found" };
  const next = m.nextKey ? matches.find((x) => x.key === m.nextKey) : null;
  if (next && next.status === "played") {
    return { ok: false, error: "next_already_played" };
  }
  let result = setMatch(matches, key, { status: "pending", winner: null });
  result = placeInNext(result, key, null);
  return { ok: true, matches: result };
}

/** Campeón, si la final está jugada. */
export function champion(matches: BracketMatch[]): string | null {
  const final = matches.find((m) => m.nextKey === null);
  return final?.status === "played" ? final.winner : null;
}

/** Clave de traducción del nombre de ronda: final, semi, cuartos… */
export function roundLabelKey(
  round: number,
  totalRounds: number
): { key: "final" | "semifinal" | "quarterfinal" | "round_of"; size?: number } {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return { key: "final" };
  if (fromEnd === 1) return { key: "semifinal" };
  if (fromEnd === 2) return { key: "quarterfinal" };
  return { key: "round_of", size: 2 ** (fromEnd + 1) };
}

/** Fisher–Yates con generador inyectable (para tests). */
export function shuffle<T>(
  items: T[],
  random: () => number = Math.random
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Orden para el cuadro: primero las cabezas de serie (seed 1, 2…), después
 * el resto barajado.
 */
export function orderForDraw(
  entries: { id: string; seed: number | null }[],
  random: () => number = Math.random
): string[] {
  const seeded = entries
    .filter((e) => e.seed != null)
    .sort((x, y) => (x.seed ?? 0) - (y.seed ?? 0))
    .map((e) => e.id);
  const rest = shuffle(
    entries.filter((e) => e.seed == null).map((e) => e.id),
    random
  );
  return [...seeded, ...rest];
}
