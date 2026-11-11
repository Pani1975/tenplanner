"use client";

import {
  ballTrail,
  buildTimeline,
  pathLength,
  sampleTimeline,
} from "@/lib/exercise-diagrams/animate";
import { withIdleMotion } from "@/lib/exercise-diagrams/idle";
import type { Diagram, Pt } from "@/lib/exercise-diagrams/types";
import { courtPoint } from "@/lib/classes/court-geometry";
import {
  BallMarker,
  COLORS,
  CoachMarker,
  ConeMarker,
  STUDENT_R,
  StudentMarker,
  W,
} from "@/components/app/class-court";

// Esquema con movimiento garantizado y su línea de tiempo, calculados una vez.
const prepared = new WeakMap<
  Diagram,
  { diagram: Diagram; timeline: ReturnType<typeof buildTimeline> }
>();
function prepare(source: Diagram) {
  let hit = prepared.get(source);
  if (!hit) {
    const diagram = withIdleMotion(source);
    hit = { diagram, timeline: buildTimeline(diagram) };
    prepared.set(source, hit);
  }
  return hit;
}

/** Altura de la pelota del esquema → píxeles de la pista. */
const HEIGHT_PX = 1.8;

/**
 * Capa SVG con el esquema animado de un ejercicio en el instante `time`
 * (segundos desde que empieza la actividad), dibujada con las mismas fichas
 * que las escenas genéricas. Va dentro del `<svg>` de la pista. Se repite en
 * bucle mientras dura la actividad.
 */
