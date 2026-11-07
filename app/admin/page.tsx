import { Suspense } from "react";
import { db } from "@/db";
import {
  users,
  exercises,
  sessions,
  sessionTemplates,
  aiUsageEvents,
  students,
  drPlannerChats,
} from "@/db/schema";
import { count, desc, gte, sql, eq } from "drizzle-orm";
import Link from "next/link";
import { AdminPageHeader, adminPageShell } from "./_components/admin-ui";

export const dynamic = "force-dynamic";

const metricCardClass =
  "rounded-[26px] border border-foreground/10 bg-card/92 p-4 shadow-[0_14px_45px_color-mix(in_oklab,var(--foreground)_4%,transparent)] dark:bg-card/82 dark:shadow-none sm:p-5";
const sectionCardClass =
  "rounded-[28px] border border-foreground/10 bg-card/92 p-4 shadow-[0_18px_55px_color-mix(in_oklab,var(--foreground)_5%,transparent)] dark:bg-card/82 dark:shadow-none sm:p-6";
const sectionCardOverflowClass =
  "overflow-hidden rounded-[28px] border border-foreground/10 bg-card/92 shadow-[0_18px_55px_color-mix(in_oklab,var(--foreground)_5%,transparent)] dark:bg-card/82 dark:shadow-none";
const metricValueClass = "font-heading text-3xl font-black";
const aiTextClass = "text-[#6f42c1] dark:text-violet-400";
const positiveTextClass = "text-[#057a55] dark:text-emerald-400";
const infoTextClass = "text-[#126b89] dark:text-sky-400";
const warningTextClass = "text-[#8a5a00] dark:text-amber-400";

// Data fetchers

async function getQuickStats() {
  const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    [totalUsers],
    [newUsers7],
    [newUsers30],
    [totalExercises],
    [globalExercises],
    [aiExercises],
    [totalSessions],
    [newSessions7],
    [totalTemplates],
    [totalStudents],
    [totalChats],
  ] = await Promise.all([
    db.select({ total: count() }).from(users),
    db
      .select({ total: count() })
      .from(users)
      .where(gte(users.createdAt, last7)),
    db
      .select({ total: count() })
      .from(users)
      .where(gte(users.createdAt, last30)),
    db.select({ total: count() }).from(exercises),
    db
      .select({ total: count() })
      .from(exercises)
      .where(eq(exercises.isGlobal, true)),
    db
      .select({ total: count() })
      .from(exercises)
      .where(eq(exercises.isAiGenerated, true)),
    db.select({ total: count() }).from(sessions),
    db
      .select({ total: count() })
      .from(sessions)
      .where(gte(sessions.createdAt, last7))
      .catch(() => [{ total: 0 }]),
    db.select({ total: count() }).from(sessionTemplates),
    db
      .select({ total: count() })
      .from(students)
      .catch(() => [{ total: 0 }] as { total: number }[]),
    db
      .select({ total: count() })
      .from(drPlannerChats)
      .catch(() => [{ total: 0 }] as { total: number }[]),
  ]);

  return {
    totalUsers: Number(totalUsers?.total ?? 0),
    newUsers7: Number(newUsers7?.total ?? 0),
    newUsers30: Number(newUsers30?.total ?? 0),
    totalExercises: Number(totalExercises?.total ?? 0),
    globalExercises: Number(globalExercises?.total ?? 0),
    aiExercises: Number(aiExercises?.total ?? 0),
    totalSessions: Number(totalSessions?.total ?? 0),
    newSessions7: Number(newSessions7?.total ?? 0),
    totalTemplates: Number(totalTemplates?.total ?? 0),
    totalStudents: Number(totalStudents?.total ?? 0),
    totalChats: Number(totalChats?.total ?? 0),
  };
}

async function getChartData() {
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [signupsByDay, sessionsByDay] = await Promise.all([
    db
      .select({
        day: sql<string>`date_trunc('day', ${users.createdAt})::date::text`,
        total: count(),
      })
      .from(users)
      .where(gte(users.createdAt, last30))
      .groupBy(sql`date_trunc('day', ${users.createdAt})`),
    db
      .select({
        day: sql<string>`date_trunc('day', ${sessions.createdAt})::date::text`,
        total: count(),
      })
      .from(sessions)
      .where(gte(sessions.createdAt, last30))
      .groupBy(sql`date_trunc('day', ${sessions.createdAt})`)
      .catch(() => [] as { day: string; total: number }[]),
  ]);

  return { signupsByDay, sessionsByDay };
}

