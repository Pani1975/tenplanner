"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Dumbbell, Layers, Tag, Target, Users } from "lucide-react";
import type {
  ExerciseAspect,
  SessionAnalytics,
  TrainingPhase,
} from "@/lib/sessions/analytics";
import { cn } from "@/lib/utils";

const PHASE_LABELS: Record<TrainingPhase, string> = {
  activation: "Activación",
  main: "Principal",
  cooldown: "Vuelta a la calma",
};

const PHASE_COLORS: Record<TrainingPhase, string> = {
  activation: "#f59e0b",
  main: "var(--brand)",
  cooldown: "#38bdf8",
};

const PHASE_BG: Record<TrainingPhase, string> = {
  activation: "bg-amber-500",
  main: "bg-brand",
  cooldown: "bg-sky-400",
};

const ASPECT_LABELS: Record<ExerciseAspect, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisico: "Físico",
  mental: "Mental",
};

const ASPECT_COLORS: Record<ExerciseAspect, string> = {
  tecnica: "#60a5fa",
  tactica: "#c084fc",
  fisico: "#fbbf24",
  mental: "#34d399",
};

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}

function StatCard({ icon: Icon, label, value, hint, accent }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1.5 hover:border-border/80 transition-colors">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={cn("size-3.5", accent)} />
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "font-heading text-2xl font-bold leading-none",
          accent ?? "text-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function PhaseTargetsCard({ analytics }: { analytics: SessionAnalytics }) {
  if (analytics.totalMinutes === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50">
          <h3 className="font-semibold text-sm text-foreground">
            Distribución por fases
          </h3>
        </div>
        <div className="p-5">
          <EmptyState text="Sin duración asignada a los ejercicios." />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">
          Distribución por fases
        </h3>
        <span className="text-[11px] text-muted-foreground">
          real vs. objetivo
        </span>
      </div>
      <div className="p-5 space-y-4">
        {/* Real stacked bar */}
        <div className="flex h-8 rounded-xl overflow-hidden gap-px">
          {analytics.phaseBreakdown
            .filter((p) => p.minutes > 0)
            .map((p) => (
              <div
                key={p.phase}
                className={cn("h-full", PHASE_BG[p.phase])}
                style={{ width: `${p.percentage}%` }}
                title={`${PHASE_LABELS[p.phase]}: ${p.minutes} min`}
              />
            ))}
        </div>

        {/* Targets */}
        <div className="space-y-2.5">
          {analytics.phaseTargets.map((t) => {
            const within = Math.abs(t.deltaPct) <= 8;
            const isLow = t.deltaPct < -8;
            return (
              <div key={t.phase}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn("size-2.5 rounded-sm", PHASE_BG[t.phase])}
                    />
                    <span className="font-medium text-foreground">
                      {PHASE_LABELS[t.phase]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-muted-foreground">
                    <span>{Math.round(t.actualPct)}%</span>
                    <span className="text-muted-foreground/50">
                      objetivo {t.targetPct}%
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        within
                          ? "text-muted-foreground"
                          : isLow
                            ? "text-amber-400"
                            : "text-sky-400"
                      )}
                    >
                      {t.deltaPct >= 0 ? "+" : ""}
                      {Math.round(t.deltaPct)}
                    </span>
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      PHASE_BG[t.phase]
                    )}
                    style={{ width: `${Math.min(100, t.actualPct)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-foreground/60"
                    style={{ left: `${t.targetPct}%` }}
                    title={`Objetivo: ${t.targetPct}%`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhaseDonutCard({ analytics }: { analytics: SessionAnalytics }) {
  const data = analytics.phaseBreakdown
    .filter((p) => p.minutes > 0)
    .map((p) => ({
      name: PHASE_LABELS[p.phase],
      value: p.minutes,
      phase: p.phase,
    }));

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border/50">
        <h3 className="font-semibold text-sm text-foreground">
          Proporción de fases
        </h3>
      </div>
      <div className="p-5">
        {data.length > 0 ? (
          <div className="flex items-center gap-4">
            <div className="size-44 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    strokeWidth={2}
                    stroke="var(--card)"
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.phase}
                        fill={PHASE_COLORS[entry.phase]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${v} min`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-heading text-2xl font-bold text-foreground leading-none">
                  {analytics.totalMinutes}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1">
                  min totales
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              {data.map((p) => (
                <div key={p.phase} className="flex items-center gap-2 text-xs">
                  <div
                    className="size-2.5 rounded-sm shrink-0"
                    style={{ background: PHASE_COLORS[p.phase] }}
                  />
                  <span className="text-foreground truncate">{p.name}</span>
                  <span className="text-muted-foreground font-mono ml-auto">
                    {p.value}′
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="Sin fases registradas." />
        )}
      </div>
    </div>
  );
}

function AspectCard({ analytics }: { analytics: SessionAnalytics }) {
  const data = analytics.aspectBreakdown.map((a) => ({
    name: ASPECT_LABELS[a.aspect],
    minutes: a.minutes,
    aspect: a.aspect,
  }));
  const hasData = data.some((d) => d.minutes > 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border/50">
        <h3 className="font-semibold text-sm text-foreground">
          Minutos por categoría
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Según las etiquetas de los ejercicios (aspecto del juego)
        </p>
      </div>
      <div className="p-5">
        {hasData ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${v} min`, ""]}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.aspect}
                      fill={ASPECT_COLORS[entry.aspect]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState text="Sin datos de categorías." />
        )}
      </div>
    </div>
  );
}

export function SessionAnalyticsView({
  analytics,
}: {
  analytics: SessionAnalytics;
}) {
  const hasExercises = analytics.exerciseCount > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={Clock}
          label="Duración"
          value={`${analytics.totalMinutes}′`}
          hint="minutos"
        />
        <StatCard
          icon={Dumbbell}
          label="Ejercicios"
          value={String(analytics.exerciseCount)}
        />
        <StatCard
          icon={Target}
          label="Fases"
          value={`${analytics.phasesCovered}/3`}
          hint="cubiertas"
        />
        <StatCard
          icon={Users}
          label="Alumnos"
          value={String(analytics.studentCount)}
        />
        <StatCard
          icon={Tag}
          label="Etiquetas"
          value={String(analytics.tagCount)}
        />
      </div>

      {!hasExercises ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="mx-auto size-10 rounded-xl bg-muted/60 flex items-center justify-center mb-3">
            <Layers className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Añade ejercicios para ver el análisis de la sesión.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PhaseTargetsCard analytics={analytics} />
          <PhaseDonutCard analytics={analytics} />
          <AspectCard analytics={analytics} />
        </div>
      )}
    </div>
  );
}
