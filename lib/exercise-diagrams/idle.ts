import { buildTimeline } from "./animate";
import type { ChoreoStep, Diagram, DiagramElement, Pt } from "./types";

/**
 * Algunos esquemas solo dibujan la organización (jugadores colocados, sin
 * flechas ni coreografía) y en la animación de la clase se quedaban quietos.
 * Esto les da un movimiento básico y creíble a partir de quién hay:
 *  - alumno contra rival → pelotean entre ellos;
 *  - monitor y alumnos → el monitor les lanza por turnos y devuelven;
 *  - varios alumnos → se pasan la pelota con un bote, en rueda;
 *  - un solo jugador → se desplaza por su zona.
 * Los esquemas que ya se mueven se devuelven tal cual.
 */
type Player = Extract<DiagramElement, { t: "player" }>;

/** Bola de `a` a `b` con un bote en el último tercio. */
function shot(a: Pt, b: Pt): { path: Pt[]; bounces: number[] } {
  const bounce: Pt = [a[0] + (b[0] - a[0]) * 0.7, a[1] + (b[1] - a[1]) * 0.7];
  return { path: [a, bounce, b], bounces: [1] };
}

/** Pequeño desplazamiento para "prepararse" junto a su sitio. */
function step(p: Pt, dx: number, dy: number): Pt[] {
  return [p, [p[0] + dx, p[1] + dy], p];
}

export function withIdleMotion(diagram: Diagram): Diagram {
  if (buildTimeline(diagram).steps.length > 0) return diagram;
  const players = diagram.elements.filter((e): e is Player => e.t === "player");
  if (players.length === 0) return diagram;

  const idx = (p: Player) => players.indexOf(p);
  const role = (p: Player) => p.role ?? "alumno";
  const coach = players.find((p) => role(p) === "monitor");
  const students = players.filter((p) => role(p) === "alumno");
  const rivals = players.filter((p) => role(p) === "rival");
  const steps: ChoreoStep[] = [];

  if (students.length > 0 && rivals.length > 0) {
    // Peloteo/puntos entre los dos lados (en dobles, se turnan las parejas).
    const pairs = Math.max(1, Math.min(students.length, rivals.length));
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < pairs; k++) {
        const a = students[k];
        const b = rivals[k];
        steps.push({ ball: shot(a.at, b.at), swing: idx(a) });
        steps.push({
          ball: shot(b.at, a.at),
          swing: idx(b),
          moves: [{ who: idx(a), path: step(a.at, 3, 0) }],
        });
      }
    }
  } else if (coach && students.length > 0) {
    // El monitor lanza a cada alumno y este devuelve.
    for (const s of students.slice(0, 4)) {
      steps.push({ ball: shot(coach.at, s.at), swing: idx(coach) });
      steps.push({
        ball: shot(s.at, coach.at),
        swing: idx(s),
        moves: [{ who: idx(s), path: step(s.at, 0, -3) }],
      });
    }
  } else if (players.length >= 2) {
    // Rueda de pases con bote entre los jugadores.
    const ring = players.slice(0, 6);
    ring.forEach((p, i) => {
      const next = ring[(i + 1) % ring.length];
      steps.push({ ball: shot(p.at, next.at), swing: i });
    });
  } else {
    // Un solo jugador: recorre su zona.
    const p = players[0].at;
    const r = 10;
    steps.push({
      moves: [
        {
          who: 0,
          path: [
            p,
            [p[0] + r, p[1]],
            [p[0] + r, p[1] + r],
            [p[0], p[1] + r],
            p,
          ],
        },
      ],
      dur: 3,
    });
  }

  // Si hay más gente sin papel en la coreografía, se mueve un poco en cada
  // paso para que no parezca congelada.
  const busy = new Set(
    steps.flatMap((s) => [
      ...(s.swing !== undefined ? [s.swing] : []),
      ...(s.moves ?? []).map((m) => m.who),
    ])
  );
  steps.forEach((s, i) => {
    const extra = players
      .map((p, j) => ({ p, j }))
      .filter(({ j }) => !busy.has(j))
      .slice(0, 8 - (s.moves?.length ?? 0))
      .map(({ p, j }) => ({
        who: j,
        path: step(p.at, i % 2 === 0 ? 2.5 : -2.5, 0),
      }));
    if (extra.length) s.moves = [...(s.moves ?? []), ...extra];
  });

  return { ...diagram, choreo: { steps } };
}
