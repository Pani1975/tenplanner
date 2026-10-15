"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Droplets, Loader2, Pause, Play, RotateCcw, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  buildAnimationTimeline,
  classMinuteAt,
  type AnimationInputBlock,
  type AnimationScene,
  type AnimationStep,
  type AnimationTimeline,
} from "@/lib/classes/animation";

// ---------------------------------------------------------------------
// Botón de play (ficha de presentación y ficha de la clase)
// ---------------------------------------------------------------------

interface ClassData {
  name: string;
  duracionMinutes: number;
  blocks: AnimationInputBlock[];
}

export function ClassAnimationButton({
  classId,
  variant = "icon",
  className,
}: {
  classId: string;
  variant?: "icon" | "hero";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ClassData | null>(null);
  const [error, setError] = useState(false);

  const openPlayer = useCallback(
    (e: React.MouseEvent) => {
      // En la ficha de presentación el botón está sobre un enlace.
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      if (data) return;
      setError(false);
      fetch(`/api/classes/${classId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((json) => setData(json.data as ClassData))
        .catch(() => setError(true));
    },
    [classId, data]
  );

  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          onClick={openPlayer}
          className={cn(
            "group inline-flex items-center gap-2.5 rounded-full bg-[#D6FF38] py-1.5 pl-1.5 pr-4 text-sm font-bold text-[#050505] shadow-[0_0_0_0_rgba(214,255,56,0.5)] transition hover:shadow-[0_0_0_6px_rgba(214,255,56,0.18)]",
            className
          )}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[#050505] text-[#D6FF38] transition-transform group-hover:scale-105">
            <Play className="size-3.5 translate-x-px fill-current" />
          </span>
          Ver animación
        </button>
      ) : (
        <button
          type="button"
          onClick={openPlayer}
          aria-label="Ver animación de la clase"
          title="Ver animación de la clase"
          className={cn(
            "flex size-10 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505] shadow-[0_6px_18px_rgba(5,5,5,0.25)] ring-4 ring-white transition hover:scale-105 dark:ring-[#050505]",
            className
          )}
        >
          <Play className="size-4 translate-x-px fill-current" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-1.5rem)] gap-0 overflow-y-auto border-white/10 bg-[#050505] p-0 text-white sm:max-w-3xl"
        >
          <DialogTitle className="sr-only">
            Animación de la clase {data?.name ?? ""}
          </DialogTitle>
          {data ? (
            <ClassAnimationPlayer
              name={data.name}
              blocks={data.blocks}
              onClose={() => setOpen(false)}
            />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-3 text-sm text-white/60">
              {error ? (
                <>
                  No se pudo cargar la clase.
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-white/20 px-4 py-1.5 font-semibold text-white"
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <Loader2 className="size-6 animate-spin text-[#D6FF38]" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------
// Reproductor
// ---------------------------------------------------------------------

const BLOCK_COLORS = ["#38BDF8", "#D6FF38", "#C4B5FD", "#FDBA74"];

function blockColor(i: number) {
  return BLOCK_COLORS[i % BLOCK_COLORS.length];
}

function ballColorFor(name: string) {
  const n = name.toLowerCase();
  if (n.includes("naranja")) return "#FB923C";
  if (n.includes("verde")) return "#4ADE80";
  if (n.includes("roja")) return "#EF4444";
  return "#E8F95A";
}

function formatClock(min: number) {
  const total = Math.floor(min * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ClassAnimationPlayer({
  name,
  blocks,
  onClose,
}: {
  name: string;
  blocks: AnimationInputBlock[];
  onClose?: () => void;
}) {
  const timeline = useMemo(() => buildAnimationTimeline(blocks), [blocks]);
  const reduceMotion = useReducedMotion() ?? false;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const tRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = Math.min(timeline.totalSeconds, tRef.current + dt);
      tRef.current = next;
      setT(next);
      if (next >= timeline.totalSeconds) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline.totalSeconds]);

  const restart = () => {
    tRef.current = 0;
    setT(0);
    setPlaying(true);
  };
  const togglePlay = () => {
    if (tRef.current >= timeline.totalSeconds) restart();
    else setPlaying((p) => !p);
  };
  const seekToStep = (step: AnimationStep) => {
    tRef.current = step.start;
    setT(step.start);
  };

  const { steps } = timeline;
  const phase: "intro" | "steps" | "outro" =
    t < timeline.introSeconds
      ? "intro"
      : t >= timeline.stepsEnd
        ? "outro"
        : "steps";
  const stepIndex =
    phase === "steps" ? steps.findIndex((s) => t >= s.start && t < s.end) : -1;
  const step = stepIndex >= 0 ? steps[stepIndex] : null;
  const clockMin = classMinuteAt(timeline, t);
  const ended = t >= timeline.totalSeconds;
  const blockCount = new Set(steps.map((s) => s.blockIndex)).size;

  return (
    <div className="relative">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#D6FF38]">
            Animación de la clase
          </p>
          <p className="truncate font-heading text-lg font-semibold leading-tight">
            {name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 font-mono text-xs tabular-nums text-white/80">
            {formatClock(clockMin)}
            <span className="text-white/40">
              {" "}
              / {formatClock(timeline.totalClassMinutes)}
            </span>
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Pista animada */}
      <div className="relative mx-5 overflow-hidden rounded-lg border border-white/10 bg-[#0B1A2B]">
        <Court
          timeline={timeline}
          t={t}
          step={step}
          phase={phase}
          ballColor={ballColorFor(name)}
          reduceMotion={reduceMotion}
        />
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]/70 text-center backdrop-blur-[2px]"
            >
              <p className="font-heading text-2xl font-semibold sm:text-3xl">
                {name}
              </p>
              <p className="mt-2 text-sm text-white/70">
                {timeline.totalClassMinutes} min · {blockCount} bloques ·{" "}
                {steps.filter((s) => !s.isRest).length} actividades
              </p>
            </motion.div>
          )}
          {phase === "outro" && (
            <motion.div
              key="outro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#050505]/75 text-center backdrop-blur-[2px]"
            >
              <p className="font-heading text-2xl font-semibold text-[#D6FF38] sm:text-3xl">
                ¡Clase completada!
              </p>
              <BlockSummary timeline={timeline} />
              {ended && (
                <button
                  type="button"
                  onClick={restart}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold hover:border-[#D6FF38] hover:text-[#D6FF38]"
                >
                  <RotateCcw className="size-3.5" /> Repetir
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actividad actual */}
      <div className="min-h-[124px] px-5 pt-4">
        <AnimatePresence mode="wait">
          {step && (
            <motion.div
              key={stepIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#050505]"
                  style={{ backgroundColor: blockColor(step.blockIndex) }}
                >
                  {step.blockTitle}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-white/50">
                  min {Math.round(step.classStartMin)}–
                  {Math.round(step.classStartMin + step.minutes)} ·{" "}
                  {step.minutes} min
                </span>
              </div>
              <p className="mt-2 flex items-center gap-2 font-heading text-xl font-semibold leading-snug">
                {step.isRest && <Droplets className="size-5 text-sky-300" />}
                {step.title}
              </p>
              {step.description && (
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-white/65">
                  {step.description}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Línea de tiempo + controles */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pausar" : "Reproducir"}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505] transition hover:scale-105"
        >
          {playing ? (
            <Pause className="size-4 fill-current" />
          ) : ended ? (
            <RotateCcw className="size-4" />
          ) : (
            <Play className="size-4 translate-x-px fill-current" />
          )}
        </button>
        <TimelineBar
          timeline={timeline}
          clockMin={clockMin}
          activeIndex={stepIndex}
          onSeek={seekToStep}
        />
      </div>
    </div>
  );
}

function BlockSummary({ timeline }: { timeline: AnimationTimeline }) {
  const byBlock = new Map<number, { title: string; minutes: number }>();
  for (const s of timeline.steps) {
    const b = byBlock.get(s.blockIndex) ?? { title: s.blockTitle, minutes: 0 };
    b.minutes += s.minutes;
    byBlock.set(s.blockIndex, b);
  }
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4">
      {[...byBlock.entries()].map(([i, b]) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-white/80"
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: blockColor(i) }}
          />
          {b.title} · {b.minutes} min
        </span>
      ))}
    </div>
  );
}

function TimelineBar({
  timeline,
  clockMin,
  activeIndex,
  onSeek,
}: {
  timeline: AnimationTimeline;
  clockMin: number;
  activeIndex: number;
  onSeek: (step: AnimationStep) => void;
}) {
  const total = timeline.totalClassMinutes || 1;
  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {timeline.steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSeek(s)}
            title={`${s.title} · ${s.minutes} min`}
            aria-label={`Ir a ${s.title}`}
            className={cn(
              "h-full transition-opacity",
              i === activeIndex ? "opacity-100" : "opacity-45 hover:opacity-80"
            )}
            style={{
              width: `${(s.minutes / total) * 100}%`,
              minWidth: 4,
              background: s.isRest
                ? `repeating-linear-gradient(135deg, ${blockColor(s.blockIndex)} 0 3px, transparent 3px 6px)`
                : blockColor(s.blockIndex),
            }}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute -top-1 h-5 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
        style={{ left: `${(clockMin / total) * 100}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Pista (SVG) — escenas calculadas a partir del tiempo, sin estado
// ---------------------------------------------------------------------

const W = 400;
const H = 210;
const COURT = { x: 40, y: 30, w: 320, h: 150 };
const NET_X = COURT.x + COURT.w / 2;
const MID_Y = COURT.y + COURT.h / 2;
const STUDENTS = 4;

type Pt = { x: number; y: number };

function lerp(a: number, b: number, p: number) {
  return a + (b - a) * p;
}
function lerpPt(a: Pt, b: Pt, p: number): Pt {
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) };
}
function ease(p: number) {
  const c = Math.min(1, Math.max(0, p));
  return c < 0.5 ? 2 * c * c : 1 - (-2 * c + 2) ** 2 / 2;
}

/** Punto sobre el perímetro de un rectángulo (u en 0..1). */
function perimeter(u: number, inset: number): Pt {
  const x0 = COURT.x - inset;
  const y0 = COURT.y - inset;
  const w = COURT.w + inset * 2;
  const h = COURT.h + inset * 2;
  const len = 2 * (w + h);
  let d = (((u % 1) + 1) % 1) * len;
  if (d < w) return { x: x0 + d, y: y0 };
  d -= w;
  if (d < h) return { x: x0 + w, y: y0 + d };
  d -= h;
  if (d < w) return { x: x0 + w - d, y: y0 + h };
  d -= w;
  return { x: x0, y: y0 + h - d };
}

interface SceneFrame {
  coach: Pt;
  students: Pt[];
  ball: Pt | null;
  ballShadow: Pt | null;
}

function sceneFrame(
  scene: AnimationScene | "idle",
  t: number,
  still: boolean
): SceneFrame {
  const tt = still ? 0 : t;
  switch (scene) {
    case "warmup": {
      // Los alumnos corren alrededor de la pista; el monitor en el centro.
      const students = Array.from({ length: STUDENTS }, (_, i) =>
        perimeter(tt * 0.16 + i / STUDENTS, 12)
      );
      return {
        coach: { x: NET_X, y: MID_Y },
        students,
        ball: null,
        ballShadow: null,
      };
    }
    case "rally": {
      // Monitor a la izquierda lanzando; alumno activo a la derecha y el
      // resto haciendo fila detrás. La bola cruza la red y bota.
      const coach = { x: COURT.x + 46, y: MID_Y };
      const hitter = { x: COURT.x + COURT.w - 52, y: MID_Y + 6 };
      const students = Array.from({ length: STUDENTS }, (_, i) =>
        i === 0
          ? hitter
          : { x: COURT.x + COURT.w + 22, y: COURT.y + 30 + i * 30 }
      );
      const cycle = (tt * 0.85) % 2; // ida (0-1) y vuelta (1-2)
      const forward = cycle < 1;
      const p = forward ? cycle : cycle - 1;
      const from = forward ? coach : hitter;
      const to = forward ? hitter : coach;
      const ground = lerpPt(
        { x: from.x + (forward ? 8 : -8), y: from.y },
        { x: to.x + (forward ? -8 : 8), y: to.y - 6 },
        p
      );
      // Bote al 70 % del trayecto: dos parábolas.
      const lift =
        p < 0.7
          ? 44 * Math.sin((p / 0.7) * Math.PI)
          : 16 * Math.sin(((p - 0.7) / 0.3) * Math.PI);
      return {
        coach,
        students,
        ball: { x: ground.x, y: ground.y - lift },
        ballShadow: ground,
      };
    }
    case "rest": {
      // Todos al banco, junto a la red.
      const students = Array.from({ length: STUDENTS }, (_, i) => ({
        x: NET_X - 45 + i * 30,
        y: COURT.y + COURT.h + 14,
      }));
      return {
        coach: { x: NET_X + 75, y: COURT.y + COURT.h + 14 },
        students,
        ball: null,
        ballShadow: null,
      };
    }
    case "cooldown": {
      // Corro en el centro con respiración lenta.
      const r = 34 + (still ? 0 : Math.sin(tt * 1.6) * 3);
      const students = Array.from({ length: STUDENTS }, (_, i) => {
        const a = (i / (STUDENTS + 1)) * Math.PI * 2 - Math.PI / 2;
        return { x: NET_X + Math.cos(a) * r, y: MID_Y + Math.sin(a) * r };
      });
      const a = (STUDENTS / (STUDENTS + 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        coach: { x: NET_X + Math.cos(a) * r, y: MID_Y + Math.sin(a) * r },
        students,
        ball: null,
        ballShadow: null,
      };
    }
    default: {
      const students = Array.from({ length: STUDENTS }, (_, i) => ({
        x: COURT.x + COURT.w - 40,
        y: COURT.y + 25 + i * 33,
      }));
      return {
        coach: { x: COURT.x + 40, y: MID_Y },
        students,
        ball: null,
        ballShadow: null,
      };
    }
  }
}

const BLEND_SECONDS = 0.6;

function Court({
  timeline,
  t,
  step,
  phase,
  ballColor,
  reduceMotion,
}: {
  timeline: AnimationTimeline;
  t: number;
  step: AnimationStep | null;
  phase: "intro" | "steps" | "outro";
  ballColor: string;
  reduceMotion: boolean;
}) {
  const steps = timeline.steps;
  const idx = step ? steps.indexOf(step) : -1;
  const scene: AnimationScene | "idle" =
    phase === "steps" && step ? step.scene : "idle";
  const prevScene: AnimationScene | "idle" =
    idx > 0 ? steps[idx - 1].scene : "idle";

  let frame = sceneFrame(scene, t, reduceMotion);
  // Transición suave entre escenas: los jugadores se desplazan a su nueva
  // posición en lugar de saltar.
  if (step && prevScene !== scene && !reduceMotion) {
    const p = ease((t - step.start) / BLEND_SECONDS);
    if (p < 1) {
      const prev = sceneFrame(prevScene, t, reduceMotion);
      frame = {
        coach: lerpPt(prev.coach, frame.coach, p),
        students: frame.students.map((s, i) => lerpPt(prev.students[i], s, p)),
        ball: p > 0.8 ? frame.ball : null,
        ballShadow: p > 0.8 ? frame.ballShadow : null,
      };
    }
  }

  const accent = step ? blockColor(step.blockIndex) : "#D6FF38";
  const dim = scene === "rest";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label={step ? `${step.blockTitle}: ${step.title}` : "Pista"}
    >
      {/* Pista */}
      <g opacity={dim ? 0.45 : 1} style={{ transition: "opacity 400ms" }}>
        <rect
          x={COURT.x - 18}
          y={COURT.y - 16}
          width={COURT.w + 36}
          height={COURT.h + 32}
          rx={6}
          fill="#123456"
        />
        <rect
          x={COURT.x}
          y={COURT.y}
          width={COURT.w}
          height={COURT.h}
          fill="#1D5A96"
          stroke="#fff"
          strokeOpacity={0.9}
          strokeWidth={2}
        />
        <line
          x1={COURT.x + COURT.w * 0.22}
          x2={COURT.x + COURT.w * 0.78}
          y1={MID_Y}
          y2={MID_Y}
          stroke="#fff"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        <line
          x1={COURT.x + COURT.w * 0.22}
          x2={COURT.x + COURT.w * 0.22}
          y1={COURT.y}
          y2={COURT.y + COURT.h}
          stroke="#fff"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        <line
          x1={COURT.x + COURT.w * 0.78}
          x2={COURT.x + COURT.w * 0.78}
          y1={COURT.y}
          y2={COURT.y + COURT.h}
          stroke="#fff"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        {/* Red */}
        <line
          x1={NET_X}
          x2={NET_X}
          y1={COURT.y - 8}
          y2={COURT.y + COURT.h + 8}
          stroke="#F4F4F1"
          strokeWidth={3}
          strokeDasharray="2 2"
        />
        <circle cx={NET_X} cy={COURT.y - 8} r={3} fill="#F4F4F1" />
        <circle cx={NET_X} cy={COURT.y + COURT.h + 8} r={3} fill="#F4F4F1" />
      </g>

      {/* Indicador del bloque actual */}
      <rect
        x={0}
        y={H - 4}
        width={W}
        height={4}
        fill={accent}
        style={{ transition: "fill 300ms" }}
      />

      {/* Bola */}
      {frame.ballShadow && (
        <ellipse
          cx={frame.ballShadow.x}
          cy={frame.ballShadow.y + 3}
          rx={5}
          ry={2}
          fill="#000"
          opacity={0.35}
        />
      )}
      {frame.ball && (
        <circle
          cx={frame.ball.x}
          cy={frame.ball.y}
          r={5}
          fill={ballColor}
          stroke="#fff"
          strokeWidth={1}
        />
      )}

      {/* Alumnos */}
      {frame.students.map((s, i) => (
        <g key={i}>
          <circle
            cx={s.x}
            cy={s.y}
            r={8}
            fill="#F4F4F1"
            stroke="#050505"
            strokeWidth={1.5}
          />
          <text
            x={s.x}
            y={s.y + 3}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="#050505"
          >
            {i + 1}
          </text>
        </g>
      ))}

      {/* Monitor */}
      <circle
        cx={frame.coach.x}
        cy={frame.coach.y}
        r={9.5}
        fill="#D6FF38"
        stroke="#050505"
        strokeWidth={1.5}
      />
      <text
        x={frame.coach.x}
        y={frame.coach.y + 3.5}
        textAnchor="middle"
        fontSize={9}
        fontWeight={800}
        fill="#050505"
      >
        M
      </text>

      {/* Descanso: gota de agua */}
      {dim && (
        <g
          transform={`translate(${NET_X} ${MID_Y - 4}) scale(${
            reduceMotion ? 1 : 1 + Math.sin(t * 5) * 0.08
          })`}
        >
          <circle r={26} fill="#050505" opacity={0.55} />
          <path
            d="M0 -15 C 8 -4, 11 2, 11 6 A 11 11 0 0 1 -11 6 C -11 2, -8 -4, 0 -15 Z"
            fill="#7DD3FC"
          />
        </g>
      )}
    </svg>
  );
}
