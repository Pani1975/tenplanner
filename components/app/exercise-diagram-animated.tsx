"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  ballTrail,
  buildTimeline,
  type Timeline,
  pathLength,
  sampleTimeline,
} from "@/lib/exercise-diagrams/animate";
import {
  buildScene,
  COLORS,
  projector,
  type Prim,
  type Scene,
} from "@/lib/exercise-diagrams/scene";
import type { Diagram } from "@/lib/exercise-diagrams/types";
import { cn } from "@/lib/utils";
import { ExerciseDiagramView } from "@/components/app/exercise-diagram";

const STATIC_KINDS = new Set(["player", "ball", "move", "shot"]);
const R = 5.2;

// Paleta oscura: pista azul con líneas blancas, como en la animación de la clase.
const DARK: Record<string, string> = {
  "#EEF4EA": "#123456",
  "#F3F4EE": "#123456",
  "#FFFFFF": "#1D5A96",
  "#7C8F7A": "#E5EEF8",
  "#3F4A3F": "#F4F4F1",
  "#E6F6B0": "#3A7CB8",
  "#65A30D": "#D6FF38",
  "#1F2937": "#FFFFFF",
  "#7C3AED": "#C4B5FD",
};
const DARK_ROLE = {
  alumno: "#F4F4F1",
  monitor: "#D6FF38",
  rival: "#EA580C",
} as const;

function recolor(p: Prim): Prim {
  const out: Record<string, unknown> = { ...p };
  for (const k of ["fill", "stroke"]) {
    const v = out[k];
    if (typeof v === "string" && DARK[v]) out[k] = DARK[v];
  }
  return out as Prim;
}

