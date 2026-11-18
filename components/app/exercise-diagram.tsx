import { buildScene, type Prim } from "@/lib/exercise-diagrams/scene";
import type { Diagram } from "@/lib/exercise-diagrams/types";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

function renderPrim(p: Prim, i: number) {
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

/** Esquema de pista de un ejercicio (SVG, nítido a cualquier tamaño). */
export function ExerciseDiagramView({
  diagram,
  className,
  maxWidth = 260,
}: {
  diagram: Diagram;
  className?: string;
  /** Ancho máximo en píxeles (las pistas completas son altas y estrechas). */
  maxWidth?: number;
}) {
  const tx = useTranslations("ui.s_app_exercisediagram");
  const scene = buildScene(diagram);
  return (
    <figure className={cn("m-0", className)}>
      <svg
        viewBox={`0 0 ${scene.width} ${scene.height}`}
        role="img"
        aria-label={diagram.caption ?? tx("esquemaDelEjercicio")}
        style={{ width: "100%", maxWidth, height: "auto", display: "block" }}
      >
        {scene.prims.map(renderPrim)}
      </svg>
      <figcaption className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {diagram.caption && (
          <span className="block font-medium text-foreground/70">
            {diagram.caption}
          </span>
        )}
        <span className="block opacity-70">{tx("esquemaOrientativo")}</span>
      </figcaption>
    </figure>
  );
}
