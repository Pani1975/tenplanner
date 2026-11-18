"use client";

import { motion } from "motion/react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import {
  Activity,
  CalendarClock,
  Flame,
  Target,
  TrendingUp,
  User as UserIcon,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Category = "technique" | "tactics" | "fitness" | "warm-up";

type Analytics = {
  student: {
    id: string;
    name: string;
    playerLevel: string | null;
    dominantHand: string | null;
    yearsExperience: number | null;
  };
  totalSessions: number;
  sessionsLast60d: number;
  daysSinceLast: number | null;
  avgIntensity: number | null;
  attendanceRate: number | null;
  categoriesLast60d: { category: Category; minutes: number }[];
  topTags: { tag: string; count: number }[];
  recentSessions: {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    intensity: number | null;
  }[];
};

type Gap = { label: string; severity: "alto" | "medio" | "bajo"; kind: string };

type Progress = {
  month: string;
  sessions: number;
  avgIntensity: number | null;
}[];

const CATEGORY_LABEL: Record<Category, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

const CATEGORY_COLOR: Record<Category, string> = {
  technique: "var(--brand)",
  tactics: "oklch(0.65 0.15 260)",
  fitness: "oklch(0.68 0.16 40)",
  "warm-up": "oklch(0.72 0.13 85)",
};

