import { Clock, Dumbbell, Layers, Target, Trophy, Users } from "lucide-react";
import { TIPO_ACTIVIDAD_LABELS } from "@/lib/exercise-taxonomy";
import type {
  Share,
  StatAspect,
  StatPhase,
  TrainingStats,
} from "@/lib/stats/training-stats";
import type { StudentHours } from "@/lib/stats/load-training-stats";

// Estadística de entrenamiento de un grupo o de un alumno.

const PHASE_LABEL: Record<StatPhase, string> = {
  activation: "Bloque inicial",
  main: "Bloque principal",
  cooldown: "Bloque final",
};
const PHASE_COLOR: Record<StatPhase, string> = {
  activation: "#38BDF8",
  main: "#A3C520",
  cooldown: "#A78BFA",
};
const ASPECT_LABEL: Record<StatAspect, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisico: "Físico",
  mental: "Mental",
};
const STROKE_LABEL: Record<string, string> = {
  derecha: "Derecha",
  reves: "Revés",
  saque: "Saque",
  volea: "Volea",
  remate: "Remate",
  dejada: "Dejada",
  globo: "Globo",
  resto: "Resto",
};

function typeLabel(key: string) {
  return (
    (TIPO_ACTIVIDAD_LABELS as Record<string, string>)[key] ??
    key.replace(/_/g, " ")
  );
}

export function formatHours(minutes: number) {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)} h` : `${h.toFixed(1).replace(".", ",")} h`;
}

function formatMinutes(minutes: number) {
  if (minutes >= 60) return formatHours(minutes);
  return `${Math.round(minutes)} min`;
}

function pct(n: number) {
  return `${Math.round(n)} %`;
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-2 break-words text-lg font-black leading-tight text-foreground">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bars({
  title,
  rows,
  label,
  empty,
}: {
  title: string;
  rows: Share[];
  label: (key: string) => string;
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold text-foreground">{title}</h3>
      {rows.every((r) => r.minutes === 0) ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {label(r.key)}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {pct(r.pct)} · {formatMinutes(r.minutes)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[#A3C520]"
                  style={{
                    width: `${Math.max(r.pct, r.minutes > 0 ? 2 : 0)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TrainingStatsPanel({
  stats,
  title,
  studentHours,
}: {
  stats: TrainingStats;
  title: string;
  /** Solo en el grupo: horas de cada alumno en sus sesiones. */
  studentHours?: StudentHours[];
}) {
  const top = stats.topExercises[0];
  const topType = stats.types[0];
  const topStroke = stats.strokes[0];
  const phaseTotal = stats.phases.reduce((a, p) => a + p.minutes, 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {stats.sessionCount === 0
            ? "Aún no hay sesiones pasadas con las que calcularla."
            : `A partir de ${stats.sessionCount} sesión${stats.sessionCount !== 1 ? "es" : ""} ya pasada${stats.sessionCount !== 1 ? "s" : ""} (sin las canceladas).`}
        </p>
      </div>

      {stats.sessionCount > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              icon={Clock}
              label="Tiempo jugado"
              value={formatHours(stats.totalMinutes)}
              hint={`${stats.sessionCount} sesiones`}
            />
            <Tile
              icon={Trophy}
              label="Ejercicio más hecho"
              value={top?.name ?? "—"}
              hint={
                top
                  ? `${top.times} ${top.times === 1 ? "vez" : "veces"} · ${formatMinutes(top.minutes)}`
                  : undefined
              }
            />
            <Tile
              icon={Layers}
              label="Tipo más empleado"
              value={topType ? typeLabel(topType.key) : "—"}
              hint={topType ? pct(topType.pct) : undefined}
            />
            <Tile
              icon={Target}
              label="Golpe más trabajado"
              value={
                topStroke ? (STROKE_LABEL[topStroke.key] ?? topStroke.key) : "—"
              }
              hint={topStroke ? pct(topStroke.pct) : undefined}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold text-foreground">
              Tiempo en cada fase
            </h3>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {stats.phases.map((p) =>
                p.minutes > 0 ? (
                  <div
                    key={p.key}
                    style={{
                      width: `${(p.minutes / Math.max(phaseTotal, 1)) * 100}%`,
                      background: PHASE_COLOR[p.key],
                    }}
                  />
                ) : null
              )}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {stats.phases.map((p) => (
                <li key={p.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: PHASE_COLOR[p.key] }}
                  />
                  <span className="text-foreground">{PHASE_LABEL[p.key]}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {formatMinutes(p.minutes)} · {pct(p.pct)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Bars
              title="Aspectos del juego"
              rows={stats.aspects}
              label={(k) => ASPECT_LABEL[k as StatAspect] ?? k}
              empty="Los ejercicios no tienen aspectos del juego etiquetados."
            />
            <Bars
              title="Golpes trabajados"
              rows={stats.strokes}
              label={(k) => STROKE_LABEL[k] ?? k}
              empty="Los ejercicios no tienen golpes etiquetados (los juegos de puntos no cuentan)."
            />
            <Bars
              title="Tipos de ejercicio"
              rows={stats.types}
              label={typeLabel}
              empty="Los ejercicios no tienen tipo etiquetado."
            />
          </div>

          {stats.topExercises.length > 1 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Dumbbell className="size-4" />
                Ejercicios más hechos
              </h3>
              <ol className="space-y-1.5 text-sm">
                {stats.topExercises.map((e, i) => (
                  <li key={e.key} className="flex items-baseline gap-2">
                    <span className="w-4 shrink-0 tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {e.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {e.times} {e.times === 1 ? "vez" : "veces"} ·{" "}
                      {formatMinutes(e.minutes)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {studentHours && studentHours.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Users className="size-4" />
                Tiempo jugado por alumno
              </h3>
              <ul className="space-y-1.5 text-sm">
                {studentHours.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {s.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatHours(s.minutes)} · {s.sessions}{" "}
                      {s.sessions === 1 ? "sesión" : "sesiones"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                No cuentan las sesiones en las que se pasó lista y el alumno
                faltó.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
