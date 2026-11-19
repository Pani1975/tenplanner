// Liguilla (todos contra todos): calendario por jornadas y clasificación.
// Funciones puras.

import type { PointsScore } from "./score";

export type RoundRobinPairing = {
  round: number; // jornada, desde 1
  position: number; // orden en la jornada, desde 1
  entryA: string;
  entryB: string;
};

/**
 * Calendario por el método del círculo: cada uno juega una vez contra cada
 * otro, como mucho un partido por jornada. Con número impar, en cada
 * jornada descansa uno.
 */
export function generateRoundRobin(entries: string[]): RoundRobinPairing[] {
  if (entries.length < 2) throw new Error("min_two_entries");
  if (new Set(entries).size !== entries.length) {
    throw new Error("duplicate_entries");
  }
  const list: (string | null)[] = [...entries];
  if (list.length % 2 === 1) list.push(null); // descanso
  const n = list.length;
  const out: RoundRobinPairing[] = [];

  for (let r = 0; r < n - 1; r++) {
    let position = 0;
    for (let i = 0; i < n / 2; i++) {
      const x = list[i];
      const y = list[n - 1 - i];
      if (x === null || y === null) continue;
      position += 1;
      // Alternar el lado del fijo para repartir quién va "primero".
      const swap = i === 0 && r % 2 === 1;
      out.push({
        round: r + 1,
        position,
        entryA: swap ? y : x,
        entryB: swap ? x : y,
      });
    }
    // Rotar todos menos el primero.
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop()!);
    list.splice(0, n, fixed, ...rest);
  }
  return out;
}

export type PlayedMatch = {
  entryA: string;
  entryB: string;
  winner: string | null; // null = sin jugar
  setsWon?: PointsScore; // desde el lado de A
  games?: PointsScore;
};

export type StandingRow = {
  entry: string;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  position: number; // 1 = primero; empatados del todo comparten puesto
};

type Acc = Omit<StandingRow, "position">;

function emptyRow(entry: string): Acc {
  return {
    entry,
    played: 0,
    won: 0,
    lost: 0,
    setsFor: 0,
    setsAgainst: 0,
    gamesFor: 0,
    gamesAgainst: 0,
  };
}

function accumulate(entries: string[], matches: PlayedMatch[]) {
  const rows = new Map(entries.map((e) => [e, emptyRow(e)]));
  for (const m of matches) {
    if (!m.winner) continue;
    const a = rows.get(m.entryA);
    const b = rows.get(m.entryB);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    const winner = m.winner === m.entryA ? a : b;
    const loser = winner === a ? b : a;
    winner.won += 1;
    loser.lost += 1;
    const s = m.setsWon ?? { a: 0, b: 0 };
    const g = m.games ?? { a: 0, b: 0 };
    a.setsFor += s.a;
    a.setsAgainst += s.b;
    b.setsFor += s.b;
    b.setsAgainst += s.a;
    a.gamesFor += g.a;
    a.gamesAgainst += g.b;
    b.gamesFor += g.b;
    b.gamesAgainst += g.a;
  }
  return rows;
}

const diff = (f: number, a: number) => f - a;

/**
 * Clasificación. Criterios, en orden:
 *  1. partidos ganados;
 *  2. entre los empatados: partidos ganados entre ellos (enfrentamiento
 *     directo si son dos);
 *  3. diferencia de sets; 4. diferencia de juegos (en todos los partidos).
 * Si siguen empatados comparten puesto y se ordenan por el orden de entrada.
 * Walkover: cuenta como victoria, sin sets ni juegos.
 */
export function computeStandings(
  entries: string[],
  matches: PlayedMatch[]
): StandingRow[] {
  const rows = accumulate(entries, matches);
  const order = new Map(entries.map((e, i) => [e, i]));

  // Agrupar por victorias y desempatar cada grupo.
  const byWins = new Map<number, Acc[]>();
  for (const r of rows.values()) {
    const list = byWins.get(r.won) ?? [];
    list.push(r);
    byWins.set(r.won, list);
  }

  const sorted: { row: Acc; tieKey: string }[] = [];
  for (const wins of [...byWins.keys()].sort((x, y) => y - x)) {
    const group = byWins.get(wins)!;
    if (group.length === 1) {
      sorted.push({ row: group[0], tieKey: `${wins}` });
      continue;
    }
    const ids = new Set(group.map((r) => r.entry));
    const mini = accumulate(
      [...ids],
      matches.filter((m) => ids.has(m.entryA) && ids.has(m.entryB))
    );
    const key = (r: Acc) => {
      const h = mini.get(r.entry)!.won;
      return [
        h,
        diff(r.setsFor, r.setsAgainst),
        diff(r.gamesFor, r.gamesAgainst),
      ];
    };
    group
      .sort((x, y) => {
        const kx = key(x);
        const ky = key(y);
        for (let i = 0; i < kx.length; i++) {
          if (kx[i] !== ky[i]) return ky[i] - kx[i];
        }
        return order.get(x.entry)! - order.get(y.entry)!;
      })
      .forEach((r) => sorted.push({ row: r, tieKey: `${wins}|${key(r)}` }));
  }

  let position = 0;
  let prevKey: string | null = null;
  return sorted.map(({ row, tieKey }, i) => {
    if (tieKey !== prevKey) position = i + 1;
    prevKey = tieKey;
    return { ...row, position };
  });
}

/** Partidos totales de una liguilla de n participantes. */
export const roundRobinMatchCount = (n: number) => (n * (n - 1)) / 2;
