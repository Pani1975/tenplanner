import Link from "next/link";
import { getWorkMode, personalTitle } from "@/lib/work-mode";
import { redirect } from "next/navigation";
import { and, asc, count, eq, ilike, type SQL } from "drizzle-orm";
import { Plus, Search, ArrowLeft, ArrowUpRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { students as studentsTable, users as usersTable } from "@/db/schema";
import {
  getActiveWorkClubId,
  getClubMembersDirectory,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { cn } from "@/lib/utils";
import { loadStudentsStats } from "@/lib/students/load-stats";
import { StudentsStatsSection } from "@/components/app/students/students-stats-section";

const PAGE_SIZE = 30;

type PlayerLevel =
  | "beginner"
  | "amateur"
  | "intermediate"
  | "advanced"
  | "competitive";

const LEVEL_LABEL: Record<PlayerLevel, string> = {
  beginner: "Principiante",
  amateur: "Amateur",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  competitive: "Competitivo",
};

const LEVEL_CODE: Record<PlayerLevel, string> = {
  beginner: "L1",
  amateur: "L2",
  intermediate: "L3",
  advanced: "L4",
  competitive: "L5",
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; monitor?: string }>;
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function StudentsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { q, page, monitor } = await searchParams;
  const searchTerm = q?.trim() ?? "";
  const parsedPage = Number(page ?? "1");
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const activeClubId = await getActiveWorkClubId(user.id);
  const clubMembers = activeClubId
    ? await getClubMembersDirectory([activeClubId])
    : [];
  const monitorFilter =
    monitor && clubMembers.some((m) => m.id === monitor) ? monitor : null;

  const visibility = sharedWithClubCondition(
    studentsTable.coachId,
    studentsTable.clubId,
    user.id,
    activeClubId
  );
  const baseConditions: SQL[] = [
    visibility,
    ...(monitorFilter ? [eq(studentsTable.coachId, monitorFilter)] : []),
  ];

  const conditions: SQL[] = [...baseConditions];
  if (searchTerm) conditions.push(ilike(studentsTable.name, `%${searchTerm}%`));
  const listWhere = and(...conditions);
  const baseWhere = and(...baseConditions);

  const [rowPage, totalRows, stats] = await Promise.all([
    db
      .select({
        student: studentsTable,
        authorName: usersTable.name,
      })
      .from(studentsTable)
      .leftJoin(usersTable, eq(usersTable.id, studentsTable.coachId))
      .where(listWhere)
      .orderBy(asc(studentsTable.name))
      .limit(PAGE_SIZE + 1)
      .offset(offset),
    db.select({ total: count() }).from(studentsTable).where(baseWhere),
    loadStudentsStats({
      userId: user.id,
      activeClubId,
      monitorFilter,
    }),
  ]);

  const hasNextPage = rowPage.length > PAGE_SIZE;
  const pageRows = hasNextPage ? rowPage.slice(0, PAGE_SIZE) : rowPage;
  const filtered = pageRows.map((r) => ({
    ...r.student,
    authorName: r.student.coachId !== user.id ? (r.authorName ?? null) : null,
  }));
  const totalStudents = Number(totalRows[0]?.total ?? 0);

  function buildHrefWithMonitor(m?: string) {
    const p = new URLSearchParams();
    if (searchTerm) p.set("q", searchTerm);
    if (m) p.set("monitor", m);
    const s = p.toString();
    return `/students${s ? `?${s}` : ""}`;
  }

  function buildHref(params: { q?: string; page?: string }) {
    const p = new URLSearchParams();
    if (params.q) p.set("q", params.q);
    if (params.page && params.page !== "1") p.set("page", params.page);
    if (monitorFilter) p.set("monitor", monitorFilter);
    const s = p.toString();
    return `/students${s ? `?${s}` : ""}`;
  }

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel flex flex-wrap items-end justify-between gap-5 p-6 text-white sm:p-8">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
              <Users className="size-3.5" />
              Cartera
            </p>
            <h1 className="break-words text-4xl font-black leading-tight text-white sm:text-5xl">
              {user
                ? personalTitle("Alumnos", await getWorkMode(user.id))
                : "Alumnos"}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
              {totalStudents} alumno{totalStudents !== 1 ? "s" : ""} registrado
              {totalStudents !== 1 ? "s" : ""}.
            </p>
          </div>
          {totalStudents > 0 && (
            <Link
              href="/students/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-4 text-[13px] font-black text-[#050505] transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" />
              Nuevo alumno
            </Link>
          )}
        </header>

        {clubMembers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#050505]/10 bg-white p-2 shadow-[0_12px_40px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
            <span className="pl-2 text-[11px] font-bold uppercase tracking-wide text-foreground/45">
              Monitor
            </span>
            <Link
              href={buildHrefWithMonitor()}
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
                href={buildHrefWithMonitor(m.id)}
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

        {/* Estadísticas: niveles, edades, grupos y procedencia */}
        {totalStudents > 0 && (
          <StudentsStatsSection
            stats={stats}
            reportHref={`/api/students/stats/pdf${monitorFilter ? `?monitor=${monitorFilter}` : ""}`}
          />
        )}

        {/* Search rail */}
        {totalStudents > 0 && (
          <section className="tp-panel grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4">
            <p className="text-[10px] font-black tabular-nums text-brand">01</p>
            <form className="relative" action="/students" method="get">
              {monitorFilter && (
                <input type="hidden" name="monitor" value={monitorFilter} />
              )}
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground/40" />
              <input
                type="search"
                name="q"
                placeholder="Buscar por nombre…"
                defaultValue={searchTerm}
                className="tp-field h-10 w-full pl-8 pr-4 text-[13px] font-medium placeholder:text-foreground/40 sm:max-w-md"
              />
            </form>
            <p className="text-[10px] font-black tabular-nums text-foreground/50">
              {filtered.length}/{totalStudents}
            </p>
          </section>
        )}

        {/* Empty */}
        {totalStudents === 0 ? (
          <div className="tp-panel border-dashed px-6 py-20 text-center">
            <p className="tp-kicker mb-4">Estantería vacía</p>
            <h2 className="mb-3 text-3xl font-black text-foreground">
              Todavía no tienes alumnos.
            </h2>
            <p className="text-[13px] text-foreground/55 max-w-md mx-auto mb-6">
              Crea tu primera ficha para empezar a planificar sesiones
              personalizadas.
            </p>
            <Link
              href="/students/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-[12px] font-black uppercase text-[#050505] transition-colors hover:bg-[#c8f52e]"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Crear alumno
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tp-panel border-dashed px-6 py-16 text-center">
            <p className="tp-kicker mb-2">Sin resultados</p>
            <p className="mb-3 text-2xl font-black text-foreground">
              Ningún alumno coincide con &ldquo;
              <span className="text-brand">{searchTerm}</span>&rdquo;.
            </p>
            <Link
              href="/students"
              className="inline-flex items-center gap-1.5 text-[12px] tracking-wide text-foreground/60 hover:text-brand transition-colors uppercase border-b border-foreground/30 hover:border-brand"
            >
              Limpiar búsqueda
            </Link>
          </div>
        ) : (
          <section>
            <div className="grid grid-cols-[auto_1fr] items-baseline gap-3 rounded-t-[28px] border border-[#050505]/10 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#10100e]">
              <p className="text-[10px] font-black tabular-nums text-brand">
                02
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Fichas · ordenadas alfabéticamente
              </p>
            </div>
            <ul className="overflow-hidden rounded-b-[28px] border-x border-b border-[#050505]/10 bg-white dark:border-white/10 dark:bg-[#10100e]">
              {filtered.map((student, idx) => {
                const level = student.playerLevel as PlayerLevel | null;
                const n = String(idx + 1).padStart(3, "0");
                return (
                  <li
                    key={student.id}
                    className="border-b border-[#050505]/10 last:border-b-0 dark:border-white/10"
                  >
                    <Link
                      href={`/students/${student.id}`}
                      className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-5 transition-colors hover:bg-brand/10 sm:grid-cols-[auto_auto_1fr_auto_auto] sm:gap-5"
                    >
                      <span className="hidden w-8 font-sans text-[10px] tabular-nums tracking-[0.18em] text-foreground/35 sm:inline">
                        {n}
                      </span>
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#050505]/10 bg-muted dark:border-white/10">
                        {student.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={student.imageUrl}
                            alt={student.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="text-[12px] font-black text-foreground/75">
                            {initialsFromName(student.name)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-[15px] font-black text-foreground transition-colors group-hover:text-brand">
                          <span className="truncate">{student.name}</span>
                          {student.authorName && (
                            <span className="shrink-0 inline-flex items-center rounded-full border border-[#050505]/10 bg-[#F4F4F1] px-2 py-0.5 text-[10px] font-bold uppercase text-foreground/50 dark:border-white/10 dark:bg-white/[0.06]">
                              {student.authorName}
                            </span>
                          )}
                        </p>
                        {student.email && (
                          <p className="text-[11px] text-foreground/45 truncate mt-0.5 tabular-nums">
                            {student.email}
                          </p>
                        )}
                      </div>
                      {level ? (
                        <div className="hidden sm:flex flex-col items-end">
                          <span className="font-sans text-[9px] tracking-[0.22em] text-foreground/45 uppercase">
                            {LEVEL_CODE[level]}
                          </span>
                          <span className="text-[12px] text-foreground/70">
                            {LEVEL_LABEL[level]}
                          </span>
                        </div>
                      ) : (
                        <span className="hidden sm:inline font-sans text-[9px] tracking-[0.22em] text-foreground/30 uppercase">
                          — · sin nivel
                        </span>
                      )}
                      <span className="font-sans text-[11px] tracking-[0.22em] text-foreground/40 group-hover:text-brand transition-colors">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Pagination */}
        {(currentPage > 1 || hasNextPage) && (
          <nav className="tp-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/45 tabular-nums">
              {filtered.length > 0
                ? `${offset + 1}–${offset + filtered.length}`
                : "0"}{" "}
              · Página {currentPage.toString().padStart(2, "0")}
            </p>
            <div className="flex items-center gap-5">
              {currentPage > 1 ? (
                <Link
                  href={buildHref({
                    q: searchTerm || undefined,
                    page: String(currentPage - 1),
                  })}
                  className="inline-flex items-center gap-1.5 text-[12px] text-foreground/70 hover:text-brand transition-colors"
                >
                  <ArrowLeft className="size-3" /> Anterior
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/25">
                  <ArrowLeft className="size-3" /> Anterior
                </span>
              )}
              {hasNextPage ? (
                <Link
                  href={buildHref({
                    q: searchTerm || undefined,
                    page: String(currentPage + 1),
                  })}
                  className="inline-flex items-center gap-1.5 text-[12px] text-foreground/70 hover:text-brand transition-colors"
                >
                  Siguiente <ArrowUpRight className="size-3" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/25">
                  Siguiente <ArrowUpRight className="size-3" />
                </span>
              )}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
