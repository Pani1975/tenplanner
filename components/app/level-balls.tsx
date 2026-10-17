import { nivelBallColor, nivelLabel } from "@/lib/exercise-taxonomy";
import { cn } from "@/lib/utils";

// Pelotas del color de cada nivel (roja, naranja, verde, amarilla) para la
// cabecera oscura de las fichas de ejercicio y de clase. Si varios niveles
// comparten pelota (p. ej. de 10 a 18 años, amarilla), se muestra una.

export function LevelBalls({
  niveles,
  sport,
  className,
}: {
  niveles: string[];
  sport?: string | null;
  className?: string;
}) {
  if (sport === "padel") return null;
  const balls = new Map<string, string[]>();
  for (const id of niveles) {
    const color = nivelBallColor(id);
    if (!color) continue;
    balls.set(color, [...(balls.get(color) ?? []), nivelLabel(id)]);
  }
  if (balls.size === 0) return null;

  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {Array.from(balls, ([color, labels]) => (
        <TennisBall key={color} color={color} title={labels.join(", ")} />
      ))}
    </div>
  );
}

function TennisBall({ color, title }: { color: string; title: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-8 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
      role="img"
      aria-label={`Pelota de ${title}`}
    >
      <title>{title}</title>
      <circle
        cx="16"
        cy="16"
        r="15"
        fill={color}
        stroke="#050505"
        strokeWidth="1.2"
      />
      <path
        d="M5.2 6.6c4.6 3.8 4.6 15 0 18.8M26.8 6.6c-4.6 3.8-4.6 15 0 18.8"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.85"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
