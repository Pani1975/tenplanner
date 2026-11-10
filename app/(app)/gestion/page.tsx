import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Clock,
  Target,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import {
  loadClubReport,
  parseReportRange,
  rangeQuery,
  reportToday,
  REPORT_PERIODS,
} from "@/lib/club-reports";
import {
  loadClubDetailReport,
  REPORT_SECTIONS,
} from "@/lib/club-report-detail";
import { GenerateReportButton } from "@/components/app/gestion/generate-report-button";
import { ReportBlocks } from "@/components/app/gestion/report-blocks";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gestión" };
export const dynamic = "force-dynamic";

const PERIOD_LABELS: Record<number, string> = {
  30: "30 días",
  90: "3 meses",
  365: "12 meses",
};

function hours(minutes: number) {
  const h = minutes / 60;
  return h % 1 === 0 ? String(h) : h.toFixed(1).replace(".", ",");
}

function percent(value: number | null) {
  return value === null ? "—" : `${value} %`;
}

function MetricCard({
  label,
  hint,
  icon: Icon,
  value,
}: {
  label: string;
  hint: string;
  icon: React.ElementType;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black uppercase text-foreground/55">
        <Icon className="size-4 text-brand" />
        {label}
      </div>
      <p className="mt-3 font-heading text-4xl font-black tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

export default async function ManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo la cuenta del club.
  const clubId = await getClubAccountClubId(user.id);
  if (!clubId) notFound();

  const query = await searchParams;
  const range = parseReportRange(query);
  const [[club], report, detail] = await Promise.all([
    db
      .select({ name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1),
    loadClubReport(clubId, range),
    loadClubDetailReport(clubId, range),
  ]);
  const dateFmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // Fechas por defecto al pasar a "Personalizado": los últimos 30 días.
  const today = reportToday();
  const defaultFrom = new Date(Date.now() - 29 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const customFrom = range.kind === "custom" ? range.fromDate : defaultFrom;
  const customTo = range.kind === "custom" ? range.toDate : today;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <BarChart3 className="size-3.5" />
            Modo gestión · Informes
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Espacio gestión {club?.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Actividad de los monitores y seguimiento de los alumnos del club.
            Solo lo ves tú; cuenta lo creado en el modo del club, no el trabajo
            particular de cada monitor.
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Periodo"
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="text-xs font-black uppercase text-foreground/55">
              Periodo
            </span>
            {REPORT_PERIODS.map((p) => (
              <Link
                key={p}
                href={p === 30 ? "/gestion" : `/gestion?periodo=${p}`}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-semibold transition-colors",
                  range.kind === "preset" && p === range.period
                    ? "border-brand bg-brand/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
            <Link
              href={`/gestion?periodo=personalizado&desde=${customFrom}&hasta=${customTo}`}
              className={cn(
                "rounded-full border px-3 py-1.5 font-semibold transition-colors",
                range.kind === "custom"
                  ? "border-brand bg-brand/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              Personalizado
            </Link>
          </nav>
          <GenerateReportButton
            sections={REPORT_SECTIONS.map((sec) => ({
              id: sec.id,
              label: sec.label,
            }))}
            periodQuery={rangeQuery(range).toString()}
            periodLabel={range.label}
          />
        </div>

        {range.kind === "custom" && (
          <form
            method="get"
            action="/gestion"
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 text-sm"
          >
            <input type="hidden" name="periodo" value="personalizado" />
            <label className="flex flex-col gap-1 text-xs font-black uppercase text-foreground/55">
              Desde
              <input
                type="date"
                name="desde"
                defaultValue={customFrom}
                max={today}
                required
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal normal-case text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-black uppercase text-foreground/55">
              Hasta
              <input
                type="date"
                name="hasta"
                defaultValue={customTo}
                max={today}
                required
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal normal-case text-foreground"
              />
            </label>
            <button
              type="submit"
              className="h-10 rounded-full bg-foreground px-5 text-sm font-black text-background"
            >
              Aplicar
            </button>
          </form>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Monitores"
            icon={UserRound}
            value={report.coaches}
            hint={[
              "Monitores que han aceptado la invitación.",
              report.coachRows.some((c) => c.isOwner)
                ? "La tabla incluye además al gestor, porque también da clases."
                : null,
              report.pendingInvites > 0
                ? `${report.pendingInvites} invitación(es) pendiente(s).`
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
          />
          <MetricCard
            label="Alumnos"
            icon={Users}
            value={report.players}
            hint={`${report.newPlayers} alta(s) en ${range.phrase}.`}
          />
          <MetricCard
            label="Sesiones impartidas"
            icon={CalendarCheck}
            value={report.sessions}
            hint={`En ${range.phrase}${report.cancelled > 0 ? ` · ${report.cancelled} cancelada(s)` : ""}.`}
          />
          <MetricCard
            label="Horas de clase"
            icon={Clock}
            value={hours(report.minutes)}
            hint={`Suma de la duración de las sesiones impartidas.`}
          />
          <MetricCard
            label="Asistencia"
            icon={UserCheck}
            value={percent(report.attendance)}
            hint="Alumnos presentes sobre los que tienen la asistencia anotada."
          />
          <MetricCard
            label="Objetivos conseguidos"
            icon={Target}
            value={report.objectives}
            hint={`Objetivos marcados como conseguidos en ${range.phrase}.`}
          />
          <MetricCard
            label="Próximas sesiones"
            icon={CalendarClock}
            value={report.upcoming}
            hint="Programadas para los próximos 30 días."
          />
        </div>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-black text-foreground">Monitores</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sesiones y horas en {range.phrase}.
          </p>
          {report.coachRows.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aún no hay monitores en el club.{" "}
              <Link
                href="/gestion/monitores"
                className="font-semibold text-brand"
              >
                Invita al primero
              </Link>
              .
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-black uppercase text-foreground/55">
                    <th className="py-2 pr-3">Monitor</th>
                    <th className="py-2 pr-3 text-right">Alumnos</th>
                    <th className="py-2 pr-3 text-right">Sesiones</th>
                    <th className="py-2 pr-3 text-right">Horas</th>
                    <th className="py-2 pr-3 text-right">Asistencia</th>
                    <th className="py-2 pr-3 text-right">Próximas</th>
                    <th className="py-2 text-right">Última sesión</th>
                  </tr>
                </thead>
                <tbody>
                  {report.coachRows.map((coach) => (
                    <tr
                      key={coach.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        <span className="block font-semibold text-foreground">
                          {coach.name}
                          {coach.isOwner && (
                            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                              Gestor
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {coach.email}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {coach.players}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {coach.sessions}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {hours(coach.minutes)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {percent(coach.attendance)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {coach.upcoming}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {coach.lastSession
                          ? dateFmt.format(new Date(coach.lastSession))
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-black text-foreground">Alumnos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Asistencia en {range.phrase} y objetivos conseguidos (en
            total y en el periodo).
          </p>
          {report.playerRows.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aún no hay alumnos del club.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-black uppercase text-foreground/55">
                    <th className="py-2 pr-3">Alumno</th>
                    <th className="py-2 pr-3">Monitor</th>
                    <th className="py-2 pr-3 text-right">Clases asistidas</th>
                    <th className="py-2 pr-3 text-right">Asistencia</th>
                    <th className="py-2 text-right">Objetivos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.playerRows.map((player) => (
                    <tr
                      key={player.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-semibold text-foreground">
                        {player.name}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {player.coachName}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {player.attended}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {percent(player.attendance)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {player.objectives}
                        {player.objectivesInPeriod > 0 && (
                          <span className="ml-1 text-xs text-brand">
                            +{player.objectivesInPeriod}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ReportBlocks detail={detail} phrase={range.phrase} />
      </div>
    </div>
  );
}
