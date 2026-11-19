// Circuito: puntos por torneo y clasificación general (decisión de David,
// 2026-11-19). Funciones puras. Cuentan solo los torneos finalizados del
// circuito; en dobles, cada jugador de la pareja suma los puntos.

import { normalizeEmail, normalizePhone } from "./entries";
import { computeStandings, type PlayedMatch } from "./round-robin";

export type KnockoutStage =
  | "winner"
  | "final"
  | "semifinal"
  | "quarterfinal"
  | "round_of_16"
  | "earlier";

export type PointsTable = {
  knockout: Record<KnockoutStage, number>;
  // Liguilla: puntos por puesto (1.º, 2.º…); más allá, `participation`.
  roundRobin: number[];
  // Mínimo por jugar el torneo.
  participation: number;
};

export const DEFAULT_POINTS: PointsTable = {
  knockout: {
    winner: 100,
    final: 70,
    semifinal: 50,
    quarterfinal: 35,
    round_of_16: 20,
    earlier: 10,
  },
  roundRobin: [100, 70, 50, 40, 30, 25, 20, 15, 10],
  participation: 5,
};

export type ResultMatch = {
  round: number;
  entryA: string | null;
  entryB: string | null;
  status: string; // pending | played | bye
  winner: string | null;
};

function stageForRound(round: number, totalRounds: number): KnockoutStage {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "final";
  if (fromEnd === 1) return "semifinal";
  if (fromEnd === 2) return "quarterfinal";
  if (fromEnd === 3) return "round_of_16";
  return "earlier";
}

/**
 * Hasta dónde llegó cada inscripción en una eliminatoria: la ronda en la
 * que perdió (también por walkover), o "winner" para el campeón. Quien no
 * perdió ningún partido jugado y no es campeón no aparece.
 */
export function knockoutStages(
  matches: ResultMatch[]
): Map<string, KnockoutStage> {
  const out = new Map<string, KnockoutStage>();
  if (!matches.length) return out;
  const totalRounds = Math.max(...matches.map((m) => m.round));
  for (const m of matches) {
    if (m.status !== "played" || !m.winner || !m.entryA || !m.entryB) continue;
    const loser = m.winner === m.entryA ? m.entryB : m.entryA;
    out.set(loser, stageForRound(m.round, totalRounds));
    if (m.round === totalRounds) out.set(m.winner, "winner");
  }
  return out;
}

/** Puntos de cada inscripción en un torneo. */
export function tournamentPoints(
  format: "knockout" | "round_robin",
  entryIds: string[],
  matches: (ResultMatch & Partial<Pick<PlayedMatch, "setsWon" | "games">>)[],
  table: PointsTable = DEFAULT_POINTS
): Map<string, number> {
  const out = new Map<string, number>(
    entryIds.map((id) => [id, table.participation])
  );
  if (format === "knockout") {
    for (const [id, stage] of knockoutStages(matches)) {
      if (out.has(id)) {
        out.set(id, Math.max(table.knockout[stage], table.participation));
      }
    }
    return out;
  }
  const standings = computeStandings(
    entryIds,
    matches
      .filter((m) => m.entryA && m.entryB)
      .map((m) => ({
        entryA: m.entryA!,
        entryB: m.entryB!,
        winner: m.status === "played" ? m.winner : null,
        setsWon: m.setsWon,
        games: m.games,
      }))
  );
  for (const row of standings) {
    const pts = table.roundRobin[row.position - 1] ?? table.participation;
    out.set(row.entry, Math.max(pts, table.participation));
  }
  return out;
}

export type PlayerIdentity = {
  studentId?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName: string;
  lastName?: string | null;
};

/**
 * Clave para reconocer al mismo jugador en distintos torneos: su ficha de
 * alumno, si no su correo, si no su teléfono y, como último recurso, el
 * nombre completo.
 */
export function playerKey(p: PlayerIdentity): string {
  if (p.studentId) return `s:${p.studentId}`;
  const email = normalizeEmail(p.email);
  if (email) return `e:${email}`;
  const phone = normalizePhone(p.phone);
  if (phone) return `p:${phone}`;
  const name = `${p.firstName} ${p.lastName ?? ""}`
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
  return `n:${name}`;
}

export type CircuitTournament = {
  id: string;
  format: "knockout" | "round_robin";
  entries: { id: string; players: { key: string; name: string }[] }[];
  matches: (ResultMatch & Partial<Pick<PlayedMatch, "setsWon" | "games">>)[];
};

export type CircuitRow = {
  key: string;
  name: string;
  points: number;
  tournaments: number;
  best: number;
  byTournament: Record<string, number>;
  position: number;
};

/**
 * Clasificación general: suma de puntos. Desempate: mejor resultado en un
 * torneo y después más torneos jugados; si siguen empatados comparten
 * puesto. Se ordenan los empatados por nombre.
 */
export function circuitStandings(
  tournaments: CircuitTournament[],
  table: PointsTable = DEFAULT_POINTS
): CircuitRow[] {
  const rows = new Map<string, Omit<CircuitRow, "position">>();
  for (const t of tournaments) {
    const pts = tournamentPoints(
      t.format,
      t.entries.map((e) => e.id),
      t.matches,
      table
    );
    for (const e of t.entries) {
      const p = pts.get(e.id) ?? 0;
      for (const player of e.players) {
        const row = rows.get(player.key) ?? {
          key: player.key,
          name: player.name,
          points: 0,
          tournaments: 0,
          best: 0,
          byTournament: {},
        };
        // Un jugador cuenta una vez por torneo (aunque aparezca dos veces).
        if (row.byTournament[t.id] !== undefined) continue;
        row.byTournament[t.id] = p;
        row.points += p;
        row.tournaments += 1;
        row.best = Math.max(row.best, p);
        row.name = player.name;
        rows.set(player.key, row);
      }
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.best - a.best ||
      b.tournaments - a.tournaments ||
      a.name.localeCompare(b.name, "es")
  );
  let position = 0;
  let prev = "";
  return sorted.map((r, i) => {
    const tie = `${r.points}|${r.best}|${r.tournaments}`;
    if (tie !== prev) position = i + 1;
    prev = tie;
    return { ...r, position };
  });
}
