import type { Diagram, DiagramElement, Pt } from "./types";

/**
 * Línea de tiempo de la animación de un esquema. Es una función pura: dado un
 * esquema devuelve los pasos, y `sampleTimeline` dice dónde está cada cosa en
 * un instante. El componente solo dibuja lo que esta lógica calcula.
 */

export type TimelineStep = {
  t0: number;
  t1: number;
  text?: string;
  moves: { who: number; path: Pt[] }[];
  ball?: { path: Pt[]; bounces: number[] };
  /** Jugador que golpea al empezar el paso. */
  swing?: number;
  /** Conos que derriba la pelota al acabar el paso (nº de cono). */
  knock?: number[];
};

export type Timeline = {
  duration: number;
  steps: TimelineStep[];
  players: {
    start: Pt;
    role: "alumno" | "monitor" | "rival";
    label?: string;
  }[];
  /** Dónde está la pelota antes del primer vuelo (null = no se ve). */
  ballStart: Pt | null;
  /** true si el esquema trae coreografía propia (animación "currada"). */
  premium: boolean;
};

export type Sample = {
  stepIndex: number;
  players: Pt[];
  ball: { at: Pt; height: number } | null;
  /** Anillo de golpe: posición y progreso 0-1. */
  hit: { at: Pt; progress: number; who: number } | null;
  /** Conos derribados: nº de cono → progreso de la caída (0-1). */
  fallen: Record<number, number>;
};

const HOLD_END = 1.2;
const HIT_SECONDS = 0.45;
const BALL_SPEED = 62; // unidades de esquema por segundo
const MOVE_SPEED = 34;

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function pathLength(path: Pt[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += dist(path[i - 1], path[i]);
  return len;
}

/** Punto a la fracción `u` (0-1) de la longitud de una poligonal. */
export function pointAt(path: Pt[], u: number): Pt {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];
  const total = pathLength(path);
  if (total === 0) return path[0];
  let target = Math.max(0, Math.min(1, u)) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (target <= seg || i === path.length - 1) {
      const f = seg === 0 ? 0 : Math.min(1, target / seg);
      return [
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f,
      ];
    }
    target -= seg;
  }
  return path[path.length - 1];
}

/** Suaviza una poligonal con una curva (Catmull-Rom) que pasa por sus puntos. */
export function smoothPath(path: Pt[], samples = 8): Pt[] {
  if (path.length < 3) return path;
  const out: Pt[] = [path[0]];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[i];
    const p2 = path[i + 1];
    const p3 = path[Math.min(path.length - 1, i + 2)];
    for (let s = 1; s <= samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * t +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

const easeInOut = (u: number) =>
  0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));

function isPlayer(
  el: DiagramElement
): el is Extract<DiagramElement, { t: "player" }> {
  return el.t === "player";
}