async function getAiData() {
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [aiByModel, [aiTotals]] = await Promise.all([
    db
      .select({
        model: aiUsageEvents.model,
        requests: count(),
        tokens: sql<string>`coalesce(sum(${aiUsageEvents.totalTokens} - ${aiUsageEvents.cacheReadTokens}), 0)::text`,
      })
      .from(aiUsageEvents)
      .where(gte(aiUsageEvents.createdAt, last30))
      .groupBy(aiUsageEvents.model)
      .catch(
        () => [] as { model: string; requests: number; tokens: string | null }[]
      ),
    db
      .select({
        requests: count(),
        tokens: sql<string>`coalesce(sum(${aiUsageEvents.totalTokens} - ${aiUsageEvents.cacheReadTokens}), 0)::text`,
      })
      .from(aiUsageEvents)
      .where(gte(aiUsageEvents.createdAt, last30))
      .catch(() => [{ requests: 0, tokens: null }]),
  ]);

  return {
    aiByModel,
    aiRequests30: Number(aiTotals?.requests ?? 0),
    aiTokens30: Number(aiTotals?.tokens ?? 0),
  };
}

async function getRecentSessions() {
  return db
    .select({
      id: sessions.id,
      title: sessions.title,
      createdAt: sessions.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(sessions)
    .leftJoin(users, eq(sessions.userId, users.id))
    .orderBy(desc(sessions.createdAt))
    .limit(10)
    .catch(
      () =>
        [] as {
          id: string;
          title: string;
          createdAt: Date | null;
          userName: string | null;
          userEmail: string | null;
        }[]
    );
}

// Section components

async function QuickStatsSection() {
  const m = await getQuickStats();

  const userStats = [
    {
      label: "Usuarios totales",
      value: m.totalUsers,
      color: "text-foreground",
    },
    { label: "Nuevos (7 días)", value: m.newUsers7, color: "text-brand" },
    { label: "Nuevos (30 días)", value: m.newUsers30, color: "text-brand" },
  ];

  const contentStats = [
    { label: "Ejercicios", value: m.totalExercises, color: "text-foreground" },
    { label: "Globales", value: m.globalExercises, color: "text-brand" },
    { label: "Generados IA", value: m.aiExercises, color: aiTextClass },
    { label: "Sesiones", value: m.totalSessions, color: "text-foreground" },
    { label: "Plantillas", value: m.totalTemplates, color: warningTextClass },
  ];

  return (
    <>
      {/* Users */}
      <section>
        <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">
          Usuarios
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          {userStats.map((s) => (
            <div key={s.label} className={metricCardClass}>
              <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
                {s.label}
              </p>
              <p className={`${metricValueClass} ${s.color}`}>
                {s.value.toLocaleString("es-ES")}
              </p>
            </div>
          ))}
          <div className={metricCardClass}>
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
              Alumnos
            </p>
            <p className={`${metricValueClass} ${positiveTextClass}`}>
              {m.totalStudents.toLocaleString("es-ES")}
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section>
        <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">
          Contenido
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {contentStats.map((s) => (
            <div key={s.label} className={metricCardClass}>
              <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
                {s.label}
              </p>
              <p className={`${metricValueClass} ${s.color}`}>
                {s.value.toLocaleString("es-ES")}
              </p>
            </div>
          ))}
          <div className={metricCardClass}>
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
              Sesiones (7d)
            </p>
            <p className={`${metricValueClass} ${infoTextClass}`}>
              {m.newSessions7.toLocaleString("es-ES")}
            </p>
          </div>
        </div>
      </section>

      {/* Dr. Planner quick links */}
      <section>
        <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">
          Dr. Planner
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          <div className={metricCardClass}>
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
              Chats totales
            </p>
            <p className={`${metricValueClass} ${aiTextClass}`}>
              {m.totalChats.toLocaleString("es-ES")}
            </p>
          </div>
          <Link
            href="/admin/ai"
            className={`${metricCardClass} transition-colors hover:border-brand/70 hover:bg-brand/8`}
          >
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
              Configuración IA
            </p>
            <p className="font-heading text-base font-semibold text-foreground/60">
              Ver ajustes -&gt;
            </p>
          </Link>
          <Link
            href="/admin/embeddings"
            className={`${metricCardClass} transition-colors hover:border-brand/70 hover:bg-brand/8`}
          >
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
              Embeddings
            </p>
            <p className="font-heading text-base font-semibold text-foreground/60">
              Gestionar -&gt;
            </p>
          </Link>
        </div>
      </section>

      {/* Exercise distribution */}
      {m.totalExercises > 0 && (
        <section>
          <div className={sectionCardClass}>
            <h2 className="font-heading text-base font-semibold text-foreground mb-4">
              Distribucion de ejercicios
            </h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-foreground/50 mb-1">
                  <span>Globales</span>
                  <span>
                    {m.globalExercises} (
                    {Math.round((m.globalExercises / m.totalExercises) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${(m.globalExercises / m.totalExercises) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-foreground/50 mb-1">
                  <span>Generados por IA</span>
                  <span>
                    {m.aiExercises} (
                    {Math.round((m.aiExercises / m.totalExercises) * 100)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-foreground/8">
                  <div
                    className="h-full rounded-full bg-[#6f42c1] dark:bg-violet-400"
                    style={{
                      width: `${(m.aiExercises / m.totalExercises) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

async function ChartsSection() {
  const { signupsByDay, sessionsByDay } = await getChartData();

  const maxSignups = Math.max(...signupsByDay.map((r) => Number(r.total)), 1);
  const maxSessions = Math.max(...sessionsByDay.map((r) => Number(r.total)), 1);

  return (
    <section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={sectionCardClass}>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Registros (30d)
            </h2>
          </div>
          {signupsByDay.length === 0 ? (
            <p className="text-sm text-foreground/40">Sin datos</p>
          ) : (
            <div className="space-y-1.5">
              {signupsByDay
                .sort((a, b) => b.day.localeCompare(a.day))
                .slice(0, 15)
                .map((row) => (
                  <div key={row.day} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 font-mono text-[10px] text-foreground/40">
                      {new Date(row.day).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{
                          width: `${Math.max(4, (Number(row.total) / maxSignups) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-sans text-[11px] font-semibold text-foreground/60 w-5 text-right tabular-nums">
                      {row.total}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className={sectionCardClass}>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Sesiones creadas (30d)
            </h2>
          </div>
          {sessionsByDay.length === 0 ? (
            <p className="text-sm text-foreground/40">Sin datos</p>
          ) : (
            <div className="space-y-1.5">
              {sessionsByDay
                .sort((a, b) => b.day.localeCompare(a.day))
                .slice(0, 15)
                .map((row) => (
                  <div key={row.day} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 font-mono text-[10px] text-foreground/40">
                      {new Date(row.day).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#126b89] transition-all dark:bg-sky-400"
                        style={{
                          width: `${Math.max(4, (Number(row.total) / maxSessions) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-sans text-[11px] font-semibold text-foreground/60 w-5 text-right tabular-nums">
                      {row.total}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

async function AiUsageSection() {
  const { aiByModel, aiRequests30, aiTokens30 } = await getAiData();

  if (aiRequests30 === 0) return null;

  const totalAiTokensFormatted =
    aiTokens30 >= 1_000_000
      ? `${(aiTokens30 / 1_000_000).toFixed(1)}M`
      : aiTokens30 >= 1_000
        ? `${(aiTokens30 / 1_000).toFixed(1)}K`
        : String(aiTokens30);

  return (
    <section>
      <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">
        Uso de IA - últimos 30 días
      </p>
      <div className={sectionCardClass}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-6">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-1">
              Peticiones
            </p>
            <p className={`${metricValueClass} ${aiTextClass}`}>
              {aiRequests30.toLocaleString("es-ES")}
            </p>
          </div>
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-1">
              Tokens totales
            </p>
            <p className={`${metricValueClass} ${aiTextClass}`}>
              {totalAiTokensFormatted}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-1">
              Modelos activos
            </p>
            <p className={`${metricValueClass} ${aiTextClass}`}>
              {aiByModel.length}
            </p>
          </div>
        </div>
        {aiByModel.length > 0 && (
          <div className="space-y-2 border-t border-foreground/8 pt-4">
            {aiByModel
              .sort((a, b) => Number(b.tokens ?? 0) - Number(a.tokens ?? 0))
              .map((m) => {
                const tokens = Number(m.tokens ?? 0);
                const maxTokens = Math.max(
                  ...aiByModel.map((x) => Number(x.tokens ?? 0)),
                  1
                );
                return (
                  <div key={m.model} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 font-mono text-[10px] text-foreground/50 truncate">
                      {m.model}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6f42c1] transition-all dark:bg-violet-400"
                        style={{
                          width: `${Math.max(4, (tokens / maxTokens) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-sans text-[10px] text-foreground/50 w-20 text-right tabular-nums shrink-0">
                      {m.requests} req
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
}

async function RecentActivitySection() {
  const recentSessions = await getRecentSessions();

  if (recentSessions.length === 0) return null;

  return (
    <section>
      <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">
        Actividad reciente
      </p>
      <div className={sectionCardOverflowClass}>
        <div className="divide-y divide-foreground/8">
          {recentSessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {session.title || "Sin título"}
                </p>
                <p className="text-xs text-foreground/45 truncate">
                  {session.userName ??
                    session.userEmail ??
                    "Usuario desconocido"}
                </p>
              </div>
              <time className="shrink-0 font-mono text-[10px] text-foreground/35">
                {session.createdAt
                  ? new Date(session.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })
                  : "-"}
              </time>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function SystemHealthSection() {
  const checks = [
    { label: "ANTHROPIC_API_KEY", ok: !!process.env.ANTHROPIC_API_KEY },
    { label: "VOYAGE_API_KEY", ok: !!process.env.VOYAGE_API_KEY },
    { label: "DATABASE_URL", ok: !!process.env.DATABASE_URL },
    {
      label: "NEXT_PUBLIC_SUPABASE_URL",
      ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  ];

  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const allOk = checks.every((c) => c.ok) && dbOk;

  return (
    <section>
      <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/40 mb-3">
        Estado del sistema
      </p>
      <div className={sectionCardClass}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Diagnostico de entorno
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              allOk
                ? "bg-emerald-500/10 text-[#057a55] dark:text-emerald-300"
                : "bg-amber-500/10 text-[#8a5a00] dark:text-amber-300"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${allOk ? "bg-[#057a55] dark:bg-emerald-400" : "bg-[#8a5a00] dark:bg-amber-400"}`}
            />
            {allOk ? "Todo en orden" : "Atencion requerida"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {/* DB connectivity */}
          <div className="flex items-center gap-2.5 rounded-xl border border-foreground/8 bg-background px-3 py-2.5">
            <span
              className={`size-2 shrink-0 rounded-full ${dbOk ? "bg-[#057a55] dark:bg-emerald-400" : "bg-[#dc2626] dark:bg-red-400"}`}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">
                Base de datos
              </p>
              <p className="font-mono text-[10px] text-foreground/40">
                {dbOk ? "Conectada" : "Sin conexión"}
              </p>
            </div>
          </div>
          {/* Env checks */}
          {checks.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-2.5 rounded-xl border border-foreground/8 bg-background px-3 py-2.5"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${c.ok ? "bg-[#057a55] dark:bg-emerald-400" : "bg-[#8a5a00] dark:bg-amber-400"}`}
              />
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-medium text-foreground truncate">
                  {c.label}
                </p>
                <p className="text-[10px] text-foreground/40">
                  {c.ok ? "Configurada" : "No configurada"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Skeletons

function StatsSkeleton() {
  return (
    <>
      <section>
        <div className="h-3 w-16 rounded bg-foreground/8 mb-3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${metricCardClass} space-y-2`}>
              <div className="h-2 w-20 rounded bg-foreground/8 animate-pulse" />
              <div className="h-8 w-12 rounded bg-foreground/8 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="h-3 w-16 rounded bg-foreground/8 mb-3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${metricCardClass} space-y-2`}>
              <div className="h-2 w-16 rounded bg-foreground/8 animate-pulse" />
              <div className="h-8 w-10 rounded bg-foreground/8 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ChartsSkeleton() {
  return (
    <section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`${sectionCardClass} space-y-3`}>
            <div className="h-4 w-32 rounded bg-foreground/8 animate-pulse" />
            {Array.from({ length: 8 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-2 w-14 rounded bg-foreground/8 animate-pulse" />
                <div className="flex-1 h-1.5 rounded-full bg-foreground/8 animate-pulse" />
                <div className="h-2 w-4 rounded bg-foreground/8 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionSkeleton() {
  return (
    <div className={`${sectionCardClass} space-y-3`}>
      <div className="h-4 w-40 rounded bg-foreground/8 animate-pulse" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-2 w-28 rounded bg-foreground/8 animate-pulse" />
          <div className="flex-1 h-1.5 rounded-full bg-foreground/8 animate-pulse" />
          <div className="h-2 w-12 rounded bg-foreground/8 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// Page

export default function AdminDashboard() {
  return (
    <div className={adminPageShell}>
      <AdminPageHeader
        eyebrow="Admin / Control"
        title="Metricas"
        description="Vista general operacional de la plataforma."
      />

      <Suspense fallback={<StatsSkeleton />}>
        <QuickStatsSection />
      </Suspense>

      <Suspense fallback={<ChartsSkeleton />}>
        <ChartsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <AiUsageSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <RecentActivitySection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <SystemHealthSection />
      </Suspense>
    </div>
  );
}
