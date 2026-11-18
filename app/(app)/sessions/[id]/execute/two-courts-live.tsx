"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export interface LaneExercise {
  key: string;
  name: string;
  durationMinutes: number;
  court?: 1 | 2;
  ledBy?: "coach" | "auto" | null;
  turnMinutes?: number | null;
  turnSize?: number | null;
  blockOrder?: number;
  blockRotates?: boolean;
}

function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Sesión con dos pistas en marcha: un único cronómetro del bloque y, para
 * cada pista, el ejercicio que toca ahora (lo de cada pista pasa a la vez).
 * Con rotación, a mitad de bloque los grupos A y B cambian de pista y cada
 * pista repite su lista.
 */
export function TwoCourtsLive({
  exercises,
  currentIdx,
  onPick,
  onNextBlock,
}: {
  exercises: LaneExercise[];
  currentIdx: number;
  /** Elige un ejercicio (para anotar sus notas debajo). */
  onPick: (idx: number) => void;
  /** Pasa al primer ejercicio del siguiente bloque (-1 si no hay). */
  onNextBlock: (nextIdx: number) => void;
}) {
  const tx = useTranslations("ui.s_execute_twocourtslive");
  const block = exercises[currentIdx]?.blockOrder ?? 1;

  // Cronómetro con la hora real, para no perder tiempo en segundo plano.
  const [baseMs, setBaseMs] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setBaseMs(0);
    setStartedAt(null);
    setElapsedMs(0);
  }, [block]);

  useEffect(() => {
    if (startedAt === null) return;
    const interval = setInterval(() => {
      setElapsedMs(baseMs + (Date.now() - startedAt));
    }, 250);
    return () => clearInterval(interval);
  }, [startedAt, baseMs]);

  function toggle() {
    if (startedAt === null) {
      setStartedAt(Date.now());
    } else {
      const total = baseMs + (Date.now() - startedAt);
      setBaseMs(total);
      setElapsedMs(total);
      setStartedAt(null);
    }
  }

  function reset() {
    setStartedAt(null);
    setBaseMs(0);
    setElapsedMs(0);
  }

  const inBlock = exercises
    .map((e, i) => ({ e, i }))
    .filter((x) => (x.e.blockOrder ?? 1) === block);
  const lanes = ([1, 2] as const).map((court) => {
    let acc = 0;
    const items = inBlock
      .filter((x) => (x.e.court === 2 ? 2 : 1) === court)
      .map((x) => {
        const start = acc;
        acc += x.e.durationMinutes || 0;
        return { ...x, start, end: acc };
      });
    return { court, items, total: acc };
  });
  const longest = Math.max(...lanes.map((l) => l.total));
  const rotates = inBlock.some((x) => x.e.blockRotates);
  const blockSeconds = longest * (rotates ? 2 : 1) * 60;
  const seconds = Math.floor(elapsedMs / 1000);
  const round = rotates && seconds >= longest * 60 ? 2 : 1;
  const t = rotates ? seconds - (round - 1) * longest * 60 : seconds;
  const blockDone = blockSeconds > 0 && seconds >= blockSeconds;
  const nextIdx = exercises.findIndex((e) => (e.blockOrder ?? 1) > block);
  const running = startedAt !== null;

  return (
    <section
      aria-label={tx("lasDosPistas")}
      className="rounded-[28px] border border-[#050505]/10 bg-white p-4 shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase text-muted-foreground">
            {tx("cronometroDelBloqueV1", { v1: rotates ? tx("roundSuffix", { round }) : "" })}
          </p>
          <p
            className={cn(
              "font-mono text-4xl tabular-nums",
              blockDone ? "text-red-400" : "text-foreground"
            )}
          >
            {mmss(seconds)}
            <span className="ml-2 text-sm text-muted-foreground">
              / {mmss(blockSeconds)}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="flex size-12 items-center justify-center rounded-full bg-brand text-brand-foreground transition-all hover:bg-brand/90 active:scale-95"
          aria-label={running ? "Pausar" : "Iniciar"}
        >
          {running ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 translate-x-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex size-12 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-white/10"
          aria-label={tx("reiniciar")}
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {lanes.map((lane) => {
          const active = lane.items.find((it) => t < it.end * 60);
          const finished = !active;
          const group = rotates
            ? (lane.court === 1) === (round === 1)
              ? "A"
              : "B"
            : null;
          return (
            <div
              key={lane.court}
              className="min-w-0 rounded-2xl border border-[#050505]/10 p-3 dark:border-white/10"
            >
              <div className="flex items-center justify-between text-[11px] font-black uppercase">
                <span>
                  {tx("pistaV1V2", { v1: lane.court, v2: group ? tx("groupSuffix", { group }) : "" })}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {tx("v1Min", { v1: lane.total })}</span>
              </div>
              {lane.items.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {tx("nadaEnEstaPista")}
                </p>
              ) : finished ? (
                <p className="mt-2 text-sm font-bold text-foreground">
                  {rotates && round === 1 ? tx("esperandoElCambio") : "Terminada"}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => onPick(active.i)}
                  className={cn(
                    "mt-2 w-full rounded-xl border p-3 text-left transition-colors",
                    active.i === currentIdx
                      ? "border-brand bg-brand/10"
                      : "border-[#050505]/10 hover:bg-muted dark:border-white/10"
                  )}
                >
                  <span className="block text-base font-black leading-snug text-foreground">
                    {active.e.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                      {tx("quedanV1", { v1: mmss(active.end * 60 - t) })}
                    </span>
                    {active.e.ledBy === "coach" && <span>{tx("conMonitor")}</span>}
                    {active.e.ledBy === "auto" && <span>{tx("autonomo")}</span>}
                    {(active.e.turnMinutes ?? 0) > 0 && (
                      <span>
                        {tx("turnosDeV1Min", { v1: active.e.turnMinutes ?? 0, v2: (active.e.turnSize ?? 1) > 1
                          ? tx("turnSizeSuffix", { n: active.e.turnSize ?? 1 })
                          : "" })}
                      </span>
                    )}
                  </span>
                </button>
              )}
              {lane.items.length > 1 && (
                <ol className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  {lane.items.map((it) => (
                    <li
                      key={it.e.key}
                      className={cn(
                        "flex justify-between gap-2",
                        active?.e.key === it.e.key &&
                          "font-bold text-foreground",
                        t >= it.end * 60 && "line-through opacity-60"
                      )}
                    >
                      <span className="truncate">{it.e.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {tx("v1Min", { v1: it.e.durationMinutes })}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {nextIdx >= 0 && (
        <button
          type="button"
          onClick={() => onNextBlock(nextIdx)}
          className={cn(
            "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-black transition-all active:scale-[0.98]",
            blockDone
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "border border-[#050505]/15 text-foreground hover:bg-muted dark:border-white/15"
          )}
        >
          <SkipForward className="size-4" />
          {tx("siguienteBloque")}
        </button>
      )}
    </section>
  );
}