function nearestPlayer(players: Pt[], to: Pt): number {
  let best = -1;
  let bestD = Infinity;
  players.forEach((p, i) => {
    const d = dist(p, to);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

type RawStep = Omit<TimelineStep, "t0" | "t1"> & { dur?: number };

/** Pasos deducidos de los elementos cuando no hay coreografía. */
function autoSteps(diagram: Diagram, starts: Pt[]): RawStep[] {
  const steps: RawStep[] = [];
  const pos = starts.map((p) => p);
  for (const el of diagram.elements) {
    if (el.t === "shot") {
      const first = el.points[0];
      const who = nearestPlayer(pos, first);
      steps.push({
        moves: [],
        ball: { path: el.points, bounces: [] },
        swing: who >= 0 && dist(pos[who], first) <= 16 ? who : undefined,
      });
    } else if (el.t === "move") {
      const who = nearestPlayer(pos, el.points[0]);
      if (who < 0) continue;
      const last = steps[steps.length - 1];
      if (last?.ball && !last.moves.some((m) => m.who === who)) {
        last.moves.push({ who, path: el.points });
      } else {
        steps.push({ moves: [{ who, path: el.points }] });
      }
      pos[who] = el.points[el.points.length - 1];
    }
  }
  return steps;
}

export function buildTimeline(diagram: Diagram): Timeline {
  const playerEls = diagram.elements.filter(isPlayer);
  const players = playerEls.map((p) => ({
    start: p.at,
    role: p.role ?? "alumno",
    label: p.label,
  }));
  const starts = players.map((p) => p.start);
  const premium = !!diagram.choreo;

  const raw: RawStep[] = diagram.choreo
    ? diagram.choreo.steps.map((s) => ({
        text: s.text,
        dur: s.dur,
        moves: (s.moves ?? []).filter((m) => m.who < players.length),
        ball: s.ball
          ? { path: s.ball.path, bounces: s.ball.bounces ?? [] }
          : undefined,
        swing:
          s.swing !== undefined && s.swing < players.length
            ? s.swing
            : undefined,
        knock: s.knock,
      }))
    : autoSteps(diagram, starts);

  let t = 0;
  const steps: TimelineStep[] = raw.map((s) => {
    const ballLen = s.ball ? pathLength(s.ball.path) : 0;
    const moveLen = Math.max(0, ...s.moves.map((m) => pathLength(m.path)));
    const dur =
      s.dur ?? Math.max(0.9, ballLen / BALL_SPEED, moveLen / MOVE_SPEED);
    const step: TimelineStep = {
      t0: t,
      t1: t + dur,
      text: s.text,
      moves: s.moves,
      ball: s.ball,
      swing: s.swing,
      knock: s.knock,
    };
    t += dur;
    return step;
  });

  const ballEl = diagram.elements.find((e) => e.t === "ball");
  const firstBall = steps.find((s) => s.ball)?.ball?.path[0] ?? null;
  const ballStart = ballEl && ballEl.t === "ball" ? ballEl.at : firstBall;

  return { duration: t + HOLD_END, steps, players, ballStart, premium };
}

/** Altura (unidades de esquema) de la pelota a lo largo de un vuelo. */
function flightHeight(path: Pt[], bounces: number[], u: number): number {
  const total = pathLength(path);
  if (total === 0) return 0;
  // Puntos de contacto con el suelo/raqueta: inicio, botes y final.
  const contacts = [
    0,
    ...bounces
      .filter((b) => b > 0 && b < path.length - 1)
      .sort((a, b) => a - b),
    path.length - 1,
  ];
  const at = contacts.map((idx) => pathLength(path.slice(0, idx + 1)) / total);
  for (let i = 1; i < at.length; i++) {
    if (u <= at[i] || i === at.length - 1) {
      const span = at[i] - at[i - 1];
      const s =
        span <= 0 ? 0 : Math.max(0, Math.min(1, (u - at[i - 1]) / span));
      const flightLen = span * total;
      const peak = Math.min(14, 3 + flightLen * 0.12);
      return 4 * peak * s * (1 - s);
    }
  }
  return 0;
}

export function sampleTimeline(tl: Timeline, time: number): Sample {
  const t = Math.max(0, Math.min(tl.duration, time));
  let idx = tl.steps.findIndex((s) => t >= s.t0 && t < s.t1);
  const finished = idx === -1;
  if (finished) idx = tl.steps.length - 1;

  const players: Pt[] = tl.players.map((p) => p.start);
  let ball: Sample["ball"] = tl.ballStart
    ? { at: tl.ballStart, height: 0 }
    : null;
  let hit: Sample["hit"] = null;
  const fallen: Sample["fallen"] = {};

  tl.steps.forEach((s, i) => {
    const done = finished || i < idx;
    const active = !finished && i === idx;
    if (!done && !active) return;
    const u = done ? 1 : (t - s.t0) / (s.t1 - s.t0);
    for (const m of s.moves) {
      const path = tl.premium ? smoothPath(m.path) : m.path;
      players[m.who] = pointAt(path, easeInOut(u));
    }
    if (s.ball) {
      const path = s.ball.path;
      ball = {
        at: pointAt(path, u),
        height: done ? 0 : flightHeight(path, s.ball.bounces, u),
      };
    }
    for (const cone of s.knock ?? []) {
      // Caen cuando la pelota llega al final de su recorrido.
      const k = done ? 1 : Math.max(0, Math.min(1, (u - 0.75) / 0.25));
      fallen[cone] = Math.max(fallen[cone] ?? 0, k);
    }
    if (active && s.swing !== undefined && t - s.t0 < HIT_SECONDS) {
      hit = {
        at: players[s.swing],
        progress: (t - s.t0) / HIT_SECONDS,
        who: s.swing,
      };
    }
  });

  return { stepIndex: idx, players, ball, hit, fallen };
}

/** Posiciones recientes de la pelota (para dibujar la estela), de más a menos nueva. */
export function ballTrail(
  tl: Timeline,
  time: number,
  count = 5,
  gap = 0.05
): Pt[] {
  const out: Pt[] = [];
  for (let k = 1; k <= count; k++) {
    const s = sampleTimeline(tl, time - k * gap);
    if (s.ball) out.push(s.ball.at);
  }
  return out;
}
