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
  parseReportPeriod,
  REPORT_PERIODS,
} from "@/lib/club-reports";
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
    <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black uppercase text-white/55">
        <Icon className="size-4 text-brand" />
        {label}
      </div>
      <p className="mt-3 font-heading text-4xl font-black tabular-nums text-white">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-snug text-white/60">{hint}</p>
    </div>
  );
}

export default async function ManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo la cuenta del club.
  const clubId = await getClubAccountClubId(user.id);
  if (!clubId) notFound();

  const { periodo } = await searchParams;
  const period = parseReportPeriod(periodo);
  const [[club], report] = await Promise.all([
    db
      .select({ name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1),
    loadClubReport(clubId, period),
  ]);
  const dateFmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const periodText = PERIOD_LABELS[period];

  return (
    <div className="min-h-full w-full bg-[#050505] text-white">
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

        <nav
          aria-label="Periodo"
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span className="text-xs font-black uppercase text-white/55">
            Periodo
          </span>
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p}
              href={p === 30 ? "/gestion" : `/gestion?periodo=${p}`}
              className={cn(
                "rounded-full border px-3 py-1.5 font-semibold transition-colors",
                p === period
                  ? "border-brand bg-brand/10 text-white"
                  : "border-white/10 text-white/60 hover:bg-white/10"
              )}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </nav>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Monitores"
            icon={UserRound}
            value={report.coaches}
            hint={
              report.pendingInvites > 0
                ? `${report.pendingInvites} invitación(es) pendiente(s).`
                : "Monitores que han aceptado la invitación."
            }
          />
          <MetricCard
            label="Alumnos"
            icon={Users}
            value={report.players}
            hint={`${report.newPlayers} alta(s) en los últimos ${periodText}.`}
          />
          <MetricCard
            label="Sesiones impartidas"
            icon={CalendarCheck}
            value={report.sessions}
            hint={`Últimos ${periodText}${report.cancelled > 0 ? ` · ${report.cancelled} cancelada(s)` : ""}.`}
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
            hint={`Objetivos marcados como conseguidos en los últimos ${periodText}.`}
          />
          <MetricCard
            label="Próximas sesiones"
            icon={CalendarClock}
            value={report.upcoming}
            hint="Programadas para los próximos 30 días."
          />
        </div>

        <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-sm">
          <h2 className="text-lg font-black text-white">Monitores</h2>
          <p className="mt-1 text-xs text-white/60">
            Sesiones y horas de los últimos {periodText}.
          </p>
          {report.coachRows.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">
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
                  <tr className="border-b border-white/10 text-left text-[11px] font-black uppercase text-white/55">
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
                      className="border-b border-white/10 last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        <span className="block font-semibold text-white">
                          {coach.name}
                        </span>
                        <span className="block text-xs text-white/60">
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
                      <td className="py-2.5 text-right text-white/60">
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

        <section className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-sm">
          <h2 className="text-lg font-black text-white">Alumnos</h2>
          <p className="mt-1 text-xs text-white/60">
            Asistencia de los últimos {periodText} y objetivos conseguidos (en
            total y en el periodo).
          </p>
          {report.playerRows.length === 0 ? (
            <p className="mt-3 text-sm text-white/60">
              Aún no hay alumnos del club.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] font-black uppercase text-white/55">
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
                      className="border-b border-white/10 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-semibold text-white">
                        {player.name}
                      </td>
                      <td className="py-2.5 pr-3 text-white/60">
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
      </div>
    </div>
  );
}