function initialOf(name: string) {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function StudentAnalyticsCard({
  part,
  onSend,
}: {
  part: { state: string; output?: unknown };
  onSend: (text: string) => void;
}) {
  const tx = useTranslations("ui.s_drplanner_studentanalyticscard");
  if (part.state !== "output-available") {
    return (
      <div className="border border-foreground/15 bg-foreground/[0.02] p-5 animate-pulse space-y-3">
        <div className="h-10 w-1/3 bg-foreground/10" />
        <div className="grid grid-cols-4 gap-2">
          <div className="h-16 bg-foreground/10" />
          <div className="h-16 bg-foreground/10" />
          <div className="h-16 bg-foreground/10" />
          <div className="h-16 bg-foreground/10" />
        </div>
      </div>
    );
  }

  const data = part.output as {
    ok: boolean;
    analytics?: Analytics;
    gaps?: Gap[];
    progress?: Progress;
    insight?: string | null;
    error?: string;
  };

  if (!data?.ok || !data.analytics) {
    return (
      <div className="border-l-2 border-destructive/50 bg-destructive/[0.05] px-4 py-3 text-[13px] text-destructive">
        {data?.error ?? tx("noSePudoAnalizar")}
      </div>
    );
  }

  const a = data.analytics;
  const totalMinutes = a.categoriesLast60d.reduce(
    (acc, c) => acc + c.minutes,
    0
  );
  const donutData = a.categoriesLast60d
    .filter((c) => c.minutes > 0)
    .map((c) => ({
      name: CATEGORY_LABEL[c.category],
      value: c.minutes,
      color: CATEGORY_COLOR[c.category],
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="border border-foreground/15 bg-background"
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-foreground/10">
        <motion.div
          layoutId={`avatar-${a.student.id}`}
          className="size-12 border border-brand/40 bg-brand/10 flex items-center justify-center"
        >
          <span className="font-heading text-brand text-base">
            {initialOf(a.student.name)}
          </span>
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-foreground/50">
            {tx("analisis60Dias")}
          </p>
          <h3 className="font-heading text-xl leading-tight truncate">
            {a.student.name}
          </h3>
          <p className="text-[12px] text-foreground/55 mt-0.5">
            {a.student.playerLevel ?? "Sin nivel"} ·{" "}
            {a.student.dominantHand ?? tx("manoNoIndicada")}
          </p>
        </div>
        <UserIcon className="size-4 text-foreground/30" strokeWidth={1.6} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-foreground/10">
        <KPI
          icon={CalendarClock}
          label={tx("ultimaSesion")}
          value={
            a.daysSinceLast === null
              ? "Nunca"
              : a.daysSinceLast === 0
                ? "Hoy"
                : `${a.daysSinceLast}d`
          }
          warn={a.daysSinceLast !== null && a.daysSinceLast > 14}
        />
        <KPI
          icon={Activity}
          label={tx("sesiones60d")}
          value={String(a.sessionsLast60d)}
        />
        <KPI
          icon={Flame}
          label={tx("intensidadMed")}
          value={a.avgIntensity !== null ? a.avgIntensity.toFixed(1) : "—"}
        />
        <KPI
          icon={Target}
          label={tx("asistencia")}
          value={a.attendanceRate !== null ? `${a.attendanceRate}%` : "—"}
        />
      </div>

      {/* AI Insight */}
      {data.insight && (
        <div className="px-5 py-3 border-b border-foreground/10 bg-brand/[0.04]">
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-brand mb-1">
            {tx("lecturaDeIa")}
          </p>
          <p className="text-[13px] leading-relaxed text-foreground">
            {data.insight}
          </p>
        </div>
      )}

      {/* Charts + Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-0 border-b border-foreground/10">
        <div className="p-5 md:border-r border-foreground/10">
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55 mb-2">
            {tx("categoriasTrabajadas")}
          </p>
          {donutData.length === 0 ? (
            <p className="text-[12px] text-foreground/50 italic">
              {tx("sinVolumenRegistradoEn")}
            </p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      innerRadius={28}
                      outerRadius={44}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 text-[12px] flex-1 min-w-0">
                {donutData.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0"
                      style={{ background: d.color }}
                    />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="tabular-nums text-foreground/60">
                      {Math.round((d.value / totalMinutes) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.progress && data.progress.some((p) => p.sessions > 0) && (
            <div className="mt-4">
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55 mb-1">
                {tx("progresion6Meses")}
              </p>
              <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.progress}>
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        background: "var(--background)",
                        border: "1px solid var(--foreground)/20",
                        fontSize: 11,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sessions"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      animationDuration={800}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="p-5">
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55 mb-2">
            {tx("huecosDetectados")}
          </p>
          {!data.gaps || data.gaps.length === 0 ? (
            <p className="text-[12px] text-foreground/50 italic">
              {tx("sinHuecosRelevantesCobertura")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.gaps.slice(0, 5).map((g, i) => (
                <li key={i} className="flex items-center gap-2 text-[12px]">
                  <span
                    className={cn(
                      "size-1.5 shrink-0",
                      g.severity === "alto" && "bg-destructive",
                      g.severity === "medio" && "bg-amber-500",
                      g.severity === "bajo" && "bg-foreground/30"
                    )}
                  />
                  <span className="flex-1">{g.label}</span>
                  <span className="font-sans text-[9px] uppercase tracking-[0.18em] text-foreground/45">
                    {g.severity}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {a.topTags.length > 0 && (
            <div className="mt-4">
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55 mb-2">
                {tx("objetivosRecurrentes")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {a.topTags.map((t, i) => (
                  <span
                    key={i}
                    className="text-[11px] border border-foreground/20 px-2 py-0.5"
                  >
                    {t.tag}{" "}
                    <span className="text-foreground/50">× {t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center gap-2 p-4 bg-foreground/[0.02]">
        <button
          type="button"
          onClick={() =>
            onSend(
              `Recomiéndame la próxima sesión para ${a.student.name} usando sus huecos detectados.`
            )
          }
          className="inline-flex items-center gap-2 border border-brand bg-brand text-brand-foreground text-[11px] font-semibold tracking-[0.18em] uppercase px-3 py-2 hover:bg-brand/90 transition-colors"
        >
          <TrendingUp className="size-3" strokeWidth={2} />
          {tx("recomendarSesion")}
          <ArrowRight className="size-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() =>
            onSend(`Muéstrame el progreso mensual de ${a.student.name}.`)
          }
          className="inline-flex items-center gap-2 border border-foreground/20 text-[11px] font-semibold tracking-[0.18em] uppercase px-3 py-2 hover:border-foreground/40 transition-colors"
        >
          {tx("verProgreso")}
        </button>
      </div>
    </motion.div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="p-4 border-r last:border-r-0 border-foreground/10">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon
          className={cn(
            "size-3",
            warn ? "text-amber-600" : "text-foreground/45"
          )}
          strokeWidth={1.6}
        />
        <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "font-heading text-2xl tabular-nums leading-none",
          warn && "text-amber-600"
        )}
      >
        {value}
      </p>
    </div>
  );
}