export function DiagramLayer({
  diagram: source,
  time,
  ballColor,
}: {
  diagram: Diagram;
  time: number;
  ballColor: string;
}) {
  const { diagram, timeline } = prepare(source);
  const P = (p: Pt) => courtPoint(diagram.court, p);

  const local =
    timeline.duration > 0 ? Math.max(0, time) % timeline.duration : 0;
  const sample = sampleTimeline(timeline, local);
  const trail = local > 0 ? ballTrail(timeline, local) : [];
  const knocked = new Set(timeline.steps.flatMap((s) => s.knock ?? []));
  const guides = timeline.steps.filter(
    (s) => s.ball && pathLength(s.ball.path) > 0
  );
  const hasFlights = guides.length > 0;

  // Números de los alumnos sin etiqueta propia (1, 2, 3…).
  let n = 0;
  const labels = timeline.players.map((pl) =>
    pl.role === "alumno" ? (pl.label ?? String(++n)) : pl.label
  );

  let cone = -1;
  let ballEl = -1;
  return (
    <g>
      {/* Material y marcas, debajo de los jugadores */}
      {diagram.elements.map((el, i) => {
        switch (el.t) {
          case "zone": {
            const a = P(el.from);
            const b = P(el.to);
            const x = Math.min(a.x, b.x);
            const y = Math.min(a.y, b.y);
            const w = Math.abs(b.x - a.x);
            const h = Math.abs(b.y - a.y);
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="#D6FF38"
                  fillOpacity={0.16}
                  stroke="#D6FF38"
                  strokeOpacity={0.7}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
                {el.label && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 3}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={700}
                    fill="#D6FF38"
                  >
                    {el.label}
                  </text>
                )}
              </g>
            );
          }
          case "line": {
            const a = P(el.from);
            const b = P(el.to);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#E5EEF8"
                strokeOpacity={0.8}
                strokeWidth={1.5}
                strokeDasharray={el.dashed ? "3 2" : undefined}
              />
            );
          }
          case "ladder": {
            const a = P(el.from);
            const b = P(el.to);
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const nx = (-(b.y - a.y) / len) * 6;
            const ny = ((b.x - a.x) / len) * 6;
            const rungs = Math.max(3, Math.min(10, Math.round(len / 10)));
            return (
              <g
                key={i}
                stroke="#E5EEF8"
                strokeOpacity={0.85}
                strokeWidth={1.2}
              >
                <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} />
                <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} />
                {Array.from({ length: rungs + 1 }, (_, k) => {
                  const cx = a.x + ((b.x - a.x) * k) / rungs;
                  const cy = a.y + ((b.y - a.y) * k) / rungs;
                  return (
                    <line
                      key={k}
                      x1={cx - nx}
                      y1={cy - ny}
                      x2={cx + nx}
                      y2={cy + ny}
                    />
                  );
                })}
              </g>
            );
          }
          case "hoop": {
            const c = P(el.at);
            return (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={8}
                fill="none"
                stroke={COLORS.ring}
                strokeWidth={2}
              />
            );
          }
          case "cone": {
            cone += 1;
            const c = P(el.at);
            if (!knocked.has(cone))
              return <ConeMarker key={i} x={c.x} y={c.y} />;
            const k = sample.fallen[cone] ?? 0;
            const dir = cone % 2 === 0 ? 1 : -1;
            return (
              <g
                key={i}
                transform={`rotate(${dir * 90 * k} ${c.x} ${c.y + 5})`}
                opacity={1 - 0.25 * k}
              >
                <ConeMarker x={c.x} y={c.y} />
              </g>
            );
          }
          case "basket": {
            const c = P(el.at);
            return (
              <g key={i}>
                <rect
                  x={c.x - 8}
                  y={c.y - 6}
                  width={16}
                  height={12}
                  rx={2}
                  fill="#0F766E"
                  stroke="#CCFBF1"
                  strokeWidth={1}
                />
                <circle cx={c.x - 3} cy={c.y - 1} r={3} fill={ballColor} />
                <circle cx={c.x + 3} cy={c.y + 1.5} r={3} fill={ballColor} />
              </g>
            );
          }
          case "ball": {
            ballEl += 1;
            // La primera pelota es la que se anima (si hay vuelos).
            if (ballEl === 0 && (hasFlights || timeline.ballStart)) return null;
            const c = P(el.at);
            return (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={3.5}
                fill={ballColor}
                stroke="#fff"
                strokeWidth={0.8}
              />
            );
          }
          case "text": {
            const c = P(el.at);
            const label = el.text.slice(0, 18);
            // Que el texto quepa entero dentro de la pista dibujada.
            const half = label.length * 2.3 + 3;
            const x = Math.max(half, Math.min(W - half, c.x));
            return (
              <text
                key={i}
                x={x}
                y={c.y}
                textAnchor="middle"
                fontSize={8}
                fontWeight={700}
                fill="#F4F4F1"
                stroke={COLORS.ink}
                strokeWidth={0.5}
                paintOrder="stroke"
              >
                {label}
              </text>
            );
          }
          default:
            return null;
        }
      })}

      {/* Guías tenues de las trayectorias de la pelota */}
      {guides.map((s, i) => (
        <polyline
          key={`g${i}`}
          points={s
            .ball!.path.map((p) => {
              const c = P(p);
              return `${c.x},${c.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="#FACC15"
          strokeWidth={1}
          strokeDasharray="2.5 3"
          opacity={timeline.steps[sample.stepIndex] === s ? 0.5 : 0.12}
        />
      ))}

      {/* Anillo de golpe */}
      {sample.hit &&
        (() => {
          const c = P(sample.hit.at);
          const k = sample.hit.progress;
          return (
            <circle
              cx={c.x}
              cy={c.y}
              r={STUDENT_R + k * 12}
              fill="none"
              stroke="#FACC15"
              strokeWidth={2.4 * (1 - k) + 0.3}
              opacity={1 - k}
            />
          );
        })()}

      {/* Jugadores: alumnos y rivales primero, el monitor encima */}
      {timeline.players.map((pl, i) => {
        if (pl.role === "monitor") return null;
        const c = P(sample.players[i]);
        return (
          <StudentMarker
            key={`p${i}`}
            x={c.x}
            y={c.y}
            label={labels[i]?.slice(0, 2)}
            rival={pl.role === "rival"}
          />
        );
      })}
      {timeline.players.map((pl, i) => {
        if (pl.role !== "monitor") return null;
        const c = P(sample.players[i]);
        return <CoachMarker key={`m${i}`} x={c.x} y={c.y} />;
      })}

      {/* Estela y pelota */}
      {trail.map((p, i) => {
        const c = P(p);
        return (
          <circle
            key={`t${i}`}
            cx={c.x}
            cy={c.y}
            r={3.2 - i * 0.4}
            fill={ballColor}
            opacity={0.35 - i * 0.06}
          />
        );
      })}
      {sample.ball &&
        (() => {
          const c = P(sample.ball.at);
          const h = sample.ball.height * HEIGHT_PX;
          return (
            <g>
              <ellipse
                cx={c.x}
                cy={c.y + 3}
                rx={5 * (1 - Math.min(0.5, h / 40))}
                ry={2}
                fill="#000"
                opacity={0.35 - Math.min(0.2, h / 120)}
              />
              <BallMarker x={c.x} y={c.y - h} color={ballColor} />
            </g>
          );
        })()}
    </g>
  );
}

/** Texto que acompaña al esquema en `time`: la frase del paso o el pie. */
export function diagramCaption(source: Diagram, time: number): string | null {
  const { diagram, timeline } = prepare(source);
  const local =
    timeline.duration > 0 ? Math.max(0, time) % timeline.duration : 0;
  const step = timeline.steps[sampleTimeline(timeline, local).stepIndex];
  return (timeline.premium && step?.text) || diagram.caption || null;
}
