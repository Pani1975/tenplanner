import { db } from "@/db";
import { exercises, sessions, sessionExercises, users } from "@/db/schema";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { AdminPageHeader, adminPageShell } from "../_components/admin-ui";
import { AdminContentClient } from "./content-client";

const PER_PAGE = 50;

type ExFilter =
  | "all"
  | "global"
  | "private"
  | "ai"
  | "published"
  | "unpublished";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    exFilter?: string;
    exPage?: string;
    sPage?: string;
    tab?: string;
  }>;
}

export default async function AdminContentPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const exFilter = (
    ["all", "global", "private", "ai", "published", "unpublished"].includes(
      params.exFilter ?? ""
    )
      ? params.exFilter
      : "all"
  ) as ExFilter;
  const exPage = Math.max(1, Number(params.exPage ?? 1));
  const sPage = Math.max(1, Number(params.sPage ?? 1));
  const tab = params.tab === "sessions" ? "sessions" : "exercises";

  // Exercise conditions
  const exConditions = [];
  if (q) exConditions.push(ilike(exercises.name, `%${q}%`));
  if (exFilter === "global") exConditions.push(eq(exercises.isGlobal, true));
  if (exFilter === "private") exConditions.push(eq(exercises.isGlobal, false));
  if (exFilter === "ai") exConditions.push(eq(exercises.isAiGenerated, true));
  // Publicación en la biblioteca (solo ejercicios de Ten Planner).
  if (exFilter === "published")
    exConditions.push(
      and(eq(exercises.isGlobal, true), eq(exercises.isPublished, true))!
    );
  if (exFilter === "unpublished")
    exConditions.push(
      and(eq(exercises.isGlobal, true), eq(exercises.isPublished, false))!
    );
  const exWhere = exConditions.length > 0 ? and(...exConditions) : undefined;

  // Session conditions
  const sConditions = [];
  if (q) {
    sConditions.push(
      or(ilike(sessions.title, `%${q}%`), ilike(users.name, `%${q}%`))
    );
  }
  // Note: sessions query uses a join so we can't use a simple where — handled below

  const [exerciseRows, exerciseTotal, sessionRows, sessionTotal] =
    await Promise.all([
      db
        .select({
          id: exercises.id,
          name: exercises.name,
          category: exercises.category,
          difficulty: exercises.difficulty,
          durationMinutes: exercises.durationMinutes,
          isGlobal: exercises.isGlobal,
          isPublished: exercises.isPublished,
          isAiGenerated: exercises.isAiGenerated,
          createdAt: exercises.createdAt,
          createdByEmail: users.email,
          createdByName: users.name,
          usageCount: sql<number>`(
            select count(*)::int from ${sessionExercises}
            where ${sessionExercises.exerciseId} = ${exercises.id}
          )`,
        })
        .from(exercises)
        .leftJoin(users, eq(exercises.createdBy, users.id))
        .where(exWhere)
        .orderBy(desc(exercises.createdAt))
        .limit(PER_PAGE)
        .offset((exPage - 1) * PER_PAGE),
      db
        .select({ total: count() })
        .from(exercises)
        .leftJoin(users, eq(exercises.createdBy, users.id))
        .where(exWhere),
      db
        .select({
          id: sessions.id,
          title: sessions.title,
          status: sessions.status,
          scheduledAt: sessions.scheduledAt,
          durationMinutes: sessions.durationMinutes,
          createdAt: sessions.createdAt,
          userEmail: users.email,
          userName: users.name,
          exerciseCount: sql<number>`(
            select count(*)::int from ${sessionExercises}
            where ${sessionExercises.sessionId} = ${sessions.id}
          )`,
        })
        .from(sessions)
        .leftJoin(users, eq(sessions.userId, users.id))
        .where(
          q
            ? or(
                ilike(sessions.title, `%${q}%`),
                ilike(users.name, `%${q}%`),
                ilike(users.email, `%${q}%`)
              )
            : undefined
        )
        .orderBy(desc(sessions.createdAt))
        .limit(PER_PAGE)
        .offset((sPage - 1) * PER_PAGE),
      db
        .select({ total: count() })
        .from(sessions)
        .leftJoin(users, eq(sessions.userId, users.id))
        .where(
          q
            ? or(
                ilike(sessions.title, `%${q}%`),
                ilike(users.name, `%${q}%`),
                ilike(users.email, `%${q}%`)
              )
            : undefined
        ),
    ]);

  const exTotalNum = Number(exerciseTotal[0]?.total ?? 0);
  const sTotalNum = Number(sessionTotal[0]?.total ?? 0);

  return (
    <div className={adminPageShell}>
      <AdminPageHeader
        eyebrow="Admin / Biblioteca"
        title="Contenido"
        description={`${exTotalNum.toLocaleString("es-ES")} ejercicios · ${sTotalNum.toLocaleString("es-ES")} sesiones administrables.`}
      />
      <AdminContentClient
        exercises={exerciseRows.map((e) => ({
          ...e,
          usageCount: Number(e.usageCount ?? 0),
          createdAt: e.createdAt.toISOString(),
        }))}
        exerciseTotal={exTotalNum}
        exercisePage={exPage}
        exerciseTotalPages={Math.ceil(exTotalNum / PER_PAGE)}
        sessions={sessionRows.map((s) => ({
          ...s,
          exerciseCount: Number(s.exerciseCount ?? 0),
          scheduledAt: s.scheduledAt?.toISOString() ?? new Date().toISOString(),
          createdAt: s.createdAt.toISOString(),
        }))}
        sessionTotal={sTotalNum}
        sessionPage={sPage}
        sessionTotalPages={Math.ceil(sTotalNum / PER_PAGE)}
        q={q}
        exFilter={exFilter}
        tab={tab}
      />
    </div>
  );
}
