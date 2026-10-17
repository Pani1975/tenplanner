"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Droplets,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Target,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShareButton } from "@/components/app/share-button";
import { cn } from "@/lib/utils";
import {
  buildAnimationTimeline,
  classMinuteAt,
  type AnimationInputBlock,
  type AnimationInputItem,
  type AnimationScene,
  type AnimationSentence,
  type AnimationStep,
  type AnimationTimeline,
} from "@/lib/classes/animation";

// ---------------------------------------------------------------------
// Botón de play (ficha de presentación y ficha de la clase)
// ---------------------------------------------------------------------

interface ClassData {
  name: string;
  duracionMinutes: number;
  objetivos: string | null;
  blocks: AnimationInputBlock[];
}

interface SessionPayload {
  title: string;
  objective: string | null;
  blocks: Array<{
    orderIndex: number;
    title: string | null;
    items: Array<AnimationInputItem & { libraryDescription?: string | null }>;
  }>;
}

/** Adapta una sesión al formato que usa el reproductor. */
function sessionToClassData(s: SessionPayload): ClassData {
  return {
    name: s.title,
    duracionMinutes: 0,
    objetivos: s.objective,
    blocks: s.blocks.map((b) => ({
      orderIndex: b.orderIndex,
      title: b.title,
      items: b.items.map(({ libraryDescription, ...item }) => ({
        ...item,
        exerciseDescription: item.exerciseDescription ?? libraryDescription,
      })),
    })),
  };
}

export function ClassAnimationButton({
  classId,
  sessionId,
  variant = "icon",
  className,
}: {
  /** Se indica uno de los dos: la clase o la sesión a animar. */
  classId?: string;
  sessionId?: string;
  variant?: "icon" | "hero";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ClassData | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setOpen(true);
    if (data) return;
    setError(false);
    const url = sessionId
      ? `/api/sessions/${sessionId}`
      : `/api/classes/${classId}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) =>
        setData(
          sessionId
            ? sessionToClassData(json.data as SessionPayload)
            : (json.data as ClassData)
        )
      )
      .catch(() => setError(true));
  }, [classId, sessionId, data]);

  const openPlayer = useCallback(
    (e: React.MouseEvent) => {
      // En la ficha de presentación el botón está sobre un enlace.
      e.preventDefault();
      e.stopPropagation();
      load();
    },
    [load]
  );

  // Enlace compartido de una clase (?animacion=<id>): abre la animación.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !classId) return;
    const wanted = new URLSearchParams(window.location.search).get("animacion");
    if (wanted === classId) {
      // Tras el primer render, para no encadenar renders en el efecto.
      const timer = setTimeout(() => {
        autoOpened.current = true;
        load();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [classId, load]);

  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          onClick={openPlayer}
          className={cn(
            "group inline-flex items-center gap-2.5 rounded-full bg-[#D6FF38] py-1.5 pl-1.5 pr-4 text-sm font-bold text-[#050505] transition hover:shadow-[0_0_0_6px_rgba(214,255,56,0.18)]",
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
          className="max-h-[calc(100dvh-1rem)] gap-0 overflow-y-auto border-white/10 bg-[#050505] p-0 text-white sm:max-w-5xl"
        >
          <DialogTitle className="sr-only">
            Animación de la clase {data?.name ?? ""}
          </DialogTitle>
          {data ? (
            <ClassAnimationPlayer
              name={data.name}
              objectives={data.objetivos}
              blocks={data.blocks}
              onClose={() => setOpen(false)}
              sharePath={
                sessionId
                  ? `/animacion/sesion/${sessionId}`
                  : `/classes/${classId}?animacion=${classId}`
              }
              kindLabel={
                sessionId ? "Animación de la sesión" : "Animación de la clase"
              }
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
  objectives,
  blocks,
  onClose,
  sharePath,
  kindLabel = "Animación de la clase",
}: {
  name: string;
  objectives?: string | null;
  blocks: AnimationInputBlock[];
  onClose?: () => void;
  /** Enlace que se comparte con el botón de compartir. */
  sharePath?: string;
  kindLabel?: string;
}) {
  const timeline = useMemo(
    () => buildAnimationTimeline(blocks, { objectives }),
    [blocks, objectives]
  );
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

  const seek = (to: number) => {
    const clamped = Math.max(0, Math.min(timeline.totalSeconds, to));
    tRef.current = clamped;
    setT(clamped);
  };
  const restart = () => {
    seek(0);
    setPlaying(true);
  };
  const togglePlay = () => {
    if (tRef.current >= timeline.totalSeconds) restart();
    else setPlaying((p) => !p);
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

  // Saltar a la actividad anterior / siguiente. "Anterior" vuelve al
  // principio de la actual si ya se lleva un rato en ella.
  const goPrev = () => {
    if (phase === "outro") return seek(steps.at(-1)?.start ?? 0);
    if (!step) return seek(0);
    if (t - step.start > 2) return seek(step.start);
    seek(stepIndex > 0 ? steps[stepIndex - 1].start : 0);
  };
  const goNext = () => {
    if (phase === "intro") return seek(steps[0]?.start ?? 0);
    if (step) seek(step.end);
  };

  return (
    <div className="relative">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#D6FF38]">
            {kindLabel}
          </p>
          <p className="truncate font-heading text-lg font-semibold leading-tight">
            {name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="hidden rounded-full border border-white/10 px-2.5 py-1 font-mono text-[11px] tabular-nums text-white/55 sm:inline"
            title="Minuto de la clase real"
          >
            Min {Math.floor(clockMin)} de {timeline.totalClassMinutes}
          </span>
          <span
            className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 font-mono text-xs tabular-nums text-white/80"
            title="Duración del vídeo"
          >
            {formatClock(t / 60)}
            <span className="text-white/40">
              {" "}
              / {formatClock(timeline.totalSeconds / 60)}
            </span>
          </span>
          {sharePath && (
            <ShareButton
              title={`${kindLabel}: ${name}`}
              text={`Mira la animación de «${name}» en TenPlanner`}
              path={sharePath}
              iconOnly
              className="flex size-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            />
          )}
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

      <div className="grid gap-4 px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Pista animada */}
        <div className="relative self-start overflow-hidden rounded-lg border border-white/10 bg-[#0B1A2B]">
          <Court
            timeline={timeline}
            t={t}
            step={step}
            phase={phase}
            ballColor={ballColorFor(name)}
            reduceMotion={reduceMotion}
          />
          <AnimatePresence>
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
                {ended && (
                  <button
                    type="button"
                    onClick={restart}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold hover:border-[#D6FF38] hover:text-[#D6FF38]"
                  >
                    <RotateCcw className="size-3.5" /> Repetir
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <SceneLegend scene={phase === "steps" && step ? step.scene : null} />
        </div>

        {/* Explicación */}
        <div className="min-h-[230px] lg:min-h-0">
          <AnimatePresence mode="wait">
            {phase === "intro" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
              >
                <p className="font-heading text-2xl font-semibold leading-tight">
                  {name}
                </p>
                <p className="mt-1.5 text-sm text-white/60">
                  {timeline.totalClassMinutes} min · {blockCount} bloques ·{" "}
                  {steps.filter((s) => !s.isRest).length} actividades
                </p>
                {timeline.intro.length > 0 && (
                  <>
                    <p className="mt-5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#D6FF38]">
                      <Target className="size-3.5" /> Objetivos de la clase
                    </p>
                    <Sentences
                      sentences={timeline.intro}
                      t={t}
                      reduceMotion={reduceMotion}
                    />
                  </>
                )}
              </motion.div>
            )}

            {step && (
              <motion.div
                key={`step-${stepIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#050505]"
                    style={{ backgroundColor: blockColor(step.blockIndex) }}
                  >
                    {step.blockTitle}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-white/50">
                    {step.minutes} min · minuto {Math.round(step.classStartMin)}
                    –{Math.round(step.classStartMin + step.minutes)}
                  </span>
                </div>
                <p className="mt-2.5 flex items-center gap-2 font-heading text-2xl font-semibold leading-tight">
                  {step.isRest && (
                    <Droplets className="size-5 shrink-0 text-sky-300" />
                  )}
                  {step.title}
                </p>
                <Sentences
                  sentences={step.sentences}
                  t={t}
                  reduceMotion={reduceMotion}
                />
              </motion.div>
            )}

            {phase === "outro" && (
              <motion.div
                key="outro-text"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p className="font-heading text-2xl font-semibold leading-tight">
                  Resumen de la clase
                </p>
                <BlockSummary timeline={timeline} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Línea de tiempo + controles */}
      <div className="flex items-center gap-2 px-5 pb-5 pt-4 sm:gap-3">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Actividad anterior"
          title="Actividad anterior"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <SkipBack className="size-4" />
        </button>
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
        <button
          type="button"
          onClick={goNext}
          aria-label="Actividad siguiente"
          title="Actividad siguiente"
          disabled={phase === "outro"}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <SkipForward className="size-4" />
        </button>
        <TimelineBar
          timeline={timeline}
          clockMin={clockMin}
          activeIndex={stepIndex}
          onSeek={(s) => seek(s.start)}
        />
      </div>
    </div>
  );
}

