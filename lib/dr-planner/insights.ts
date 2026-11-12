import { effectiveAttended } from "@/lib/sessions/attendance";
import { db } from "@/db";
import {
  sessions,
  sessionExercises,
  sessionStudents,
  exercises,
  students,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

export type StudentSummary = {
  id: string;
  name: string;
  playerLevel: string | null;
  lastSessionAt: string | null;
  sessionsLast30d: number;
};

export async function listCoachStudentsSummary(
  coachId: string
): Promise<StudentSummary[]> {
  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);

  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      playerLevel: students.playerLevel,
      lastSessionAt: sql<Date | null>`max(${sessions.scheduledAt})`,
      sessionsLast30d: sql<number>`count(${sessions.id}) filter (where ${sessions.scheduledAt} >= ${thirty.toISOString()})`,
    })
    .from(students)
    .leftJoin(sessionStudents, eq(sessionStudents.studentId, students.id))
    .leftJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
    .where(eq(students.coachId, coachId))
    .groupBy(students.id, students.name, students.playerLevel)
    .orderBy(students.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    playerLevel: r.playerLevel,
    lastSessionAt: r.lastSessionAt
      ? new Date(r.lastSessionAt).toISOString()
      : null,
    sessionsLast30d: Number(r.sessionsLast30d ?? 0),
  }));
}

export type InactiveStudent = {
  id: string;
  name: string;
  playerLevel: string | null;
  daysSinceLast: number | null; // null = nunca tuvo sesión
  lastSessionAt: string | null;
};

export async function findInactiveStudents(
  coachId: string,
  daysThreshold = 14
): Promise<InactiveStudent[]> {
  const summary = await listCoachStudentsSummary(coachId);
  const now = Date.now();
  return summary
    .map((s) => {
      const daysSinceLast = s.lastSessionAt
        ? Math.floor((now - new Date(s.lastSessionAt).getTime()) / 86400000)
        : null;
      return {
        id: s.id,
        name: s.name,
        playerLevel: s.playerLevel,
        daysSinceLast,
        lastSessionAt: s.lastSessionAt,
      };
    })
    .filter((s) => s.daysSinceLast === null || s.daysSinceLast >= daysThreshold)
    .sort((a, b) => {
      if (a.daysSinceLast === null) return -1;
      if (b.daysSinceLast === null) return 1;
      return b.daysSinceLast - a.daysSinceLast;
    });
}

export type CategoryBreakdown = {
  category: "technique" | "tactics" | "fitness" | "warm-up";
  minutes: number;
  exerciseCount: number;
};

export type StudentAnalytics = {
  student: {
    id: string;
    name: string;
    playerLevel: string | null;
    dominantHand: string | null;
    yearsExperience: number | null;
    notes: string | null;
  };
  totalSessions: number;
  sessionsLast60d: number;
  daysSinceLast: number | null;
  avgIntensity: number | null;
  attendanceRate: number | null;
  categoriesLast60d: CategoryBreakdown[];
  phasesLast60d: {
    phase: "activation" | "main" | "cooldown";
    minutes: number;
  }[];
  topTags: { tag: string; count: number }[];
  recentSessions: {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    objective: string | null;
    intensity: number | null;
    attended: boolean | null;
  }[];
};

