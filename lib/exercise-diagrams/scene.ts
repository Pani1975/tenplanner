import type { CourtKind, Diagram, DiagramElement, Pt } from "./types";

/**
 * Convierte un esquema en primitivas de dibujo simples (rectángulos, líneas,
 * círculos, polígonos y texto). Los dos dibujantes (web y PDF) solo traducen
 * estas primitivas, así que el esquema se ve igual en pantalla y en papel.
 */
export type Prim =
  | {
      k: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      stroke?: string;
      sw?: number;
      dash?: string;
      rx?: number;
    }
  | {
      k: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      sw: number;
      dash?: string;
    }
  | {
      k: "polyline";
      points: string;
      stroke: string;
      sw: number;
      dash?: string;
    }
  | {
      k: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string;
      sw?: number;
    }
  | {
      k: "poly";
      points: string;
      fill?: string;
      stroke?: string;
      sw?: number;
    }
  | {
      k: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      anchor?: "start" | "middle" | "end";
      weight?: "bold" | "normal";
    };

export type Scene = { width: number; height: number; prims: Prim[] };

export const COLORS = {
  floor: "#EEF4EA",
  floorLibre: "#F3F4EE",
  line: "#7C8F7A",
  net: "#3F4A3F",
  alumno: "#2563EB",
  monitor: "#111111",
  rival: "#EA580C",
  ball: "#FACC15",
  ballStroke: "#854D0E",
  cone: "#F97316",
  hoop: "#7C3AED",
  basket: "#0F766E",
  ladder: "#475569",
  zoneFill: "#E6F6B0",
  zoneStroke: "#65A30D",
  move: "#1F2937",
  shot: "#B45309",
  text: "#1F2937",
} as const;

const PAD = 17; // margen alrededor de la pista (unidades de dibujo)

type Frame = { cw: number; ch: number };

// Tamaño de la zona de juego en unidades de dibujo (x e y se escalan solos).
function frameFor(court: CourtKind): Frame {
  switch (court) {
    case "tenis":
      return { cw: 100, ch: 217 };
    case "medio":
      return { cw: 100, ch: 108 };
    case "mini":
      return { cw: 100, ch: 200 };
    default:
      return { cw: 100, ch: 100 };
  }
}

function num(n: number) {
  return Math.round(n * 100) / 100;
}

function clampPt(p: Pt): Pt {
  const f = (v: number) =>
    Number.isFinite(v) ? Math.max(-30, Math.min(130, v)) : 0;
  return [f(p[0]), f(p[1])];
}

function arrowHead(from: Pt, to: Pt, size: number): string {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const a1 = ang + Math.PI - 0.45;
  const a2 = ang + Math.PI + 0.45;
  const p1 = [to[0] + size * Math.cos(a1), to[1] + size * Math.sin(a1)];
  const p2 = [to[0] + size * Math.cos(a2), to[1] + size * Math.sin(a2)];
  return `${num(to[0])},${num(to[1])} ${num(p1[0])},${num(p1[1])} ${num(p2[0])},${num(p2[1])}`;
}

/** Pasa coordenadas del esquema (0-100) a las de dibujo de `buildScene`. */
export function projector(court: CourtKind) {
  const { cw, ch } = frameFor(court);
  return {
    width: num(cw + PAD * 2),
    height: num(ch + PAD * 2),
    point: (p: Pt): Pt => {
      const c = clampPt(p);
      return [PAD + (c[0] / 100) * cw, PAD + (c[1] / 100) * ch];
    },
  };
}

