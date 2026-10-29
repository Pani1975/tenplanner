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
import { studentsLabel, type StudentsStats } from "@/lib/students/stats";
import { StudentsReportButton } from "./students-report-button";

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
  const hasLevels = stats.levels.some((l) => l.count > 0);
  const hasAges = stats.ageBands.some((b) => b.count > 0);
  const groupBars = stats.groupSizes.slice(0, 8);

  return (
    <section className="space-y-4" aria-label="Estadísticas de alumnos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground">Estadísticas</h2>
          <p className="text-sm text-muted-foreground">
            Niveles, edades, grupos y procedencia de los alumnos.
          </p>
        </div>
        <StudentsReportButton href={reportHref} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Users}
          label="Alumnos"
          value={String(stats.totalStudents)}
          hint={`${stats.groupedStudents} en algún grupo`}
        />
        <Kpi
          icon={UsersRound}
          label="Grupos"
          value={String(stats.groupCount)}
        />
        <Kpi
          icon={CalendarClock}
          label="Edad máxima en grupos"
          value={stats.oldest ? `${stats.oldest.age} años` : "—"}
          hint={
            stats.oldest
              ? `${stats.oldest.name}${stats.oldest.groupName ? ` · ${stats.oldest.groupName}` : ""}`
              : "Sin fechas de nacimiento"
          }
        />
        <Kpi
          icon={MapPin}
          label="Localidades"
          value={String(stats.origins.length)}
          hint={
            stats.withoutLocality > 0
              ? `${studentsLabel(stats.withoutLocality)} sin localidad`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Alumnos por nivel" note="Según la etiqueta de nivel">
          {!hasLevels ? (
            <Empty text="Ningún alumno tiene nivel asignado." />
          ) : (
            <div className="h-64 text-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.levels}
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
                      studentsLabel(Number(value)),
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
          title="Edades en los grupos"
          note={
            stats.groupedWithoutBirthDate > 0
              ? `${studentsLabel(stats.groupedWithoutBirthDate)} sin fecha de nacimiento no se cuenta${stats.groupedWithoutBirthDate === 1 ? "" : "n"}`
              : "Alumnos que pertenecen a algún grupo"
          }
        >
          {!hasAges ? (
            <Empty text="Faltan fechas de nacimiento en los alumnos de grupos." />
          ) : (
            <div className="h-64 text-foreground">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.ageBands}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeOpacity={0.12} />
                  <XAxis dataKey="label" tick={AXIS} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS} />
                  <Tooltip
                    cursor={{ fillOpacity: 0.08 }}
                    formatter={(value) => [
                      studentsLabel(Number(value)),
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
          title="Alumnos por grupo"
          note={
            stats.groupSizes.length > groupBars.length
              ? `Los ${groupBars.length} grupos con más alumnos de ${stats.groupCount}`
              : undefined
          }
        >
          {groupBars.length === 0 ? (
            <Empty text="Todavía no hay grupos." />
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
                      studentsLabel(Number(value)),
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
          title="Procedencia"
          note={
            stats.unlocatedStudents > 0
              ? `${studentsLabel(stats.unlocatedStudents)} con una localidad que no se ha podido situar`
              : "Un círculo por localidad; cuantos más alumnos, más grande"
          }
        >
          {stats.origins.length === 0 ? (
            <Empty text="Añade la localidad en la ficha de cada alumno para ver de dónde vienen." />
          ) : (
            <StudentsMap origins={stats.origins} />
          )}
        </Card>
      </div>
    </section>
  );
}