export async function getStudentAnalytics(
  coachId: string,
  studentId: string
): Promise<StudentAnalytics | null> {
  const [student] = await db
    .select({
      id: students.id,
      name: students.name,
      playerLevel: students.playerLevel,
      dominantHand: students.dominantHand,
      yearsExperience: students.yearsExperience,
      notes: students.notes,
    })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.coachId, coachId)))
    .limit(1);

  if (!student) return null;

  const sixty = new Date();
  sixty.setDate(sixty.getDate() - 60);

  const allSessionsRows = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      scheduledAt: sessions.scheduledAt,
      durationMinutes: sessions.durationMinutes,
      objective: sessions.objective,
      intensity: sessions.intensity,
      tags: sessions.tags,
      attended: sessionStudents.attended,
      status: sessions.status,
    })
    .from(sessionStudents)
    .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
    .where(eq(sessionStudents.studentId, studentId))
    .orderBy(desc(sessions.scheduledAt));

  const totalSessions = allSessionsRows.length;
  const now = Date.now();
  const sessionsLast60d = allSessionsRows.filter(
    (s) => new Date(s.scheduledAt).getTime() >= sixty.getTime()
  ).length;

  const lastSession = allSessionsRows[0];
  const daysSinceLast = lastSession
    ? Math.floor((now - new Date(lastSession.scheduledAt).getTime()) / 86400000)
    : null;

  const intensities = allSessionsRows
    .map((s) => s.intensity)
    .filter((n): n is number => typeof n === "number");
  const avgIntensity = intensities.length
    ? Number(
        (intensities.reduce((a, b) => a + b, 0) / intensities.length).toFixed(2)
      )
    : null;

  const attendedCount = allSessionsRows.filter(
    (s) => s.attended === true
  ).length;
  // Un "no viene" previsto solo es falta si la sesión se completó.
  const trackedCount = allSessionsRows.filter(
    (s) => effectiveAttended(s.attended, s.status) !== null
  ).length;
  const attendanceRate =
    trackedCount > 0 ? Math.round((attendedCount / trackedCount) * 100) : null;

  // Categories + phases last 60d
  const recentIds = allSessionsRows
    .filter((s) => new Date(s.scheduledAt).getTime() >= sixty.getTime())
    .map((s) => s.id);

  let categoriesLast60d: CategoryBreakdown[] = [];
  let phasesLast60d: {
    phase: "activation" | "main" | "cooldown";
    minutes: number;
  }[] = [];

  if (recentIds.length > 0) {
    const catRows = await db
      .select({
        category: exercises.category,
        minutes: sql<number>`coalesce(sum(${sessionExercises.durationMinutes}), 0)`,
        exerciseCount: sql<number>`count(*)`,
      })
      .from(sessionExercises)
      .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
      .where(inArray(sessionExercises.sessionId, recentIds))
      .groupBy(exercises.category);

    categoriesLast60d = catRows.map((r) => ({
      category: r.category as CategoryBreakdown["category"],
      minutes: Number(r.minutes ?? 0),
      exerciseCount: Number(r.exerciseCount ?? 0),
    }));

    const phaseRows = await db
      .select({
        phase: sessionExercises.phase,
        minutes: sql<number>`coalesce(sum(${sessionExercises.durationMinutes}), 0)`,
      })
      .from(sessionExercises)
      .where(inArray(sessionExercises.sessionId, recentIds))
      .groupBy(sessionExercises.phase);

    phasesLast60d = phaseRows
      .filter((r) => r.phase !== null)
      .map((r) => ({
        phase: r.phase as "activation" | "main" | "cooldown",
        minutes: Number(r.minutes ?? 0),
      }));
  }

  // Top tags
  const tagCounts = new Map<string, number>();
  for (const s of allSessionsRows) {
    const tags = (s.tags ?? []) as string[];
    for (const t of tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    student,
    totalSessions,
    sessionsLast60d,
    daysSinceLast,
    avgIntensity,
    attendanceRate,
    categoriesLast60d,
    phasesLast60d,
    topTags,
    recentSessions: allSessionsRows.slice(0, 6).map((s) => ({
      id: s.id,
      title: s.title,
      scheduledAt: new Date(s.scheduledAt).toISOString(),
      durationMinutes: s.durationMinutes,
      objective: s.objective,
      intensity: s.intensity,
      attended: s.attended,
    })),
  };
}

export type TrainingGap = {
  kind: "category" | "phase";
  key: string;
  minutes: number;
  label: string;
  severity: "alto" | "medio" | "bajo";
};