export function buildScene(diagram: Diagram): Scene {
  const { cw, ch } = frameFor(diagram.court);
  const width = cw + PAD * 2;
  const height = ch + PAD * 2;
  const prims: Prim[] = [];

  const X = (x: number) => PAD + (x / 100) * cw;
  const Y = (y: number) => PAD + (y / 100) * ch;
  const P = (p: Pt): Pt => {
    const c = clampPt(p);
    return [X(c[0]), Y(c[1])];
  };
  const line = (
    a: Pt,
    b: Pt,
    stroke: string = COLORS.line,
    sw = 1,
    dash?: string
  ) =>
    prims.push({
      k: "line",
      x1: num(a[0]),
      y1: num(a[1]),
      x2: num(b[0]),
      y2: num(b[1]),
      stroke,
      sw,
      dash,
    });

  // Suelo
  prims.push({
    k: "rect",
    x: 0,
    y: 0,
    w: width,
    h: height,
    fill: diagram.court === "libre" ? COLORS.floorLibre : COLORS.floor,
    rx: 6,
  });

  // Pista
  if (diagram.court === "libre") {
    prims.push({
      k: "rect",
      x: PAD,
      y: PAD,
      w: cw,
      h: ch,
      stroke: COLORS.line,
      sw: 1,
      dash: "4 3",
    });
  } else {
    prims.push({
      k: "rect",
      x: PAD,
      y: PAD,
      w: cw,
      h: ch,
      fill: "#FFFFFF",
      stroke: COLORS.line,
      sw: 1.2,
    });
    if (diagram.court === "tenis") {
      line([X(12.5), Y(0)], [X(12.5), Y(100)]);
      line([X(87.5), Y(0)], [X(87.5), Y(100)]);
      line([X(12.5), Y(23)], [X(87.5), Y(23)]);
      line([X(12.5), Y(77)], [X(87.5), Y(77)]);
      line([X(50), Y(23)], [X(50), Y(77)]);
    } else if (diagram.court === "medio") {
      line([X(12.5), Y(0)], [X(12.5), Y(100)]);
      line([X(87.5), Y(0)], [X(87.5), Y(100)]);
      line([X(12.5), Y(54)], [X(87.5), Y(54)]);
      line([X(50), Y(0)], [X(50), Y(54)]);
    }
    // Red
    const netY = diagram.court === "medio" ? Y(0) : Y(50);
    line([X(-4), netY], [X(104), netY], COLORS.net, 2.2);
  }

  const R = 5.2; // radio del jugador
  const draw = (el: DiagramElement) => {
    switch (el.t) {
      case "zone": {
        const a = P(el.from);
        const b = P(el.to);
        const x = Math.min(a[0], b[0]);
        const y = Math.min(a[1], b[1]);
        prims.push({
          k: "rect",
          x: num(x),
          y: num(y),
          w: num(Math.abs(b[0] - a[0])),
          h: num(Math.abs(b[1] - a[1])),
          fill: COLORS.zoneFill,
          stroke: COLORS.zoneStroke,
          sw: 1,
          dash: "3 2",
        });
        if (el.label) {
          prims.push({
            k: "text",
            x: num(x + Math.abs(b[0] - a[0]) / 2),
            y: num(y + Math.abs(b[1] - a[1]) / 2 + 2.5),
            text: el.label,
            // Reduce el texto si la zona es estrecha (≈0,55 de ancho por letra).
            size: num(
              Math.max(
                3.8,
                Math.min(
                  7,
                  (Math.abs(b[0] - a[0]) - 2) / (el.label.length * 0.58)
                )
              )
            ),
            fill: COLORS.zoneStroke,
            anchor: "middle",
            weight: "bold",
          });
        }
        break;
      }
      case "line":
        line(
          P(el.from),
          P(el.to),
          COLORS.ladder,
          1.4,
          el.dashed ? "3 2" : undefined
        );
        break;
      case "ladder": {
        const a = P(el.from);
        const b = P(el.to);
        line(a, b, COLORS.ladder, 1);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(3, Math.min(8, Math.round(len / 7)));
        const dx = (b[0] - a[0]) / len;
        const dy = (b[1] - a[1]) / len;
        const nx = -dy * 5;
        const ny = dx * 5;
        for (let i = 0; i <= n; i++) {
          const cx = a[0] + ((b[0] - a[0]) * i) / n;
          const cy = a[1] + ((b[1] - a[1]) * i) / n;
          line([cx - nx, cy - ny], [cx + nx, cy + ny], COLORS.ladder, 1.2);
        }
        line(
          [a[0] - nx, a[1] - ny],
          [b[0] - nx, b[1] - ny],
          COLORS.ladder,
          1.2
        );
        line(
          [a[0] + nx, a[1] + ny],
          [b[0] + nx, b[1] + ny],
          COLORS.ladder,
          1.2
        );
        break;
      }
      case "hoop": {
        const [cx, cy] = P(el.at);
        prims.push({
          k: "circle",
          cx: num(cx),
          cy: num(cy),
          r: 5.5,
          stroke: COLORS.hoop,
          sw: 1.8,
        });
        break;
      }
      case "cone": {
        const [cx, cy] = P(el.at);
        prims.push({
          k: "poly",
          points: `${num(cx)},${num(cy - 4.5)} ${num(cx - 4)},${num(cy + 3.5)} ${num(cx + 4)},${num(cy + 3.5)}`,
          fill: COLORS.cone,
          stroke: "#9A3412",
          sw: 0.6,
        });
        break;
      }
      case "basket": {
        const [cx, cy] = P(el.at);
        prims.push({
          k: "rect",
          x: num(cx - 5),
          y: num(cy - 4),
          w: 10,
          h: 8,
          fill: "#CCFBF1",
          stroke: COLORS.basket,
          sw: 1.2,
          rx: 1.5,
        });
        prims.push({
          k: "circle",
          cx: num(cx - 1.8),
          cy: num(cy - 0.5),
          r: 1.6,
          fill: COLORS.ball,
          stroke: COLORS.ballStroke,
          sw: 0.4,
        });
        prims.push({
          k: "circle",
          cx: num(cx + 1.8),
          cy: num(cy + 0.9),
          r: 1.6,
          fill: COLORS.ball,
          stroke: COLORS.ballStroke,
          sw: 0.4,
        });
        break;
      }
      case "ball": {
        const [cx, cy] = P(el.at);
        prims.push({
          k: "circle",
          cx: num(cx),
          cy: num(cy),
          r: 2.6,
          fill: COLORS.ball,
          stroke: COLORS.ballStroke,
          sw: 0.7,
        });
        break;
      }
      case "player": {
        const [cx, cy] = P(el.at);
        const fill = COLORS[el.role ?? "alumno"];
        prims.push({
          k: "circle",
          cx: num(cx),
          cy: num(cy),
          r: R,
          fill,
          stroke: "#FFFFFF",
          sw: 1,
        });
        if (el.label) {
          prims.push({
            k: "text",
            x: num(cx),
            y: num(cy + 2.4),
            text: el.label.slice(0, 2),
            size: 6.5,
            fill: "#FFFFFF",
            anchor: "middle",
            weight: "bold",
          });
        }
        break;
      }
      case "move":
      case "shot": {
        const pts = el.points.map(P);
        if (pts.length < 2) break;
        const isShot = el.t === "shot";
        const stroke = isShot ? COLORS.shot : COLORS.move;
        const dash = isShot ? "4 3" : undefined;
        prims.push({
          k: "polyline",
          points: pts.map((p) => `${num(p[0])},${num(p[1])}`).join(" "),
          stroke,
          sw: isShot ? 1.5 : 1.7,
          dash,
        });
        prims.push({
          k: "poly",
          points: arrowHead(pts[pts.length - 2], pts[pts.length - 1], 5),
          fill: stroke,
        });
        break;
      }
      case "text": {
        const [x, y] = P(el.at);
        prims.push({
          k: "text",
          x: num(x),
          y: num(y),
          text: el.text.slice(0, 18),
          size: 7,
          fill: COLORS.text,
          anchor: "middle",
          weight: "bold",
        });
        break;
      }
    }
  };

  // Orden de dibujo: zonas y marcas debajo, después material, luego
  // jugadores, y encima flechas y textos.
  const order = (el: DiagramElement) =>
    el.t === "zone"
      ? 0
      : el.t === "line" || el.t === "ladder"
        ? 1
        : el.t === "hoop" || el.t === "cone" || el.t === "basket"
          ? 2
          : el.t === "move" || el.t === "shot"
            ? 3
            : el.t === "ball"
              ? 4
              : el.t === "player"
                ? 5
                : 6;
  [...diagram.elements]
    .map((el, i) => ({ el, i }))
    .sort((a, b) => order(a.el) - order(b.el) || a.i - b.i)
    .forEach(({ el }) => draw(el));

  return { width: num(width), height: num(height), prims };
}
