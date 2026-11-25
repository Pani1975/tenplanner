"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import {
  ExerciseDiagramThumb,
  ExerciseDiagramView,
} from "@/components/app/exercise-diagram";
import type { ExerciseVisual } from "@/app/api/exercises/visuals/route";
import { cn } from "@/lib/utils";

// Caché del navegador compartida por todas las miniaturas: id → visual
// (null = ese ejercicio no tiene ni imagen ni esquema).
const cache = new Map<string, ExerciseVisual | null>();
const listeners = new Set<() => void>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function flush() {
  timer = null;
  const ids = Array.from(pending);
  pending = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const res = await fetch(
        `/api/exercises/visuals?ids=${encodeURIComponent(chunk.join(","))}`
      );
      const json = res.ok
        ? ((await res.json()) as { data: Record<string, ExerciseVisual> })
        : { data: {} };
      for (const id of chunk) cache.set(id, json.data[id] ?? null);
    } catch {
      for (const id of chunk) cache.set(id, null);
    }
  }
  listeners.forEach((l) => l());
}

function request(id: string) {
  if (cache.has(id) || pending.has(id)) return;
  pending.add(id);
  // Junta en una sola petición todas las miniaturas que se pintan a la vez.
  if (!timer) timer = setTimeout(() => void flush(), 30);
}

function useExerciseVisual(id: string | null | undefined) {
  const valid = !!id && UUID_RE.test(id);
  const [, force] = useState(0);
  useEffect(() => {
    if (!valid) return;
    const l = () => force((n) => n + 1);
    listeners.add(l);
    request(id!);
    return () => {
      listeners.delete(l);
    };
  }, [id, valid]);
  if (!valid) return { loading: false, visual: null };
  return {
    loading: !cache.has(id!),
    visual: cache.get(id!) ?? null,
  };
}

/**
 * Miniatura de un ejercicio: su primera foto o, si no tiene, el esquema de
 * pista dibujado. Sin ninguno de los dos muestra un hueco discreto para que
 * las tarjetas queden alineadas.
 */
export function ExerciseThumb({
  exerciseId,
  name,
  className,
}: {
  exerciseId: string | null | undefined;
  /** Nombre del ejercicio, para el título de la vista ampliada. */
  name?: string;
  className?: string;
}) {
  const { loading, visual } = useExerciseVisual(exerciseId);
  const [imgFailed, setImgFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const box = cn(
    "relative size-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/40",
    className
  );

  if (loading) return <div className={cn(box, "animate-pulse")} aria-hidden />;

  if (visual?.imageUrl && !imgFailed) {
    return (
      <div className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visual.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="size-full object-cover"
        />
      </div>
    );
  }

  if (visual?.diagram) {
    return (
      <>
        <button
          type="button"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          title="Ver el esquema en grande"
          className={cn(box, "cursor-zoom-in bg-[#0f3d2e] p-0.5 hover:ring-2 hover:ring-brand/60")}
        >
          <ExerciseDiagramThumb diagram={visual.diagram} />
        </button>
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            <div
              className="max-h-[90vh] w-full max-w-sm overflow-auto rounded-xl bg-card p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {name && (
                <p className="mb-2 text-sm font-semibold text-foreground">
                  {name}
                </p>
              )}
              <ExerciseDiagramView diagram={visual.diagram} maxWidth={360} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className={cn(box, "flex items-center justify-center")}
      title="Sin imagen"
    >
      <ImageOff className="size-4 text-muted-foreground/40" />
    </div>
  );
}