export async function detectTrainingGaps(
  coachId: string,
  studentId: string,
  windowDays = 60
): Promise<TrainingGap[]> {
  const analytics = await getStudentAnalytics(coachId, studentId);
  if (!analytics) return [];

  const categoryLabels: Record<string, string> = {
    technique: "Técnica",
    tactics: "Táctica",
    fitness: "Físico",
    "warm-up": "Calentamiento",
  };
  const allCategories: CategoryBreakdown["category"][] = [
    "technique",
    "tactics",
    "fitness",
    "warm-up",
  ];

  const byCat = new Map(
    analytics.categoriesLast60d.map((c) => [c.category, c.minutes])
  );
  const gaps: TrainingGap[] = [];

  for (const cat of allCategories) {
    const minutes = byCat.get(cat) ?? 0;
    if (minutes < 20) {
      gaps.push({
        kind: "category",
        key: cat,
        minutes,
        label: categoryLabels[cat],
        severity: minutes === 0 ? "alto" : minutes < 10 ? "medio" : "bajo",
      });
    }
  }

  const phaseLabels: Record<string, string> = {
    activation: "Activación",
    main: "Principal",
    cooldown: "Vuelta a la calma",
  };
  const byPhase = new Map(
    analytics.phasesLast60d.map((p) => [p.phase, p.minutes])
  );
  for (const ph of ["activation", "main", "cooldown"] as const) {
    const minutes = byPhase.get(ph) ?? 0;
    if (minutes === 0 && analytics.sessionsLast60d > 0) {
      gaps.push({
        kind: "phase",
        key: ph,
        minutes: 0,
        label: phaseLabels[ph],
        severity: "medio",
      });
    }
  }

  void windowDays;
  return gaps;
}

export type StudentProgressPoint = {
  month: string; // YYYY-MM
  sessions: number;
  avgIntensity: number | null;
};

export async function getStudentProgress(
  coachId: string,
  studentId: string
): Promise<StudentProgressPoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - 5);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      scheduledAt: sessions.scheduledAt,
      intensity: sessions.intensity,
    })
    .from(sessionStudents)
    .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
    .innerJoin(students, eq(students.id, sessionStudents.studentId))
    .where(
      and(
        eq(sessionStudents.studentId, studentId),
        eq(students.coachId, coachId),
        gte(sessions.scheduledAt, since)
      )
    );

  const bucket = new Map<
    string,
    { sessions: number; intensitySum: number; intensityN: number }
  >();
  const now = new Date();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    bucket.set(key, { sessions: 0, intensitySum: 0, intensityN: 0 });
  }

  for (const r of rows) {
    const d = new Date(r.scheduledAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = bucket.get(key);
    if (!b) continue;
    b.sessions += 1;
    if (typeof r.intensity === "number") {
      b.intensitySum += r.intensity;
      b.intensityN += 1;
    }
  }

  return [...bucket.entries()].map(([month, b]) => ({
    month,
    sessions: b.sessions,
    avgIntensity:
      b.intensityN > 0
        ? Number((b.intensitySum / b.intensityN).toFixed(2))
        : null,
  }));
}

export type CoachStats = {
  sessionsThisMonth: number;
  sessionsPrevMonth: number;
  minutesThisMonth: number;
  avgIntensityThisMonth: number | null;
  totalStudents: number;
  totalExercises: number;
  topExercises: { id: string; name: string; uses: number }[];
  categoryDistribution: { category: string; minutes: number }[];
};

