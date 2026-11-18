"use client";

import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, MapPin, UsersRound, Users } from "lucide-react";
import { type StudentsStats } from "@/lib/students/stats";
import { StudentsReportButton } from "./students-report-button";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

const StudentsMap = dynamic(
  () => import("./students-map").then((m) => m.StudentsMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-xl bg-foreground/5" />
    ),
  }
);

const AXIS = { fontSize: 11, fill: "currentColor", opacity: 0.6 };

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-3xl font-black leading-none text-foreground">
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border/50 px-5 py-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-56 items-center justify-center text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export function StudentsStatsSection({
  stats,
  reportHref,
}: {
  stats: StudentsStats;
  reportHref: string;
}) {
  const term = useTerm();
  const tx = useTranslations("ui.s_students_studentsstatssection");
  const hasLevels = stats.levels.some((l) => l.count > 0);
  const hasAges = stats.allAgeBands.some((b) => b.count > 0);
  const fmtAge = (n: number | null) =>
    n === null ? "—" : tx("yearsFmt", { n: String(n).replace(".", ",") });
  const groupBars = stats.groupSizes.slice(0, 8);

  return (
    <section className="space-y-4" aria-label={tx("estadisticasDeAlumnos")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground">{tx("estadisticas")}</h2>
          <p className="text-sm text-muted-foreground">
            {tx("nivelesEdadesGruposY")}
          </p>
        </div>
        <StudentsReportButton href={reportHref} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label={tx("alumnos")}
          value={String(stats.totalStudents)}
          hint={tx("inSomeGroup", { n: stats.groupedStudents })}
        />
        <Kpi
          icon={UsersRound}
          label={tx("grupos")}
          value={String(stats.groupCount)}
        />
        <Kpi
          icon={CalendarClock}
          label={tx("edadMedia")}
          value={fmtAge(stats.ageSummary.average)}
          hint={
            stats.ageSummary.counted > 0
              ? tx("medianLine", { median: fmtAge(stats.ageSummary.median), counted: stats.ageSummary.counted, total: stats.totalStudents })
              : tx("noBirthDates")
          }
        />
        <Kpi
          icon={MapPin}
          label={tx("localidades")}
          value={String(stats.origins.length)}
          hint={
            stats.withoutLocality > 0
              ? tx("withoutLocality", { n: stats.withoutLocality })
              : undefined
          }
        />
      </div>

      {stats.incompleteStudents.length > 0 && (
        <details className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-foreground">
            {tx("incompleteSummary", { pct: stats.completePct, n: stats.incompleteStudents.length })}
            <span className="block text-xs font-normal text-muted-foreground">
              {tx("sinFechaDeNacimiento")}
            </span>
          </summary>
          <ul className="mt-3 space-y-1.5">
            {stats.incompleteStudents.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-x-2 text-xs">
                <a
                  href={`/students/${s.id}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {s.name}
                </a>
                <span className="text-muted-foreground">
                  {tx("faltaV1", { v1: s.missing.map((m) => term(m)).join(", ") })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={tx("alumnosPorNivel")} note={tx("byLevelTag")}>
          {!hasLevels ? (
            <Empty text={tx("ningunAlumnoTieneNivel")} />
          ) : (
            <div className="h-64 text-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.levels.map((d) => ({ ...d, label: term(d.label) }))}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeOpacity={0.12} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis allowDecimals={false} tick={AXIS} />
                  <Tooltip
                    cursor={{ fillOpacity: 0.08 }}
                    formatter={(value) => [
                      tx("studentsCount", { n: Number(value) }),
                      "Alumnos",
                    ]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stats.levels.map((l) => (
                      <Cell key={l.id} fill={l.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title={tx("edades")}
          note={
            stats.withoutBirthDate > 0
              ? tx("withoutBirthDate", { n: stats.withoutBirthDate })
              : tx("allSchoolStudents")
          }
        >
          {!hasAges ? (
            <Empty text={tx("faltanFechasDeNacimiento")} />
          ) : (
            <div className="h-64 text-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.allAgeBands.map((d) => ({ ...d, label: term(d.label) }))}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeOpacity={0.12} />
                  <XAxis dataKey="label" tick={AXIS} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS} />
                  <Tooltip
                    cursor={{ fillOpacity: 0.08 }}
                    formatter={(value) => [
                      tx("studentsCount", { n: Number(value) }),
                      "Alumnos",
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--brand)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title={tx("alumnosPorGrupo")}
          note={
            stats.groupSizes.length > groupBars.length
              ? tx("topGroups", { shown: groupBars.length, total: stats.groupCount })
              : undefined
          }
        >
          {groupBars.length === 0 ? (
            <Empty text={tx("todaviaNoHayGrupos")} />
          ) : (
            <div
              className="text-foreground"
              style={{ height: 40 + groupBars.length * 32 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={groupBars}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeOpacity={0.12} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={AXIS}
                  />
                  <Tooltip
                    cursor={{ fillOpacity: 0.08 }}
                    formatter={(value) => [
                      tx("studentsCount", { n: Number(value) }),
                      "Alumnos",
                    ]}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--brand)"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title={tx("procedencia")}
          note={
            stats.unlocatedStudents > 0
              ? tx("unlocated", { n: stats.unlocatedStudents })
              : tx("circlePerLocality")
          }
        >
          {stats.origins.length === 0 ? (
            <Empty text={tx("anadeLaLocalidadEn")} />
          ) : (
            <StudentsMap origins={stats.origins} />
          )}
        </Card>
      </div>
    </section>
  );
}