function renderPrim(p: Prim, i: number, upright = false) {
  switch (p.k) {
    case "rect":
      return (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          rx={p.rx}
          fill={p.fill ?? "none"}
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeDasharray={p.dash}
        />
      );
    case "line":
      return (
        <line
          key={i}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeDasharray={p.dash}
          strokeLinecap="round"
        />
      );
    case "polyline":
      return (
        <polyline
          key={i}
          points={p.points}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeDasharray={p.dash}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "circle":
      return (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={p.fill ?? "none"}
          stroke={p.stroke}
          strokeWidth={p.sw}
        />
      );
    case "poly":
      return (
        <polygon
          key={i}
          points={p.points}
          fill={p.fill ?? "none"}
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeLinejoin="round"
        />
      );
    case "text":
      return (
        <text
          key={i}
          x={p.x}
          y={p.y}
          transform={upright ? `rotate(90 ${p.x} ${p.y})` : undefined}
          fontSize={p.size}
          fill={p.fill}
          textAnchor={p.anchor ?? "start"}
          fontWeight={p.weight === "bold" ? 700 : 400}
          fontFamily="system-ui, sans-serif"
        >
          {p.text}
        </text>
      );
  }
}

/** Un fotograma de la animación en `time` segundos (puro, sin estado). */
export function DiagramFrame({
  diagram,
  timeline,
  scene,
  time,
  maxWidth,
  landscape = false,
  dark = false,
}: {
  diagram: Diagram;
  timeline: Timeline;
  scene: Scene;
  time: number;
  maxWidth: number;
  /** Gira la pista 90° (net en vertical) dejando los textos rectos. */
  landscape?: boolean;
  /** Pista azul con líneas blancas (para fondos oscuros). */
  dark?: boolean;
}) {
  const P = projector(diagram.court).point;
  const sample = sampleTimeline(timeline, time);
  const trail = time > 0 ? ballTrail(timeline, time) : [];
  const guides = timeline.steps.filter(
    (s) => s.ball && pathLength(s.ball.path) > 0
  );
  const knocked = new Set(timeline.steps.flatMap((s) => s.knock ?? []));
  const cones = diagram.elements.flatMap((e) => (e.t === "cone" ? [e.at] : []));
  return (
    <svg
      viewBox={
        landscape
          ? `0 0 ${scene.height} ${scene.width}`
          : `0 0 ${scene.width} ${scene.height}`
      }
      role="img"
      aria-label={diagram.caption ?? "Animación del ejercicio"}
      style={{ width: "100%", maxWidth, height: "auto", display: "block" }}
    >
      <g
        transform={
          landscape ? `translate(0 ${scene.width}) rotate(-90)` : undefined
        }
      >
      {(dark ? scene.prims.map(recolor) : scene.prims).map((p, i) =>
        renderPrim(p, i, landscape)
      )}

      {/* Conos que se pueden derribar */}
      {cones.map((at, i) => {
        if (!knocked.has(i)) return null;
        const [cx, cy] = P(at);
        const k = sample.fallen[i] ?? 0;
        const dir = i % 2 === 0 ? 1 : -1;
        return (
          <polygon
            key={`c${i}`}
            points={`${cx},${cy - 4.5} ${cx - 4},${cy + 3.5} ${cx + 4},${cy + 3.5}`}
            transform={`rotate(${dir * 90 * k} ${cx} ${cy + 3.5})`}
            fill={COLORS.cone}
            stroke="#9A3412"
            strokeWidth={0.6}
            opacity={1 - 0.25 * k}
          />
        );
      })}

      {/* Guías tenues de las trayectorias */}
      {guides.map((s, i) => (
        <polyline
          key={`g${i}`}
          points={s.ball!.path.map((p) => P(p).join(",")).join(" ")}
          fill="none"
          stroke={dark ? "#FACC15" : COLORS.shot}
          strokeWidth={1}
          strokeDasharray="2.5 3"
          opacity={i === sample.stepIndex ? 0.55 : 0.18}
        />
      ))}

      {/* Anillo de golpe */}
      {sample.hit &&
        (() => {
          const [hx, hy] = P(sample.hit.at);
          const k = sample.hit.progress;
          return (
            <circle
              cx={hx}
              cy={hy}
              r={R + k * 9}
              fill="none"
              stroke="#FACC15"
              strokeWidth={2 * (1 - k) + 0.3}
              opacity={1 - k}
            />
          );
        })()}

      {/* Jugadores */}
      {timeline.players.map((pl, i) => {
        const [x, y] = P(sample.players[i]);
        return (
          <g key={`p${i}`}>
            <ellipse
              cx={x}
              cy={y + R * 0.85}
              rx={R * 0.95}
              ry={R * 0.35}
              fill="#000"
              opacity={0.15}
            />
            {pl.role !== "monitor" && (
              <g
                transform={`translate(${x} ${y}) rotate(${
                  sample.hit && sample.hit.who === i
                    ? -70 + 120 * sample.hit.progress
                    : 25
                })`}
              >
                <line
                  x1={R - 1}
                  y1={0}
                  x2={R + 4}
                  y2={0}
                  stroke={dark ? "#E5E7EB" : "#374151"}
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
                <ellipse
                  cx={R + 7}
                  cy={0}
                  rx={3.2}
                  ry={2.3}
                  fill="#fff"
                  fillOpacity={0.6}
                  stroke={dark ? "#E5E7EB" : "#374151"}
                  strokeWidth={1}
                />
              </g>
            )}
            <circle
              cx={x}
              cy={y}
              r={R}
              fill={dark ? DARK_ROLE[pl.role] : COLORS[pl.role]}
              stroke="#fff"
              strokeWidth={1}
            />
            {pl.label && (
              <text
                x={x}
                y={y + 2.4}
                transform={landscape ? `rotate(90 ${x} ${y + 2.4})` : undefined}
                fontSize={6.5}
                fill={dark && pl.role !== "rival" ? "#0B1A2B" : "#fff"}
                textAnchor="middle"
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
              >
                {pl.label.slice(0, 2)}
              </text>
            )}
          </g>
        );
      })}

      {/* Estela y pelota */}
      {trail.map((p, i) => {
        const [x, y] = P(p);
        return (
          <circle
            key={`t${i}`}
            cx={x}
            cy={y}
            r={2.3 - i * 0.28}
            fill={COLORS.ball}
            opacity={0.35 - i * 0.06}
          />
        );
      })}
      {sample.ball &&
        (() => {
          const [bx, by] = P(sample.ball.at);
          const h = sample.ball.height;
          return (
            <g>
              <ellipse
                cx={bx}
                cy={by + 1}
                rx={2.4 * (1 - Math.min(0.5, h / 24))}
                ry={1}
                fill="#000"
                opacity={0.25 - Math.min(0.15, h / 80)}
              />
              <circle
                cx={bx}
                cy={by - h}
                r={2.7}
                fill={COLORS.ball}
                stroke={COLORS.ballStroke}
                strokeWidth={0.7}
              />
            </g>
          );
        })()}
      </g>
    </svg>
  );
}

/**
 * Esquema de pista animado: jugadores que se desplazan, pelota con bote y
 * sombra, anillo en cada golpe y estela. Si el esquema trae coreografía
 * ("currado"), añade una frase por paso y curvas suaves.
 */
function AnimatedPlayer({
  diagram,
  className,
  maxWidth = 260,
}: {
  diagram: Diagram;
  className?: string;
  maxWidth?: number;
}) {
  const timeline = useMemo(() => buildTimeline(diagram), [diagram]);
  const scene = useMemo(() => {
    // Los conos que derriba la pelota los dibuja el fotograma.
    const knocked = new Set(timeline.steps.flatMap((s) => s.knock ?? []));
    let cone = -1;
    return buildScene({
      ...diagram,
      elements: diagram.elements.filter((e) => {
        if (STATIC_KINDS.has(e.t)) return false;
        if (e.t === "cone") {
          cone += 1;
          return !knocked.has(cone);
        }
        return true;
      }),
    });
  }, [diagram, timeline]);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  // Arranca solo salvo que la persona pida menos movimiento.
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;
    const id = requestAnimationFrame(() => setPlaying(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000;
      last.current = now;
      setTime((t) => {
        const next = t + dt * (slow ? 0.5 : 1);
        return next >= timeline.duration ? 0 : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    last.current = null;
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [playing, slow, timeline.duration]);

  const step = timeline.steps[sampleTimeline(timeline, time).stepIndex];
  const text = timeline.premium && step?.text ? step.text : diagram.caption;

  return (
    <figure className={cn("m-0", className)}>
      <DiagramFrame
        diagram={diagram}
        timeline={timeline}
        scene={scene}
        time={time}
        maxWidth={maxWidth}
      />

      <div className="mt-2 flex items-center gap-2" style={{ maxWidth }}>
        <button
          type="button"
          onClick={() => setPlaying((v) => !v)}
          aria-label={playing ? "Pausar animación" : "Reproducir animación"}
          className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          {playing ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setTime(0);
            setPlaying(true);
          }}
          aria-label="Repetir desde el principio"
          className="inline-flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <input
          type="range"
          min={0}
          max={Math.round(timeline.duration * 100)}
          value={Math.round(time * 100)}
          onChange={(e) => {
            setPlaying(false);
            setTime(Number(e.target.value) / 100);
          }}
          aria-label="Avance de la animación"
          className="h-1 min-w-0 flex-1 accent-[var(--primary)]"
        />
        <button
          type="button"
          onClick={() => setSlow((v) => !v)}
          aria-pressed={slow}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
            slow
              ? "border-primary text-primary"
              : "border-border text-muted-foreground"
          )}
        >
          0,5×
        </button>
      </div>

      <figcaption
        className="mt-1.5 text-[11px] leading-snug text-muted-foreground"
        style={{ maxWidth }}
      >
        {text && (
          <span className="block min-h-[2.4em] font-medium text-foreground/70">
            {text}
          </span>
        )}
        <span className="block opacity-70">Animación orientativa</span>
      </figcaption>
    </figure>
  );
}

/**
 * Esquema animado; si el esquema no tiene nada que mover (sin flechas ni
 * coreografía), se muestra el esquema estático en lugar de un reproductor.
 */
export function ExerciseDiagramAnimated(props: {
  diagram: Diagram;
  className?: string;
  maxWidth?: number;
}) {
  const animated = useMemo(
    () => buildTimeline(props.diagram).steps.length > 0,
    [props.diagram]
  );
  return animated ? (
    <AnimatedPlayer {...props} />
  ) : (
    <ExerciseDiagramView {...props} />
  );
}