export async function getCoachStats(coachId: string): Promise<CoachStats> {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59
  );

  const [
    thisMonthSessions,
    prevMonthSessions,
    [{ total: totalStudents = 0 } = { total: 0 }],
    [{ total: totalExercises = 0 } = { total: 0 }],
    topEx,
    catRows,
  ] = await Promise.all([
    db
      .select({
        id: sessions.id,
        durationMinutes: sessions.durationMinutes,
        intensity: sessions.intensity,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, coachId),
          gte(sessions.scheduledAt, startOfThisMonth)
        )
      ),

    db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, coachId),
          gte(sessions.scheduledAt, startOfPrevMonth),
          sql`${sessions.scheduledAt} <= ${endOfPrevMonth.toISOString()}`
        )
      ),

    db
      .select({ total: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.coachId, coachId)),

    db
      .select({ total: sql<number>`count(*)` })
      .from(exercises)
      .where(eq(exercises.createdBy, coachId)),

    db
      .select({
        id: exercises.id,
        name: exercises.name,
        uses: sql<number>`count(*)`,
      })
      .from(sessionExercises)
      .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
      .innerJoin(sessions, eq(sessions.id, sessionExercises.sessionId))
      .where(eq(sessions.userId, coachId))
      .groupBy(exercises.id, exercises.name)
      .orderBy(sql`count(*) desc`)
      .limit(3),

    db
      .select({
        category: exercises.category,
        minutes: sql<number>`coalesce(sum(${sessionExercises.durationMinutes}), 0)`,
      })
      .from(sessionExercises)
      .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
      .innerJoin(sessions, eq(sessions.id, sessionExercises.sessionId))
      .where(eq(sessions.userId, coachId))
      .groupBy(exercises.category),
  ]);

  const thisMonthIntensities = thisMonthSessions
    .map((s) => s.intensity)
    .filter((n): n is number => typeof n === "number");

  return {
    sessionsThisMonth: thisMonthSessions.length,
    sessionsPrevMonth: prevMonthSessions.length,
    minutesThisMonth: thisMonthSessions.reduce(
      (acc, s) => acc + (s.durationMinutes ?? 0),
      0
    ),
    avgIntensityThisMonth: thisMonthIntensities.length
      ? Number(
          (
            thisMonthIntensities.reduce((a, b) => a + b, 0) /
            thisMonthIntensities.length
          ).toFixed(2)
        )
      : null,
    totalStudents: Number(totalStudents),
    totalExercises: Number(totalExercises),
    topExercises: topEx.map((r) => ({
      id: r.id,
      name: r.name,
      uses: Number(r.uses),
    })),
    categoryDistribution: catRows.map((r) => ({
      category: r.category,
      minutes: Number(r.minutes ?? 0),
    })),
  };
}

export type NextSessionRecommendation = {
  focus: string;
  durationSugerida: number;
  intensitySugerida: number;
  razonamiento: string;
  targetStudents: { id: string; name: string }[];
  suggestedTags: string[];
  gaps: TrainingGap[];
};

export async function recommendNextSession(
  coachId: string,
  studentIds: string[]
): Promise<NextSessionRecommendation | null> {
  if (studentIds.length === 0) return null;

  const validStudents = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(
      and(inArray(students.id, studentIds), eq(students.coachId, coachId))
    );

  if (validStudents.length === 0) return null;

  const perStudentGaps = await Promise.all(
    validStudents.map((s) => detectTrainingGaps(coachId, s.id))
  );
  const allGaps: TrainingGap[] = perStudentGaps.flat();

  const gapScore = new Map<string, { gap: TrainingGap; count: number }>();
  for (const g of allGaps) {
    const k = `${g.kind}:${g.key}`;
    const cur = gapScore.get(k);
    if (cur) cur.count += 1;
    else gapScore.set(k, { gap: g, count: 1 });
  }

  const ranked = [...gapScore.values()].sort((a, b) => b.count - a.count);
  const primary = ranked[0]?.gap;

  const focus = primary
    ? primary.kind === "category"
      ? `Trabajar ${primary.label.toLowerCase()}`
      : `Incluir fase de ${primary.label.toLowerCase()}`
    : "Mantenimiento general y refuerzo de patrones";

  const razonamiento = primary
    ? `${validStudents.length} alumno(s) con poco volumen de ${primary.label.toLowerCase()} en los últimos 60 días.`
    : "Sin gaps evidentes; foco en mantener volumen y trabajar patrones ya establecidos.";

  return {
    focus,
    durationSugerida: 60,
    intensitySugerida: 3,
    razonamiento,
    targetStudents: validStudents,
    suggestedTags: primary ? [primary.label.toLowerCase()] : [],
    gaps: ranked.slice(0, 4).map((r) => r.gap),
  };
}
