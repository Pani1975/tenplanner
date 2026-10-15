import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  sessions as sessionsTable,
  sessionExercises,
  exercises as exercisesTable,
  students as studentsTable,
} from "@/db/schema";
import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Clock,
  Lock,
  CalendarClock,
  BookOpen,
  History,
  MapPin,
  Radio,
  Heart,
  GraduationCap,
  Dumbbell,
  Users,
  Sparkles,
} from "lucide-react";
import { TimeGreeting } from "@/components/app/dashboard/time-greeting";
import { Skeleton } from "@/components/ui/skeleton";
import { greetingForHour } from "@/lib/time-greeting";
import { getBooleanSetting } from "@/lib/app-settings";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { cn } from "@/lib/utils";

function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function SectionTitle({ title, id }: { title: string; id?: string }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-foreground/60"
    >
      <span className="size-2 rounded-full bg-[#D6FF38] shadow-[0_0_0_4px_rgba(214,255,56,0.16)]" />
      {title}
    </h2>
  );
}

function DashboardBodySkeleton() {
  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex flex-col gap-4">
        <Skeleton className="h-4 w-36 rounded-full" />
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-foreground/12 bg-card lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-b border-r border-foreground/10 p-5 last:border-r-0 lg:border-b-0"
            >
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="mt-6 h-12 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-40 rounded-full" />
          <div className="overflow-hidden rounded-lg border border-foreground/12 bg-card">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[84px_1fr_auto] items-center gap-5 border-b border-foreground/10 p-5 last:border-b-0"
              >
                <Skeleton className="h-14 w-20 rounded-lg" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-48 rounded-full" />
                  <Skeleton className="h-3 w-28 rounded-full" />
                </div>
                <Skeleton className="size-4 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <aside className="flex flex-col gap-4">
          <Skeleton className="h-4 w-28 rounded-full" />
          <div className="overflow-hidden rounded-lg border border-foreground/12 bg-card">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="h-16 rounded-none border-b border-foreground/10 last:border-b-0"
              />
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

async function DashboardBody({
  userId,
  sessionCreationEnabled,
}: {
  userId: string;
  sessionCreationEnabled: boolean;
}) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(now.getDate() - 7);

  // El panel refleja el modo de trabajo activo: en particular, solo lo
  // propio sin club; en modo club, todo el espacio compartido de ese club.
  const activeClubId = await getActiveWorkClubId(userId);
  const sessionsVisibility = sharedWithClubCondition(
    sessionsTable.userId,
    sessionsTable.clubId,
    userId,
    activeClubId
  );
  const studentsVisibility = sharedWithClubCondition(
    studentsTable.coachId,
    studentsTable.clubId,
    userId,
    activeClubId
  );

  const [
    upcomingSessions,
    sessionStats,
    exerciseCount,
    studentCount,
    lastWeekMinutes,
    mostUsedExercise,
  ] = await Promise.all([
    db
      .select({
        id: sessionsTable.id,
        title: sessionsTable.title,
        scheduledAt: sessionsTable.scheduledAt,
        durationMinutes: sessionsTable.durationMinutes,
        location: sessionsTable.location,
      })
      .from(sessionsTable)
      .where(and(sessionsVisibility, gte(sessionsTable.scheduledAt, now)))
      .orderBy(asc(sessionsTable.scheduledAt))
      .limit(4),
    db
      .select({
        total: sql<number>`count(*)`,
        totalMinutes: sql<number>`coalesce(sum(${sessionsTable.durationMinutes}), 0)`,
        thisWeekCount: sql<number>`count(*) filter (where ${sessionsTable.scheduledAt} >= ${weekStart.toISOString()})`,
      })
      .from(sessionsTable)
      .where(sessionsVisibility),
    db
      .select({ count: count() })
      .from(exercisesTable)
      .where(exerciseVisibleToUserCondition(userId)),
    db.select({ count: count() }).from(studentsTable).where(studentsVisibility),
    db
      .select({
        minutes: sql<number>`coalesce(sum(${sessionsTable.durationMinutes}), 0)`,
      })
      .from(sessionsTable)
      .where(
        and(
          sessionsVisibility,
          gte(sessionsTable.scheduledAt, lastWeekStart),
          lt(sessionsTable.scheduledAt, now)
        )
      ),
    db
      .select({
        name: exercisesTable.name,
        uses: sql<number>`count(${sessionExercises.id})`,
      })
      .from(sessionExercises)
      .innerJoin(
        sessionsTable,
        eq(sessionsTable.id, sessionExercises.sessionId)
      )
      .innerJoin(
        exercisesTable,
        eq(exercisesTable.id, sessionExercises.exerciseId)
      )
      .where(sessionsVisibility)
      .groupBy(exercisesTable.id, exercisesTable.name)
      .orderBy(desc(sql`count(${sessionExercises.id})`))
      .limit(1),
  ]);

  const totalSessions = Number(sessionStats[0]?.total ?? 0);
  const totalMinutes = Number(sessionStats[0]?.totalMinutes ?? 0);
  const thisWeekCount = Number(sessionStats[0]?.thisWeekCount ?? 0);
  const totalHours = Math.round(totalMinutes / 60);
  const studentTotal = Number(studentCount[0]?.count ?? 0);
  const lastWeekMin = Number(lastWeekMinutes[0]?.minutes ?? 0);
  const topExercise = mostUsedExercise[0];

  // Insight: 3 KPIs personalizados (PMV)
  const insightStats = [
    {
      label: "Ejercicio más usado",
      value: topExercise?.name ?? "—",
      unit: topExercise ? `${topExercise.uses}×` : "sin datos",
      icon: Sparkles,
      isText: true,
    },
    {
      label: "Tiempo en pista",
      value: lastWeekMin,
      unit: "min · semana pasada",
      icon: Clock,
      isText: false,
    },
    {
      label: "Mis alumnos",
      value: studentTotal,
      unit: studentTotal === 1 ? "alumno" : "alumnos",
      icon: Users,
      isText: false,
    },
  ];

  const stats = [
    {
      label: "Esta semana",
      value: thisWeekCount,
      unit: "sesiones",
      icon: CalendarClock,
    },
    {
      label: "Biblioteca",
      value: exerciseCount[0]?.count ?? 0,
      unit: "ejercicios",
      icon: BookOpen,
    },
    {
      label: "Tiempo en pista",
      value: totalHours,
      unit: "horas",
      icon: Clock,
    },
    {
      label: "Total sesiones",
      value: totalSessions,
      unit: "registradas",
      icon: History,
    },
  ];

  const actions = [
    ...(sessionCreationEnabled
      ? [
          {
            href: "/sessions/new",
            label: "Nueva sesión",
            desc: "Agendar entrenamiento",
            icon: Plus,
            accent: true,
          },
        ]
      : []),
    {
      href: "/exercises/new",
      label: "Nuevo ejercicio",
      desc: "Añadir a tu biblioteca",
      icon: Dumbbell,
    },
    {
      href: "/exercises?tab=favorites",
      label: activeClubId ? "Favoritos club" : "Ejercicios favoritos",
      desc: activeClubId ? "Ejercicios marcados" : "Tus marcados",
      icon: Heart,
    },
    {
      href: "/classes?tab=favorites",
      label: activeClubId ? "Listas club" : "Clases favoritas",
      desc: "Plantillas listas",
      icon: GraduationCap,
    },
    {
      href: "/calendar",
      label: "Calendario",
      desc: "Ver agenda",
      icon: CalendarClock,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-8">
      {/* Resumen */}
      <section
        aria-labelledby="insight-heading"
        className="flex flex-col gap-4"
      >
        <SectionTitle id="insight-heading" title="Resumen" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {insightStats.map(({ label, value, unit, icon: Icon, isText }) => (
            <div
              key={label}
              className="rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_12px_40px_rgba(5,5,5,0.05)] transition-colors hover:border-[#D6FF38]/70 dark:border-white/10 dark:bg-white/[0.045]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium text-foreground/65">
                  {label}
                </p>
                <span className="flex size-8 items-center justify-center rounded-full bg-[#D6FF38]/15 text-foreground">
                  <Icon className="size-4 text-brand" strokeWidth={1.7} />
                </span>
              </div>
              <div className="mt-4">
                {isText ? (
                  <p
                    className="font-heading text-xl text-foreground line-clamp-2"
                    title={String(value)}
                  >
                    {value}
                  </p>
                ) : (
                  <p className="font-heading text-4xl text-foreground tabular-nums">
                    {value}
                  </p>
                )}
                <p className="mt-1 text-[12px] text-foreground/55">{unit}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Estadísticas */}
      <section aria-labelledby="stats-heading" className="flex flex-col gap-4">
        <SectionTitle id="stats-heading" title="Estadísticas" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ label, value, unit, icon: Icon }) => (
            <div
              key={label}
              className="rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_12px_40px_rgba(5,5,5,0.04)] transition-colors hover:border-[#D6FF38]/70 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-medium text-foreground/65">
                  {label}
                </p>
                <span className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.04] text-foreground dark:bg-white/[0.06]">
                  <Icon className="size-4 text-brand" strokeWidth={1.7} />
                </span>
              </div>
              <p className="mt-4 font-heading text-4xl text-foreground tabular-nums">
                {value}
              </p>
              <p className="mt-1 text-[12px] text-foreground/55">{unit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SectionTitle title="Próximas sesiones" />
            <Link
              href="/sessions?filter=upcoming"
              className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground/65 transition-colors hover:border-[#D6FF38]/70 hover:text-foreground"
            >
              Ver todas
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#050505]/10 bg-white shadow-[0_18px_50px_rgba(5,5,5,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
            {upcomingSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <span className="flex size-12 items-center justify-center rounded-full border border-[#D6FF38]/35 bg-[#D6FF38]/10">
                  <Radio
                    className="size-6 text-foreground/70"
                    strokeWidth={1.6}
                  />
                </span>
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    No tienes sesiones próximas
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] text-foreground/55">
                    Crea una sesión para empezar a planificar.
                  </p>
                </div>
                <Link
                  href="/sessions/new"
                  className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-4 py-2 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#c8ef2f]"
                >
                  <Plus className="size-3.5" />
                  Crear sesión
                </Link>
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {upcomingSessions.map((session) => {
                  const date = new Date(session.scheduledAt);
                  return (
                    <li key={session.id}>
                      <Link
                        href={`/sessions/${session.id}`}
                        className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-[#D6FF38]/8"
                      >
                        <div className="w-16 shrink-0 border-r border-border pr-3">
                          <p className="font-heading text-xl leading-none text-foreground tabular-nums">
                            {formatDayMonth(date)}
                          </p>
                          <p className="mt-1 text-[11px] uppercase text-foreground/50 tabular-nums">
                            {formatWeekday(date).slice(0, 3)} {formatTime(date)}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] text-foreground">
                            {session.title}
                          </p>
                          <p className="mt-1 flex items-center gap-3 text-[12px] text-foreground/55">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3" />
                              {session.durationMinutes} min
                            </span>
                            {session.location && (
                              <span className="inline-flex items-center gap-1 truncate">
                                <MapPin className="size-3" />
                                {session.location}
                              </span>
                            )}
                          </p>
                        </div>
                        <ArrowRight className="size-4 text-foreground/30 transition-colors group-hover:text-brand" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <SectionTitle title="Accesos rápidos" />
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-[#050505]/10 bg-white shadow-[0_18px_50px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
            {actions.map(({ href, label, desc, icon: Icon, accent }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#D6FF38]/8"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border",
                    accent
                      ? "border-[#D6FF38]/60 bg-[#D6FF38]/20 text-foreground"
                      : "border-border text-foreground/60"
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-[14px] leading-tight",
                      accent ? "text-brand font-medium" : "text-foreground"
                    )}
                  >
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-foreground/55">
                    {desc}
                  </span>
                </span>
                <ArrowRight className="size-3.5 text-foreground/30 transition-colors group-hover:text-brand" />
              </Link>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const displayName =
    user.user_metadata?.full_name?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "Coach";
  const now = new Date();
  const sessionCreationEnabled = await getBooleanSetting(
    "feature.session_creation_enabled"
  );

  return (
    <div className="relative min-h-full w-full bg-[#F4F4F1] dark:bg-[#050505]">
      <div className="flex w-full flex-col gap-8 px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <header className="relative overflow-hidden rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_18px_60px_rgba(5,5,5,0.06)] dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
          <div
            aria-hidden
            className="court-grid pointer-events-none absolute inset-0 opacity-45 dark:opacity-25"
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex rounded-full border border-foreground/10 bg-[#F4F4F1] px-3 py-1 text-[12px] font-semibold text-foreground/60 dark:bg-[#050505]/70">
                {formatLongDate(now)}
              </p>
              <TimeGreeting
                name={displayName}
                initialGreeting={greetingForHour(now.getHours())}
              />
            </div>
            {sessionCreationEnabled ? (
              <Link
                href="/sessions/new"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#D6FF38] px-4 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#c8ef2f]"
              >
                <Plus className="size-4" />
                Nueva sesión
              </Link>
            ) : (
              <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-muted/30 px-4 text-[13px] text-foreground/45">
                <Lock className="size-4" />
                Sesiones bloqueadas
              </span>
            )}
          </div>
        </header>

        <Suspense fallback={<DashboardBodySkeleton />}>
          <DashboardBody
            userId={user.id}
            sessionCreationEnabled={sessionCreationEnabled}
          />
        </Suspense>
      </div>
    </div>
  );
}