/** Frases que van apareciendo una a una; la actual resaltada. */
function Sentences({
  sentences,
  t,
  reduceMotion,
}: {
  sentences: AnimationSentence[];
  t: number;
  reduceMotion: boolean;
}) {
  const visible = sentences.filter((s) => t >= s.at);
  const current = visible.length - 1;
  const listRef = useRef<HTMLUListElement>(null);

  // Mantiene a la vista la frase nueva cuando el texto no cabe.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible.length]);

  return (
    <ul
      ref={listRef}
      className="mt-4 max-h-[42vh] space-y-2.5 overflow-y-auto pr-1 lg:max-h-[300px]"
    >
      {visible.map((s, i) => (
        <motion.li
          key={i}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "border-l-2 pl-3 text-[15px] leading-6 transition-colors duration-500",
            i === current
              ? "border-[#D6FF38] text-white"
              : "border-white/15 text-white/55"
          )}
        >
          {s.label && (
            <span className="mr-1.5 inline-block rounded bg-[#D6FF38]/15 px-1.5 py-px align-[1px] text-[10px] font-bold uppercase tracking-wider text-[#D6FF38]">
              {s.label}
            </span>
          )}
          {s.text}
        </motion.li>
      ))}
    </ul>
  );
}

function BlockSummary({ timeline }: { timeline: AnimationTimeline }) {
  const byBlock = new Map<
    number,
    { title: string; minutes: number; activities: string[] }
  >();
  for (const s of timeline.steps) {
    const b = byBlock.get(s.blockIndex) ?? {
      title: s.blockTitle,
      minutes: 0,
      activities: [],
    };
    b.minutes += s.minutes;
    if (!s.isRest) b.activities.push(s.title);
    byBlock.set(s.blockIndex, b);
  }
  return (
    <ul className="mt-4 space-y-3">
      {[...byBlock.entries()].map(([i, b]) => (
        <li
          key={i}
          className="border-l-2 pl-3"
          style={{ borderColor: blockColor(i) }}
        >
          <p className="text-sm font-semibold">
            {b.title}{" "}
            <span className="font-normal text-white/50">· {b.minutes} min</span>
          </p>
          <p className="text-[13px] leading-5 text-white/60">
            {b.activities.join(" · ")}
          </p>
        </li>
      ))}
    </ul>
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
    <div className="relative ml-1 min-w-0 flex-1">
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

const SCENE_LEGEND: Partial<Record<AnimationScene, string>> = {
  warmup: "Carrera alrededor de la pista",
  tee: "Golpeo desde la torre · resto: sombras por parejas",
  guided: "El monitor guía el golpe",
  juggle: "Cada alumno controla su pelota",
  rally: "Golpeo con el monitor",
  pairs: "Peloteo por parejas en media pista",
  relay: "Relevos por equipos hasta los aros",
  shadow: "Golpea uno · su pareja hace de sombra",
  stations: "Circuito por estaciones",
  serve: "Saque al cuadro",
  game: "Juego de vidas con el monitor",
  mirror: "Espejo por parejas: uno guía y el otro copia",
  reaction: "El monitor lanza a un lado desde la línea de saque",
  alley: "Peloteo desde el fondo en el pasillo de dobles",
  points: "Reina de la pista desde el fondo · primera bola del monitor",
  elevator: "Ascensor: sacan a la vez · quien mete pasa al fondo",
  rest: "Descanso",
  cooldown: "Estiramientos en corro",
};

function SceneLegend({ scene }: { scene: AnimationScene | null }) {
  return (
    <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-2">
      <AnimatePresence mode="wait">
        {scene && SCENE_LEGEND[scene] && (
          <motion.span
            key={scene}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-full bg-[#050505]/70 px-2 py-0.5 text-[10.5px] font-semibold text-white/85"
          >
            {SCENE_LEGEND[scene]}
          </motion.span>
        )}
      </AnimatePresence>
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
/** Líneas laterales de individuales (el pasillo de dobles queda fuera). */
const SINGLES_TOP = COURT.y + COURT.h * 0.125;
const SINGLES_BOTTOM = COURT.y + COURT.h * 0.875;
/** Línea de saque del campo derecho. */
const SERVICE_RIGHT = COURT.x + COURT.w * 0.78;
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

/** Bola que va de `from` a `to` con bote al 70 % del recorrido. */
function flight(from: Pt, to: Pt, p: number, height = 44) {
  const ground = lerpPt(from, to, p);
  const lift =
    p < 0.7
      ? height * Math.sin((p / 0.7) * Math.PI)
      : height * 0.36 * Math.sin(((p - 0.7) / 0.3) * Math.PI);
  return { ball: { x: ground.x, y: ground.y - lift }, shadow: ground };
}

interface SceneFrame {
  coach: Pt;
  students: Pt[];
  balls: { ball: Pt; shadow: Pt | null }[];
  tee?: Pt;
  ring?: Pt;
  /** Aros en el suelo (relevos). */
  rings?: Pt[];
  /** Conos (salidas, estaciones). */
  cones?: Pt[];
  /** Resalta los pasillos de dobles. */
  alleys?: boolean;
  /** Textos sobre la pista (p. ej. "+1", "Reina"). */
  labels?: { at: Pt; text: string; opacity: number }[];
}

// --- Reina de la pista: secuencia de golpes por variante ---------------

interface QueenShot {
  /** Duración del tramo, en segundos de escena. */
  dur: number;
  /** Posición de la candidata y de la reina al acabar el tramo. */
  aspirant: Pt;
  queen: Pt;
  /** Bola del tramo: quién la golpea y adónde va. */
  ball?: { from: "coach" | "aspirant" | "queen"; to: Pt; height: number };
  caption?: string;
}

const Q_ASPIRANT_START = { x: COURT.x + COURT.w - 8, y: MID_Y - 18 };
const Q_QUEEN_START = { x: COURT.x + 8, y: MID_Y + 18 };

// Variante 1: bola al revés (lado +y de la candidata, que mira a la red),
// se invierte y juega de derecha cruzada; la reina juega libre.
const QUEEN_INSIDE_OUT: QueenShot[] = [
  {
    dur: 0.5,
    aspirant: Q_ASPIRANT_START,
    queen: Q_QUEEN_START,
    caption: "Bola al revés · se invierte de derecha",
  },
  {
    dur: 0.9,
    aspirant: { x: COURT.x + COURT.w - 12, y: MID_Y + 26 },
    queen: Q_QUEEN_START,
    ball: {
      from: "coach",
      to: { x: COURT.x + COURT.w - 24, y: MID_Y + 12 },
      height: 22,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 10, y: MID_Y + 10 },
    queen: { x: COURT.x + 14, y: MID_Y - 34 },
    ball: {
      from: "aspirant",
      to: { x: COURT.x + 30, y: MID_Y - 40 },
      height: 42,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 16, y: MID_Y - 34 },
    queen: { x: COURT.x + 10, y: MID_Y - 8 },
    ball: {
      from: "queen",
      to: { x: COURT.x + COURT.w - 30, y: MID_Y - 42 },
      height: 42,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 10, y: MID_Y - 6 },
    queen: { x: COURT.x + 14, y: MID_Y + 36 },
    ball: {
      from: "aspirant",
      to: { x: COURT.x + 30, y: MID_Y + 42 },
      height: 42,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 40, y: MID_Y + 30 },
    queen: { x: COURT.x + 10, y: MID_Y + 10 },
    ball: { from: "queen", to: { x: NET_X + 70, y: MID_Y + 46 }, height: 36 },
    caption: "Punto",
  },
  { dur: 0.9, aspirant: Q_ASPIRANT_START, queen: Q_QUEEN_START },
];

// Variante 2: bola a la derecha (lado -y) y cruzado corto al cuadro de saque.
const QUEEN_SHORT_CROSS: QueenShot[] = [
  {
    dur: 0.5,
    aspirant: Q_ASPIRANT_START,
    queen: Q_QUEEN_START,
    caption: "Bola a la derecha · cruzado corto",
  },
  {
    dur: 0.9,
    aspirant: { x: COURT.x + COURT.w - 12, y: MID_Y - 30 },
    queen: Q_QUEEN_START,
    ball: {
      from: "coach",
      to: { x: COURT.x + COURT.w - 26, y: MID_Y - 40 },
      height: 22,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 14, y: MID_Y - 12 },
    queen: { x: NET_X - 58, y: MID_Y + 40 },
    ball: {
      from: "aspirant",
      to: { x: NET_X - 40, y: MID_Y + 32 },
      height: 24,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 12, y: MID_Y + 30 },
    queen: { x: COURT.x + 30, y: MID_Y + 20 },
    ball: {
      from: "queen",
      to: { x: COURT.x + COURT.w - 26, y: MID_Y + 38 },
      height: 36,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 10, y: MID_Y + 4 },
    queen: { x: COURT.x + 12, y: MID_Y - 30 },
    ball: {
      from: "aspirant",
      to: { x: COURT.x + 28, y: MID_Y - 38 },
      height: 42,
    },
  },
  {
    dur: 1.1,
    aspirant: { x: COURT.x + COURT.w - 40, y: MID_Y - 40 },
    queen: { x: COURT.x + 10, y: MID_Y - 6 },
    ball: { from: "queen", to: { x: NET_X + 66, y: MID_Y - 48 }, height: 36 },
    caption: "Punto",
  },
  { dur: 0.9, aspirant: Q_ASPIRANT_START, queen: Q_QUEEN_START },
];

const QUEEN_CYCLE = QUEEN_INSIDE_OUT.reduce((a, s) => a + s.dur, 0);

function queenRally(shots: QueenShot[], time: number, coach: Pt) {
  let start = 0;
  let prevA = shots.at(-1)!.aspirant;
  let prevQ = shots.at(-1)!.queen;
  for (const shot of shots) {
    if (time < start + shot.dur) {
      const p = (time - start) / shot.dur;
      const aspirant = lerpPt(prevA, shot.aspirant, ease(p));
      const queen = lerpPt(prevQ, shot.queen, ease(p));
      let ball: SceneFrame["balls"][number] | null = null;
      if (shot.ball) {
        const from =
          shot.ball.from === "coach"
            ? coach
            : shot.ball.from === "aspirant"
              ? prevA
              : prevQ;
        ball = flight(from, shot.ball.to, p, shot.ball.height);
      } else if (shot === shots[0]) {
        ball = { ball: { x: coach.x - 8, y: coach.y - 8 }, shadow: null };
      }
      return {
        aspirant,
        queen,
        ball,
        caption: shot.caption ?? null,
        captionOpacity: p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2,
      };
    }
    start += shot.dur;
    prevA = shot.aspirant;
    prevQ = shot.queen;
  }
  return {
    aspirant: prevA,
    queen: prevQ,
    ball: null,
    caption: null,
    captionOpacity: 0,
  };
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
        perimeter(tt * 0.06 + i / STUDENTS, 12)
      );
      return { coach: { x: NET_X, y: MID_Y }, students, balls: [] };
    }
    case "tee": {
      // Alumno 1 golpea desde la torre con el monitor detrás; la bola va al
      // aro del otro campo. Los demás, por parejas, hacen sombras.
      const tee = { x: COURT.x + 70, y: MID_Y + 4 };
      const hitter = { x: tee.x - 14, y: tee.y + 12 };
      const coach = { x: hitter.x - 18, y: hitter.y + 10 };
      const ring = { x: COURT.x + COURT.w - 60, y: MID_Y - 30 };
      const sway = still ? 0 : Math.sin(tt * 3.2) * 3;
      const students = [
        hitter,
        { x: COURT.x + 40, y: COURT.y + 22 + sway },
        { x: COURT.x + 66, y: COURT.y + 22 - sway },
        { x: COURT.x + 40, y: COURT.y + COURT.h - 22 + sway },
      ];
      const cycle = (tt * 0.45) % 1;
      const balls =
        cycle < 0.15
          ? [{ ball: { x: tee.x, y: tee.y - 10 }, shadow: null }]
          : [flight(tee, ring, (cycle - 0.15) / 0.85, 40)];
      return { coach, students, balls, tee, ring };
    }
    case "guided": {
      // Monitor junto al alumno, le lanza bolas cortas y le guía el gesto.
      const hitter = { x: COURT.x + COURT.w - 60, y: MID_Y + 8 };
      const coach = { x: hitter.x - 26, y: hitter.y - 18 };
      const students = Array.from({ length: STUDENTS }, (_, i) =>
        i === 0
          ? hitter
          : { x: COURT.x + COURT.w + 22, y: COURT.y + 30 + i * 30 }
      );
      const cycle = (tt * 0.6) % 1;
      const balls = [
        flight(
          { x: coach.x + 6, y: coach.y + 4 },
          { x: hitter.x - 8, y: hitter.y - 4 },
          cycle,
          20
        ),
      ];
      return { coach, students, balls };
    }
    case "juggle": {
      // Cada alumno, repartido por su zona, mantiene la pelota sobre la
      // raqueta mientras camina despacio.
      const homes = [
        { x: COURT.x + 70, y: COURT.y + 45 },
        { x: COURT.x + 120, y: COURT.y + COURT.h - 40 },
        { x: COURT.x + COURT.w - 120, y: COURT.y + 42 },
        { x: COURT.x + COURT.w - 70, y: COURT.y + COURT.h - 45 },
      ];
      const students = homes.map((h, i) => ({
        x: h.x + Math.cos(tt * 0.5 + i * 1.7) * 14,
        y: h.y + Math.sin(tt * 0.5 + i * 1.7) * 10,
      }));
      const balls = students.map((s, i) => {
        const hop = Math.abs(Math.sin(tt * 3.4 + i * 0.9)) * 12;
        return {
          ball: { x: s.x + 9, y: s.y - 10 - hop },
          shadow: null,
        };
      });
      return { coach: { x: NET_X, y: MID_Y }, students, balls };
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
      const cycle = (tt * 0.6) % 2; // ida (0-1) y vuelta (1-2)
      const forward = cycle < 1;
      const p = forward ? cycle : cycle - 1;
      const from = forward ? coach : hitter;
      const to = forward ? hitter : coach;
      return { coach, students, balls: [flight(from, to, p)] };
    }
    case "pairs": {
      // Dos parejas pelotean a media pista, una arriba y otra abajo.
      const rows = [COURT.y + 38, COURT.y + COURT.h - 38];
      const students = [
        { x: NET_X - 48, y: rows[0] },
        { x: NET_X + 48, y: rows[0] },
        { x: NET_X - 48, y: rows[1] },
        { x: NET_X + 48, y: rows[1] },
      ];
      const balls = [0, 1].map((pair) => {
        const a = students[pair * 2];
        const b = students[pair * 2 + 1];
        const cycle = (tt * 0.55 + pair * 0.5) % 2;
        const forward = cycle < 1;
        const p = forward ? cycle : cycle - 1;
        return flight(forward ? a : b, forward ? b : a, p, 26);
      });
      return {
        coach: { x: NET_X, y: COURT.y + COURT.h + 14 },
        students,
        balls,
      };
    }
    case "relay": {
      // Dos equipos tras un cono en el fondo; sale uno de cada fila hasta los
      // aros junto a la red, deja su objeto y vuelve a chocar la mano.
      const rings: Pt[] = [];
      for (const dx of [-62, -40, -18])
        for (const dy of [-22, 0, 22])
          rings.push({ x: NET_X + dx, y: MID_Y + dy });
      const lanes = [MID_Y - 40, MID_Y + 40];
      const cones = lanes.map((y) => ({ x: COURT.x + 14, y }));
      const students: Pt[] = [];
      const balls: SceneFrame["balls"] = [];
      lanes.forEach((y, team) => {
        const raw = tt * 0.32 + team * 0.45;
        const cycle = raw % 1;
        const turn = Math.floor(raw) % 2;
        const target = rings[(Math.floor(raw) * 4 + team * 5) % rings.length];
        const start = cones[team];
        const runner =
          cycle < 0.5
            ? lerpPt(start, target, ease(cycle * 2))
            : lerpPt(target, start, ease((cycle - 0.5) * 2));
        const waiting = { x: COURT.x - 8, y: y + (team === 0 ? -8 : 8) };
        const pair = turn === 0 ? [runner, waiting] : [waiting, runner];
        students.push(...pair);
        if (cycle < 0.5)
          balls.push({
            ball: { x: runner.x + 7, y: runner.y - 8 },
            shadow: null,
          });
      });
      return {
        coach: { x: COURT.x + 70, y: MID_Y },
        students,
        balls,
        rings,
        cones,
      };
    }
    case "shadow": {
      // El monitor lanza; un alumno golpea y su pareja, justo detrás, imita
      // el gesto. La otra pareja hace la escalera de coordinación.
      const coach = { x: COURT.x + 46, y: MID_Y };
      const hitter = { x: COURT.x + COURT.w - 62, y: MID_Y - 12 };
      const swing = still ? 0 : Math.sin(tt * 3.8) * 3;
      const shadow = { x: hitter.x + 18 + swing, y: hitter.y + 8 };
      const ladderY = COURT.y + COURT.h - 16;
      const hop = (i: number) => (still ? 0 : ((tt * 0.35 + i * 0.5) % 1) * 70);
      const students = [
        hitter,
        shadow,
        { x: COURT.x + COURT.w - 110 + hop(0), y: ladderY },
        { x: COURT.x + COURT.w - 110 + hop(1), y: ladderY },
      ];
      const cycle = (tt * 0.55) % 1;
      return {
        coach,
        students,
        balls: [flight(coach, { x: hitter.x - 8, y: hitter.y }, cycle, 30)],
      };
    }
    case "stations": {
      // Cinco estaciones; los alumnos rotan a la siguiente cada pocos segundos.
      const cones = [
        { x: COURT.x + 50, y: COURT.y + 32 },
        { x: COURT.x + 50, y: COURT.y + COURT.h - 32 },
        { x: COURT.x + COURT.w - 100, y: COURT.y + 32 },
        { x: COURT.x + COURT.w - 100, y: COURT.y + COURT.h - 32 },
        { x: COURT.x + COURT.w - 34, y: MID_Y },
      ];
      const PERIOD = 4;
      const round = Math.floor(tt / PERIOD);
      const local = (tt % PERIOD) / PERIOD;
      const moving = !still && local > 0.8;
      const students = Array.from({ length: STUDENTS }, (_, i) => {
        const at = cones[(i + round) % cones.length];
        const next = cones[(i + round + 1) % cones.length];
        const base = moving ? lerpPt(at, next, ease((local - 0.8) / 0.2)) : at;
        return { x: base.x + 10, y: base.y + 6 };
      });
      const balls = moving
        ? []
        : students.map((s, i) => ({
            ball: {
              x: s.x + 9,
              y: s.y - 10 - Math.abs(Math.sin(tt * 3.4 + i)) * 10,
            },
            shadow: null,
          }));
      return { coach: { x: NET_X, y: MID_Y }, students, balls, cones };
    }
    case "serve": {
      // Saque desde el fondo: lanzamiento delante, golpe y bola al cuadro.
      const hitter = { x: COURT.x + COURT.w - 8, y: MID_Y + 22 };
      const students = Array.from({ length: STUDENTS }, (_, i) =>
        i === 0
          ? hitter
          : { x: COURT.x + COURT.w + 22, y: COURT.y + 30 + i * 30 }
      );
      const box = { x: COURT.x + COURT.w * 0.22 + 36, y: MID_Y - 34 };
      const cycle = (tt * 0.5) % 1;
      const ball =
        cycle < 0.3
          ? {
              ball: {
                x: hitter.x - 6,
                y: hitter.y - 10 - Math.sin((cycle / 0.3) * Math.PI) * 24,
              },
              shadow: null,
            }
          : flight(
              { x: hitter.x - 6, y: hitter.y - 10 },
              box,
              (cycle - 0.3) / 0.7,
              30
            );
      return {
        coach: { x: NET_X + 30, y: COURT.y + COURT.h + 14 },
        students,
        balls: [ball],
        ring: box,
      };
    }
    case "game": {
      // "Vidas": cada alumno golpea desde el cono la bola del monitor; el
      // eliminado espera al otro lado e intenta cogerla con la mano.
      const cone = { x: COURT.x + COURT.w - 14, y: MID_Y };
      const hitter = { x: cone.x - 10, y: cone.y + 4 };
      const coach = { x: NET_X + 50, y: MID_Y + 34 };
      const raw = tt * 0.42;
      const cycle = raw % 1;
      const target = {
        x: COURT.x + 60 + ((Math.floor(raw) * 37) % 60),
        y: MID_Y - 40 + ((Math.floor(raw) * 53) % 80),
      };
      const catcherHome = { x: COURT.x + 80, y: MID_Y };
      const catcher = lerpPt(
        catcherHome,
        { x: target.x + 10, y: target.y },
        ease(Math.max(0, (cycle - 0.4) / 0.6)) * 0.85
      );
      const students = [
        hitter,
        { x: COURT.x + COURT.w + 16, y: MID_Y - 22 },
        { x: COURT.x + COURT.w + 16, y: MID_Y + 22 },
        catcher,
      ];
      const ball =
        cycle < 0.35
          ? flight(coach, { x: hitter.x - 6, y: hitter.y }, cycle / 0.35, 18)
          : flight(
              { x: hitter.x - 6, y: hitter.y },
              target,
              (cycle - 0.35) / 0.65,
              46
            );
      return { coach, students, balls: [ball], cones: [cone] };
    }
    case "mirror": {
      // Espejo por parejas, en paralelo: cada pareja frente a frente a los
      // lados de la red; el guía se desplaza y su compañero le copia.
      const rows = [MID_Y - 36, MID_Y + 36];
      const students: Pt[] = [];
      rows.forEach((y, pair) => {
        const lead = still ? 0 : Math.sin(tt * 1.7 + pair * 1.3) * 20;
        const copy = still ? 0 : Math.sin((tt - 0.3) * 1.7 + pair * 1.3) * 20;
        students.push(
          { x: NET_X - 34, y: y + lead },
          { x: NET_X + 34, y: y + copy }
        );
      });
      return {
        coach: { x: NET_X, y: COURT.y + COURT.h + 14 },
        students,
        balls: [],
      };
    }
    case "reaction": {
      // El monitor, en la línea de saque y en el mismo campo que el jugador,
      // lanza la pelota a un lado; el jugador sale rápido a por ella y vuelve
      // al centro. Los demás esperan su turno detrás del fondo.
      const coach = { x: SERVICE_RIGHT, y: MID_Y };
      const ready = { x: COURT.x + COURT.w - 30, y: MID_Y };
      const raw = tt * 0.45;
      const cycle = raw % 1;
      const side = Math.floor(raw) % 2 === 0 ? -1 : 1;
      const target = { x: ready.x - 8, y: MID_Y + side * 46 };
      const player =
        cycle < 0.2
          ? ready
          : cycle < 0.5
            ? lerpPt(ready, target, ease((cycle - 0.2) / 0.3))
            : cycle < 0.62
              ? target
              : lerpPt(target, ready, ease((cycle - 0.62) / 0.38));
      const students = [
        player,
        { x: COURT.x + COURT.w + 24, y: MID_Y - 34 },
        { x: COURT.x + COURT.w + 24, y: MID_Y },
        { x: COURT.x + COURT.w + 24, y: MID_Y + 34 },
      ];
      const balls =
        cycle < 0.2
          ? [{ ball: { x: coach.x + 7, y: coach.y - 8 }, shadow: null }]
          : cycle < 0.5
            ? [flight(coach, target, (cycle - 0.2) / 0.3, 20)]
            : cycle < 0.62
              ? [{ ball: { x: target.x + 7, y: target.y - 8 }, shadow: null }]
              : [];
      return { coach, students, balls };
    }
    case "alley": {
      // Peloteo entre jugadoras desde el fondo, dentro del pasillo de
      // dobles: una pareja en cada pasillo, a la vez.
      const lanes = [
        (COURT.y + SINGLES_TOP) / 2,
        (SINGLES_BOTTOM + COURT.y + COURT.h) / 2,
      ];
      const students: Pt[] = [];
      const balls: SceneFrame["balls"] = [];
      lanes.forEach((y, pair) => {
        const a = { x: COURT.x + 6, y };
        const b = { x: COURT.x + COURT.w - 6, y };
        students.push(a, b);
        const cycle = (tt * 0.45 + pair * 0.5) % 2;
        const forward = cycle < 1;
        const p = forward ? cycle : cycle - 1;
        balls.push(flight(forward ? a : b, forward ? b : a, p, 34));
      });
      return {
        coach: { x: NET_X, y: MID_Y },
        students,
        balls,
        alleys: true,
      };
    }
    case "points": {
      // Reina de la pista desde el fondo, alternando las dos variantes:
      // 1) El monitor lanza al revés de la candidata, que se invierte y
      //    golpea de derecha; la reina juega donde quiera y se disputa el
      //    punto.
      // 2) El monitor lanza a la derecha de la candidata, que cruza corto
      //    (bota en el cuadro de saque) y se juega el punto.
      const coach = { x: NET_X + 28, y: COURT.y + COURT.h + 14 };
      const variant = Math.floor(tt / QUEEN_CYCLE) % 2;
      const local = still ? 0 : tt % QUEEN_CYCLE;
      const f = queenRally(
        variant === 0 ? QUEEN_INSIDE_OUT : QUEEN_SHORT_CROSS,
        local,
        coach
      );
      const students = [
        f.aspirant,
        { x: COURT.x + COURT.w + 24, y: MID_Y + 10 },
        { x: COURT.x + COURT.w + 24, y: MID_Y + 40 },
        f.queen,
      ];
      const labels: NonNullable<SceneFrame["labels"]> = [
        { at: { x: f.queen.x, y: f.queen.y - 14 }, text: "Reina", opacity: 1 },
      ];
      if (f.caption)
        labels.push({
          at: { x: NET_X + 80, y: COURT.y - 4 },
          text: f.caption,
          opacity: f.captionOpacity,
        });
      return {
        coach,
        students,
        balls: f.ball ? [f.ball] : [],
        labels,
      };
    }
    case "elevator": {
      // Ascensor con el servicio: todas sacan a la vez desde 3/4 (entre la
      // línea de servicio y la de fondo). La que mete pasa a la línea de
      // fondo; la que falla se queda. Si desde el fondo vuelve a meter,
      // suma 1 punto y vuelve a empezar desde 3/4.
      const rows = [
        SINGLES_TOP + 16,
        MID_Y - 22,
        MID_Y + 22,
        SINGLES_BOTTOM - 16,
      ];
      const midX = (SERVICE_RIGHT + COURT.x + COURT.w) / 2;
      const baseX = COURT.x + COURT.w + 6;
      const RATE = 0.4;
      const raw = tt * RATE;
      const round = Math.floor(raw);
      const local = raw % 1;
      // Resultado fijo por jugadora y ronda (≈ 60 % de aciertos).
      const makes = (i: number, r: number) => (i * 7 + r * 13 + 3) % 5 < 3;
      // Posición (0 = 3/4, 1 = fondo) al empezar cada ronda.
      const levelAt = (i: number, r: number) => {
        let level = 0;
        for (let k = 0; k < r; k++) {
          if (!makes(i, k)) level = 0;
          else level = level === 0 ? 1 : 0;
        }
        return level;
      };
      const students: Pt[] = [];
      const balls: SceneFrame["balls"] = [];
      const labels: NonNullable<SceneFrame["labels"]> = [];
      rows.forEach((y, i) => {
        const now = levelAt(i, round);
        const before = round > 0 ? levelAt(i, round - 1) : now;
        const xNow = now ? baseX : midX;
        const xBefore = before ? baseX : midX;
        const x = local < 0.2 ? lerp(xBefore, xNow, ease(local / 0.2)) : xNow;
        const pos = { x, y };
        students.push(pos);
        if (local < 0.2) return;
        const hand = { x: x - 6, y: y - 10 };
        const inBall = makes(i, round);
        const target = inBall
          ? {
              x: NET_X - 46 + (i % 2) * 10,
              y: y < MID_Y ? MID_Y + 26 : MID_Y - 26,
            }
          : { x: NET_X + 3, y: y < MID_Y ? MID_Y - 8 : MID_Y + 8 };
        if (local < 0.35) {
          const up = Math.sin(((local - 0.2) / 0.15) * Math.PI) * 22;
          balls.push({ ball: { x: hand.x, y: hand.y - up }, shadow: null });
        } else if (local < 0.8) {
          balls.push(
            flight(hand, target, (local - 0.35) / 0.45, inBall ? 30 : 16)
          );
        }
        // Mete desde el fondo: +1 que sube desde la jugadora.
        if (inBall && now === 1 && local >= 0.6) {
          const p = (local - 0.6) / 0.4;
          labels.push({
            at: { x: pos.x, y: pos.y - 14 - p * 22 },
            text: "+1",
            opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
          });
        }
      });
      return {
        coach: { x: NET_X + 30, y: COURT.y + COURT.h + 14 },
        students,
        balls,
        labels,
      };
    }
    case "rest": {
      // Todos al banco, junto a la red.
      const students = Array.from({ length: STUDENTS }, (_, i) => ({
        x: NET_X - 75 + i * 30,
        y: COURT.y + COURT.h + 14,
      }));
      return {
        coach: { x: NET_X + 75, y: COURT.y + COURT.h + 14 },
        students,
        balls: [],
      };
    }
    case "cooldown": {
      // Corro en el centro con respiración lenta.
      const r = 34 + (still ? 0 : Math.sin(tt * 1.2) * 3);
      const pos = (i: number) => {
        const a = (i / (STUDENTS + 1)) * Math.PI * 2 - Math.PI / 2;
        return { x: NET_X + Math.cos(a) * r, y: MID_Y + Math.sin(a) * r };
      };
      return {
        coach: pos(STUDENTS),
        students: Array.from({ length: STUDENTS }, (_, i) => pos(i)),
        balls: [],
      };
    }
    default: {
      const students = Array.from({ length: STUDENTS }, (_, i) => ({
        x: COURT.x + COURT.w - 40,
        y: COURT.y + 25 + i * 33,
      }));
      return { coach: { x: COURT.x + 40, y: MID_Y }, students, balls: [] };
    }
  }
}

const BLEND_SECONDS = 0.8;

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

  // Cada escena empieza desde su principio al llegar a la actividad.
  const localT = step ? Math.max(0, t - step.start) : t;
  let frame = sceneFrame(scene, localT, reduceMotion);
  // Transición suave entre escenas: los jugadores se desplazan a su nueva
  // posición en lugar de saltar; bolas y material aparecen al llegar.
  if (step && prevScene !== scene && !reduceMotion) {
    const p = ease((t - step.start) / BLEND_SECONDS);
    if (p < 1) {
      const prevStep = steps[idx - 1];
      const prev = sceneFrame(
        prevScene,
        prevStep ? t - prevStep.start : t,
        reduceMotion
      );
      frame = {
        coach: lerpPt(prev.coach, frame.coach, p),
        students: frame.students.map((s, i) => lerpPt(prev.students[i], s, p)),
        balls: p > 0.85 ? frame.balls : [],
        tee: p > 0.5 ? frame.tee : undefined,
        ring: p > 0.5 ? frame.ring : undefined,
        rings: p > 0.5 ? frame.rings : undefined,
        cones: p > 0.5 ? frame.cones : undefined,
        labels: p > 0.85 ? frame.labels : undefined,
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
        {[0.22, 0.78].map((f) => (
          <line
            key={f}
            x1={COURT.x + COURT.w * f}
            x2={COURT.x + COURT.w * f}
            y1={SINGLES_TOP}
            y2={SINGLES_BOTTOM}
            stroke="#fff"
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        ))}
        <line
          x1={COURT.x + COURT.w * 0.22}
          x2={COURT.x + COURT.w * 0.78}
          y1={MID_Y}
          y2={MID_Y}
          stroke="#fff"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        {/* Líneas de individuales: delimitan los pasillos de dobles */}
        {[SINGLES_TOP, SINGLES_BOTTOM].map((y) => (
          <line
            key={y}
            x1={COURT.x}
            x2={COURT.x + COURT.w}
            y1={y}
            y2={y}
            stroke="#fff"
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        ))}
        {frame.alleys &&
          [COURT.y, SINGLES_BOTTOM].map((y) => (
            <rect
              key={`a${y}`}
              x={COURT.x}
              y={y}
              width={COURT.w}
              height={SINGLES_TOP - COURT.y}
              fill="#D6FF38"
              opacity={0.16}
            />
          ))}
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

      {/* Material: aros y conos */}
      {frame.rings?.map((r, i) => (
        <circle
          key={`r${i}`}
          cx={r.x}
          cy={r.y}
          r={8}
          fill="none"
          stroke="#FACC15"
          strokeWidth={2}
        />
      ))}
      {frame.cones?.map((c, i) => (
        <path
          key={`c${i}`}
          d={`M ${c.x} ${c.y - 7} L ${c.x + 6} ${c.y + 5} L ${c.x - 6} ${c.y + 5} Z`}
          fill="#F97316"
          stroke="#050505"
          strokeWidth={1}
        />
      ))}

      {/* Material: aro (diana) y torre/tee */}
      {frame.ring && (
        <circle
          cx={frame.ring.x}
          cy={frame.ring.y}
          r={13}
          fill="none"
          stroke="#FACC15"
          strokeWidth={3}
        />
      )}
      {frame.tee && (
        <g>
          <rect
            x={frame.tee.x - 2}
            y={frame.tee.y - 6}
            width={4}
            height={12}
            fill="#F97316"
          />
          <rect
            x={frame.tee.x - 6}
            y={frame.tee.y + 5}
            width={12}
            height={3}
            rx={1}
            fill="#F97316"
          />
        </g>
      )}

      {/* Bolas */}
      {frame.balls.map(
        (b, i) =>
          b.shadow && (
            <ellipse
              key={`s${i}`}
              cx={b.shadow.x}
              cy={b.shadow.y + 3}
              rx={5}
              ry={2}
              fill="#000"
              opacity={0.35}
            />
          )
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

      {frame.balls.map((b, i) => (
        <circle
          key={`b${i}`}
          cx={b.ball.x}
          cy={b.ball.y}
          r={4.5}
          fill={ballColor}
          stroke="#fff"
          strokeWidth={1}
        />
      ))}

      {frame.labels?.map((l, i) => (
        <text
          key={`l${i}`}
          x={l.at.x}
          y={l.at.y}
          textAnchor="middle"
          fontSize={l.text.length > 2 ? 8.5 : 12}
          fontWeight={800}
          fill="#D6FF38"
          stroke="#050505"
          strokeWidth={0.6}
          opacity={l.opacity}
        >
          {l.text}
        </text>
      ))}

      {/* Descanso: gota de agua */}
      {dim && (
        <g
          transform={`translate(${NET_X} ${MID_Y - 4}) scale(${
            reduceMotion ? 1 : 1 + Math.sin(t * 4) * 0.08
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
