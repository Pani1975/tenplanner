import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { SessionsBulkList } from "./sessions-bulk-list";
import { getFavoritedSessionIds } from "@/lib/sessions/favorites";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  sessions as sessionsTable,
  sessionExercises,
  sessionDrafts,
  users as usersTable,
} from "@/db/schema";
import { and, count, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  getActiveWorkClubId,
  getClubMembersDirectory,
  sharedWithClubCondition,
} from "@/lib/clubs";
import {
  Plus,
  ArrowLeft,
  ArrowUpRight,
  Lock,
  Search,
  CalendarClock,
} from "lucide-react";
import { SessionDraftsPanel } from "@/components/app/session-drafts-panel";
import { SessionsSearchInput } from "@/components/app/sessions-search-input";
import { getAppSettings } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import {
  parseSessionSort,
  sessionNavQueryString,
  sessionOrderBy,
  SESSION_SORTS,
  type SessionSort,
} from "@/lib/nav/session-nav";
type Filter = "upcoming" | "past" | "all" | "drafts" | "cancelled";
const PAGE_SIZE = 20;

const SORT_LABELS: Record<SessionSort, string> = {
  alpha: "Alfabético",
  popular: "Más populares",
  recent: "Más recientes",
  oldest: "Más antiguos",
};

interface PageProps {
  searchParams: Promise<{
    filter?: string;
    page?: string;
    q?: string;
    sort?: string;
    monitor?: string;
  }>;
}

function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
}
function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short" })
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
function humanDate(date: Date) {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days === -1) return "ayer";
  if (days > 1 && days < 7) return `en ${days} días`;
  if (days < -1 && days > -7) return `hace ${-days} días`;
  return null;
}

