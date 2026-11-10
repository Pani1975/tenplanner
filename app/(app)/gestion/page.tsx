import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Clock,
  LayoutTemplate,
  Target,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { z } from "zod";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import {
  parseReportRange,
  rangeQuery,
  reportDaysAgo,
  reportToday,
  REPORT_PERIODS,
} from "@/lib/club-reports";
import {
  blocksFor,
  REPORT_BLOCKS,
  REPORT_METRIC_IDS,
} from "@/lib/club-report/catalog";
import { loadClubReportData } from "@/lib/club-report/data";
import { formatHours, formatPct } from "@/lib/club-report/format";
import { listReportTemplatesSafe } from "@/lib/club-report/templates";
import { buildMetricViews } from "@/lib/club-report/views";
import { ReportDialog } from "@/components/app/gestion/report-dialog";
import { ReportView } from "@/components/app/gestion/report-view";
import { cn } from "@/lib/utils";

export const metadata = { title: "Gestión" };
export const dynamic = "force-dynamic";

const PERIOD_LABELS: Record<number, string> = {
  30: "30 días",
  90: "3 meses",
  365: "12 meses",
};

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
  searchParams: Promise<{
    periodo?: string;
    desde?: string;
    hasta?: string;
    plantilla?: string;
  }>;
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
  const [[club], data, { templates, available }] = await Promise.all([
    db
      .select({ name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1),
    loadClubReportData(clubId, range),
    listReportTemplatesSafe(clubId),
  ]);
  const report = data.base;

  // Con ?plantilla=<id> la página muestra solo los datos de esa plantilla.
  const template =
    query.plantilla && z.string().uuid().safeParse(query.plantilla).success
      ? (templates.find((t) => t.id === query.plantilla) ?? null)
      : null;
  const metrics = template ? template.metrics : REPORT_METRIC_IDS;
  const views = buildMetricViews(data, metrics);

  // Fechas por defecto al pasar a "Personalizado": los últimos 30 días.
  const today = reportToday();
  const customFrom =
    range.kind === "custom" ? range.fromDate : reportDaysAgo(29);
  const customTo = range.kind === "custom" ? range.toDate : today;

  const withTemplate = (q: URLSearchParams) => {
    if (template) q.set("plantilla", template.id);
    const s = q.toString();
    return s ? `/gestion?${s}` : "/gestion";
  };
  const presetHref = (p: number) =>
    withTemplate(new URLSearchParams(p === 30 ? {} : { periodo: String(p) }));
  const customHref = withTemplate(
    new URLSearchParams({
      periodo: "personalizado",
      desde: customFrom,
      hasta: customTo,
    })
  );
  const allHref = (() => {
    const s = rangeQuery(range).toString();
    return s ? `/gestion?${s}` : "/gestion";
  })();

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
                href={presetHref(p)}
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
              href={customHref}
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
          <ReportDialog
            blocks={REPORT_BLOCKS.map((b) => ({
              id: b.id,
              label: b.label,
              metrics: b.metrics.map((m) => ({ id: m.id, label: m.label })),
            }))}
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              metrics: t.metrics,
            }))}
            templatesAvailable={available}
            initialPeriod={
              range.kind === "custom"
                ? "personalizado"
                : (String(range.period) as "30" | "90" | "365")
            }
            initialFrom={customFrom}
            initialTo={customTo}
            today={today}
          />
        </div>

        {range.kind === "custom" && (
          <form
            method="get"
            action="/gestion"
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 text-sm"
          >
            <input type="hidden" name="periodo" value="personalizado" />
            {template && (
              <input type="hidden" name="plantilla" value={template.id} />
            )}
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
            value={formatHours(report.minutes)}
            hint="Suma de la duración de las sesiones impartidas."
          />
          <MetricCard
            label="Asistencia"
            icon={UserCheck}
            value={formatPct(report.attendance)}
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

        {template && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
            <LayoutTemplate className="size-4 text-brand" />
            <span>
              Plantilla <span className="font-black">{template.name}</span>:{" "}
              {template.metrics.length} datos.
            </span>
            <Link href={allHref} className="ml-auto font-semibold text-brand">
              Ver todos los datos
            </Link>
          </div>
        )}
        {query.plantilla && !template && (
          <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No se encontró la plantilla; se muestran todos los datos.
          </p>
        )}

        <ReportView blocks={blocksFor(metrics)} views={views} />
      </div>
    </div>
  );
}
