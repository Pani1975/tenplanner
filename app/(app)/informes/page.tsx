import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  BarChart3,
  BookOpen,
  Building2,
  GraduationCap,
  Target,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { loadPlatformReport, type ReportCount } from "@/lib/platform-reports";

export const metadata = { title: "Informes" };
export const dynamic = "force-dynamic";

function MetricCard({
  label,
  hint,
  icon: Icon,
  value,
}: {
  label: string;
  hint: string;
  icon: React.ElementType;
  value: ReportCount;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black uppercase text-foreground/55">
        <Icon className="size-4 text-brand" />
        {label}
      </div>
      <p className="mt-3 font-heading text-4xl font-black tabular-nums text-foreground">
        {value.total}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted-foreground">
        {value.last30 > 0 ? (
          <span className="text-brand">+{value.last30}</span>
        ) : (
          "0"
        )}{" "}
        en los últimos 30 días
      </p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo la cuenta de la plataforma (y los administradores).
  const [row] = await db
    .select({
      isAdmin: users.isAdmin,
      isPlatformAccount: users.isPlatformAccount,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.isPlatformAccount && !row?.isAdmin) notFound();

  const report = await loadPlatformReport();
  const dateFmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <BarChart3 className="size-3.5" />
            Modo Ten Planner
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Informes Ten Planner
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Altas en la plataforma: clubes, monitores, familias y jugadores.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Clubes"
            icon={Building2}
            value={report.clubs}
            hint="Clubes y academias creados en la aplicación."
          />
          <MetricCard
            label="Monitores"
            icon={UserRound}
            value={report.coaches}
            hint="Cuentas de monitor, con club o en particular."
          />
          <MetricCard
            label="Familias"
            icon={UsersRound}
            value={report.families}
            hint="Cuentas de familia o de jugador que siguen a un alumno."
          />
          <MetricCard
            label="Jugadores"
            icon={Users}
            value={report.players}
            hint="Fichas de alumno creadas por clubes y monitores."
          />
        </div>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-black text-foreground">
            Contenido público
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Ejercicios en la Biblioteca",
                value: report.library.exercises,
                icon: BookOpen,
                href: "/exercises?tab=global",
              },
              {
                label: "Clases en la Biblioteca",
                value: report.library.classes,
                icon: GraduationCap,
                href: "/classes?tab=library",
              },
              {
                label: "Objetivos del catálogo",
                value: report.library.objectives,
                icon: Target,
                href: "/objetivos",
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:border-brand/40"
              >
                <item.icon className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                <span className="font-heading text-xl font-black tabular-nums text-foreground">
                  {item.value}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-black text-foreground">
            Clubes y monitores particulares
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Los jugadores de cada club más los de los monitores sin club suman
            el total.
          </p>
          {report.clubRows.length === 0 && report.players.total === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Aún no hay clubes.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-black uppercase text-foreground/55">
                    <th className="py-2 pr-3">Club</th>
                    <th className="py-2 pr-3 text-right">Monitores</th>
                    <th className="py-2 pr-3 text-right">Jugadores</th>
                    <th className="py-2 text-right">Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {report.clubRows.map((club) => (
                    <tr
                      key={club.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-semibold text-foreground">
                        {club.name}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {club.coaches}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {club.players}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {dateFmt.format(new Date(club.createdAt))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/60">
                    <td className="py-2.5 pr-3 font-semibold text-foreground">
                      Sin club
                      <span className="ml-1 font-normal text-muted-foreground">
                        (monitores particulares)
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {report.particular.coaches}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {report.particular.players}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      —
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="text-[11px] font-black uppercase text-foreground/70">
                    <td className="pt-3 pr-3">Total jugadores</td>
                    <td />
                    <td className="pt-3 pr-3 text-right text-sm tabular-nums text-foreground">
                      {report.players.total}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