export default async function SessionsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");
  const settings = await getAppSettings(["feature.session_creation_enabled"]);
  const sessionCreationEnabled =
    settings.get("feature.session_creation_enabled") !== false;

  const { filter, page, q, sort, monitor } = await searchParams;
  const activeClubId = await getActiveWorkClubId(user.id);
  const clubMembers = activeClubId
    ? await getClubMembersDirectory([activeClubId])
    : [];
  const monitorFilter =
    monitor && clubMembers.some((m) => m.id === monitor) ? monitor : null;
  const mineOrClub = sharedWithClubCondition(
    sessionsTable.userId,
    sessionsTable.clubId,
    user.id,
    activeClubId
  );
  const activeFilter: Filter =
    filter === "past" ||
    filter === "upcoming" ||
    filter === "all" ||
    filter === "drafts" ||
    filter === "cancelled"
      ? filter
      : "all";
  const searchTerm = q?.trim() ?? "";
  const activeSort = parseSessionSort({ sort });

  const parsedPage = Number(page ?? "1");
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  const whereConditions: SQL[] = [mineOrClub];
  if (monitorFilter)
    whereConditions.push(eq(sessionsTable.userId, monitorFilter));
  if (activeFilter === "upcoming")
    whereConditions.push(sql`${sessionsTable.scheduledAt} >= now()`);
  else if (activeFilter === "past")
    whereConditions.push(sql`${sessionsTable.scheduledAt} < now()`);
  else if (activeFilter === "cancelled")
    whereConditions.push(eq(sessionsTable.status, "cancelled"));
  if (searchTerm) {
    const searchWhere = or(
      ilike(sessionsTable.title, `%${searchTerm}%`),
      ilike(sessionsTable.description, `%${searchTerm}%`),
      ilike(sessionsTable.objective, `%${searchTerm}%`),
      sql`${sessionsTable.tags}::text ILIKE ${`%${searchTerm}%`}`
    );
    if (searchWhere) whereConditions.push(searchWhere);
  }
  const whereClause = and(...whereConditions) ?? mineOrClub;

  const baseCountClause = monitorFilter
    ? and(mineOrClub, eq(sessionsTable.userId, monitorFilter))!
    : mineOrClub;

  const [
    allCountRows,
    filteredCountRows,
    upcomingCountRows,
    pastCountRows,
    cancelledCountRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(sessionsTable).where(baseCountClause),
    db.select({ total: count() }).from(sessionsTable).where(whereClause),
    db
      .select({ total: count() })
      .from(sessionsTable)
      .where(
        and(baseCountClause, sql`${sessionsTable.scheduledAt} >= now()`)!
      ),
    db
      .select({ total: count() })
      .from(sessionsTable)
      .where(
        and(baseCountClause, sql`${sessionsTable.scheduledAt} < now()`)!
      ),
    db
      .select({ total: count() })
      .from(sessionsTable)
      .where(and(baseCountClause, eq(sessionsTable.status, "cancelled"))!),
  ]);

  const totalSessions = Number(allCountRows[0]?.total ?? 0);
  const totalFiltered = Number(filteredCountRows[0]?.total ?? 0);
  const upcomingCount = Number(upcomingCountRows[0]?.total ?? 0);
  const pastCount = Number(pastCountRows[0]?.total ?? 0);
  const cancelledCount = Number(cancelledCountRows[0]?.total ?? 0);

  const [draftCountRows] = await db
    .select({ total: count() })
    .from(sessionDrafts)
    .where(eq(sessionDrafts.userId, user.id));
  const draftCount = Number(draftCountRows?.total ?? 0);
  const totalPages =
    totalFiltered > 0 ? Math.ceil(totalFiltered / PAGE_SIZE) : 0;
  const safePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const offset = (safePage - 1) * PAGE_SIZE;

  const sessionRows = await db
    .select({
      id: sessionsTable.id,
      title: sessionsTable.title,
      description: sessionsTable.description,
      scheduledAt: sessionsTable.scheduledAt,
      durationMinutes: sessionsTable.durationMinutes,
      status: sessionsTable.status,
      userId: sessionsTable.userId,
      authorName: usersTable.name,
    })
    .from(sessionsTable)
    .leftJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(whereClause)
    .orderBy(...sessionOrderBy(activeSort))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Ids de todas las sesiones del filtro (para "seleccionar todas").
  const allFilteredIds = (
    await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(whereClause)
      .orderBy(...sessionOrderBy(activeSort))
      .limit(500)
  ).map((r) => r.id);

  const sessionIds = sessionRows.map((s) => s.id);
  const exerciseCounts =
    sessionIds.length > 0
      ? await db
          .select({ sessionId: sessionExercises.sessionId, count: count() })
          .from(sessionExercises)
          .where(inArray(sessionExercises.sessionId, sessionIds))
          .groupBy(sessionExercises.sessionId)
      : [];
  const exerciseCountMap = new Map(
    exerciseCounts.map((r) => [r.sessionId, r.count])
  );

  const favoritedIds = await getFavoritedSessionIds(user.id, sessionIds);

  const now = new Date();

  function sessionsHref(opts: {
    filter?: Filter;
    page?: number;
    q?: string;
    sort?: SessionSort;
    monitor?: string | null;
  }) {
    const p = new URLSearchParams();
    const f = opts.filter ?? activeFilter;
    if (f !== "all") p.set("filter", f);
    const nextQuery = Object.prototype.hasOwnProperty.call(opts, "q")
      ? opts.q
      : searchTerm;
    if (nextQuery) p.set("q", nextQuery);
    const nextPage = opts.page ?? safePage;
    if (nextPage > 1) p.set("page", String(nextPage));
    const nextSort = opts.sort ?? activeSort;
    if (nextSort !== "oldest") p.set("sort", nextSort);
    const nextMonitor = Object.prototype.hasOwnProperty.call(opts, "monitor")
      ? opts.monitor
      : monitorFilter;
    if (nextMonitor) p.set("monitor", nextMonitor);
    const qs = p.toString();
    return qs ? `/sessions?${qs}` : "/sessions";
  }

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Todas", n: totalSessions },
    { key: "upcoming", label: "Próximas", n: upcomingCount },
    { key: "past", label: "Pasadas", n: pastCount },
    { key: "cancelled", label: "Canceladas", n: cancelledCount },
    { key: "drafts", label: "Borradores", n: draftCount },
  ];
  return (
    <div className="relative min-h-full w-full bg-[#F4F4F1] dark:bg-[#050505]">
      <div className="w-full space-y-6 px-4 py-8 sm:px-6 md:px-10">
        <header className="relative overflow-hidden rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_18px_60px_rgba(5,5,5,0.06)] dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
          <div
            aria-hidden
            className="court-grid pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
          />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-[#F4F4F1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60 dark:bg-[#050505]/70">
                <CalendarClock className="size-3.5 text-brand" />
                Plan operativo
              </p>
              <h1 className="font-heading text-3xl font-semibold text-foreground md:text-4xl">
                Sesiones
              </h1>
              <p className="mt-1.5 max-w-2xl text-[14px] text-foreground/60">
                Entrenamientos agendados con fecha, hora, lugar y alumnos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                  Bloqueado
                </span>
              )}
            </div>
          </div>
        </header>

        <>
          {/* Tabs */}
          <nav className="flex flex-wrap gap-2 rounded-lg border border-[#050505]/10 bg-white p-1.5 shadow-[0_12px_40px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
            {FILTERS.map(({ key, label, n }) => {
              const isActive = activeFilter === key;
              return (
                <Link
                  key={key}
                  href={sessionsHref({ filter: key, page: 1 })}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-[#050505] text-white dark:bg-[#D6FF38] dark:text-[#050505]"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                  )}
                >
                  {label}
                  {n > 0 && (
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        isActive ? "opacity-70" : "text-foreground/45"
                      )}
                    >
                      {n}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {clubMembers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#050505]/10 bg-white p-2 shadow-[0_12px_40px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
              <span className="pl-2 text-[11px] font-bold uppercase tracking-wide text-foreground/45">
                Monitor
              </span>
              <Link
                href={sessionsHref({ monitor: null, page: 1 })}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold transition-colors",
                  !monitorFilter
                    ? "bg-[#050505] text-white dark:bg-[#D6FF38] dark:text-[#050505]"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                )}
              >
                Todos
              </Link>
              {clubMembers.map((m) => (
                <Link
                  key={m.id}
                  href={sessionsHref({ monitor: m.id, page: 1 })}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold transition-colors",
                    monitorFilter === m.id
                      ? "bg-[#050505] text-white dark:bg-[#D6FF38] dark:text-[#050505]"
                      : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                  )}
                >
                  {m.id === user.id ? "Yo" : m.name}
                </Link>
              ))}
            </div>
          )}

          {activeFilter === "drafts" ? (
            <div className="rounded-lg border border-[#050505]/10 bg-white p-3 shadow-[0_12px_40px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
              <SessionDraftsPanel showEmptyState />
            </div>
          ) : (
            <>
              <div className="space-y-3 rounded-lg border border-[#050505]/10 bg-white p-3 shadow-[0_12px_40px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
                <Suspense
                  fallback={
                    <div className="h-11 w-full animate-pulse rounded-full border border-foreground/15 bg-muted/30" />
                  }
                >
                  <SessionsSearchInput defaultValue={searchTerm} />
                </Suspense>

                {searchTerm ? (
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-foreground/55">
                    <span>
                      Resultados para{" "}
                      <span className="font-medium text-foreground">
                        &quot;{searchTerm}&quot;
                      </span>
                    </span>
                    <Link
                      href={sessionsHref({
                        filter: activeFilter,
                        q: undefined,
                        page: 1,
                      })}
                      className="rounded-full border border-[#D6FF38]/40 bg-[#D6FF38]/15 px-2.5 py-1 font-semibold text-foreground transition-colors hover:bg-[#D6FF38]/25"
                    >
                      Limpiar
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#050505]/10 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.045]">
                <span className="shrink-0 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">
                  Ordenar por:
                </span>
                {SESSION_SORTS.map((s) => {
                  const isActive = activeSort === s;
                  return (
                    <Link
                      key={s}
                      href={sessionsHref({ sort: s, page: 1 })}
                      className={cn(
                        "whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] transition-colors",
                        isActive
                          ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                          : "border-foreground/15 text-foreground/55 hover:border-foreground/30 hover:text-foreground"
                      )}
                    >
                      {SORT_LABELS[s]}
                    </Link>
                  );
                })}
              </div>

              {sessionRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#050505]/15 bg-white px-6 py-16 text-center shadow-[0_18px_50px_rgba(5,5,5,0.04)] dark:border-white/15 dark:bg-white/[0.035]">
                  <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-[#D6FF38]/35 bg-[#D6FF38]/10">
                    {searchTerm ? (
                      <Search className="size-6 text-foreground/70" />
                    ) : (
                      <CalendarClock className="size-6 text-foreground/70" />
                    )}
                  </span>
                  <p className="text-[15px] font-medium text-foreground mb-2">
                    {searchTerm
                      ? "Sin coincidencias"
                      : activeFilter === "upcoming"
                        ? "No tienes sesiones próximas"
                        : activeFilter === "past"
                          ? "No tienes sesiones pasadas"
                          : activeFilter === "cancelled"
                            ? "No tienes sesiones canceladas"
                            : "Sin sesiones todavía"}
                  </p>
                  <p className="text-[13px] text-foreground/55 max-w-sm mx-auto mb-5">
                    {searchTerm
                      ? `No hay sesiones para "${searchTerm}".`
                      : "Crea una nueva sesión para empezar."}
                  </p>
                  <Link
                    href={
                      searchTerm
                        ? sessionsHref({
                            filter: activeFilter,
                            q: undefined,
                            page: 1,
                          })
                        : "/sessions/new"
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#D6FF38] px-4 py-2 text-[13px] font-bold text-[#050505] transition-colors hover:bg-[#c8ef2f]"
                  >
                    {searchTerm ? (
                      <>
                        <Search className="size-3.5" /> Limpiar búsqueda
                      </>
                    ) : (
                      <>
                        <Plus className="size-3.5" /> Crear sesión
                      </>
                    )}
                  </Link>
                </div>
              ) : (
                <SessionsBulkList
                  items={sessionRows.map((session) => {
                    const date = new Date(session.scheduledAt);
                    const isPast = date < now;
                    return {
                      id: session.id,
                      title: session.title,
                      status: session.status,
                      dayMonth: formatDayMonth(date),
                      weekdayTime: `${formatWeekday(date)} · ${formatTime(date)}`,
                      statusLabel:
                        session.status === "completed"
                          ? "Completada"
                          : session.status === "cancelled"
                            ? "Cancelada"
                            : isPast
                              ? "Sin completar"
                              : "Programada",
                      statusColor:
                        session.status === "completed"
                          ? "bg-brand/10 text-brand border-brand/20"
                          : session.status === "cancelled"
                            ? "bg-destructive/10 text-destructive/80 border-destructive/20"
                            : isPast
                              ? "bg-foreground/5 text-foreground/55 border-border"
                              : "bg-blue-500/10 text-blue-500 border-blue-500/20",
                      relative: humanDate(date) || null,
                      durationMinutes: session.durationMinutes,
                      exerciseCount: exerciseCountMap.get(session.id) ?? 0,
                      favorited: favoritedIds.has(session.id),
                      authorName:
                        session.userId !== user.id
                          ? (session.authorName ?? null)
                          : null,
                    };
                  })}
                  allIds={allFilteredIds}
                  totalFiltered={totalFiltered}
                  navQuery={sessionNavQueryString({
                    filter: activeFilter,
                    q: searchTerm || undefined,
                    sort: activeSort,
                  })}
                />
              )}

              {totalFiltered > 0 && totalPages > 1 && (
                <footer className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#050505]/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="text-[12px] text-foreground/50 tabular-nums">
                    {offset + 1}–{offset + sessionRows.length} de{" "}
                    {totalFiltered}
                  </p>
                  <div className="flex items-center gap-3">
                    {safePage > 1 ? (
                      <Link
                        href={sessionsHref({ page: safePage - 1 })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-foreground/70 transition-colors hover:border-[#D6FF38]/70 hover:text-foreground"
                      >
                        <ArrowLeft className="size-3.5" /> Anterior
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[13px] text-foreground/25">
                        <ArrowLeft className="size-3.5" /> Anterior
                      </span>
                    )}
                    <span className="text-[12px] text-foreground/50 tabular-nums">
                      {safePage} / {totalPages}
                    </span>
                    {safePage < totalPages ? (
                      <Link
                        href={sessionsHref({ page: safePage + 1 })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-foreground/70 transition-colors hover:border-[#D6FF38]/70 hover:text-foreground"
                      >
                        Siguiente <ArrowUpRight className="size-3.5" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[13px] text-foreground/25">
                        Siguiente <ArrowUpRight className="size-3.5" />
                      </span>
                    )}
                  </div>
                </footer>
              )}
            </>
          )}
        </>
      </div>
    </div>
  );
}
