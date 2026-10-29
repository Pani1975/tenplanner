"use client";

import { useMemo } from "react";
import { DiagramFrame } from "@/components/app/exercise-diagram-animated";
import { buildTimeline, sampleTimeline } from "@/lib/exercise-diagrams/animate";
import { buildScene } from "@/lib/exercise-diagrams/scene";
import type { Diagram } from "@/lib/exercise-diagrams/types";

// Lo que dibuja el fotograma (jugadores, pelota, flechas) no va en la escena.
const STATIC_KINDS = new Set(["player", "ball", "move", "shot"]);

/**
 * Esquema animado de un ejercicio en el instante `time` (segundos desde que
 * empieza la actividad). Se repite en bucle mientras dura la actividad.
 */
export function DiagramClip({
  diagram,
  time,
}: {
  diagram: Diagram;
  time: number;
}) {
  const timeline = useMemo(() => buildTimeline(diagram), [diagram]);
  const scene = useMemo(() => {
    // Los conos que derriba la pelota los dibuja el fotograma.
    const knocked = new Set(
      timeline.steps.flatMap((s) => (s as { knock?: number[] }).knock ?? [])
    );
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

  const local =
    timeline.duration > 0 ? Math.max(0, time) % timeline.duration : 0;
  const step = timeline.steps[sampleTimeline(timeline, local).stepIndex];
  const text = timeline.premium && step?.text ? step.text : diagram.caption;

  return (
    <figure className="m-0 p-3">
      <DiagramFrame
        diagram={diagram}
        timeline={timeline}
        scene={scene}
        time={local}
        maxWidth={520}
      />
      {text && (
        <figcaption className="mt-2 min-h-[2.4em] text-center text-xs font-medium leading-snug text-white/80">
          {text}
        </figcaption>
      )}
    </figure>
  );
}
