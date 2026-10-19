import { notFound, redirect } from "next/navigation";
import { TrainingStatsPanel } from "@/components/app/training-stats-panel";
import { loadStudentTrainingStats } from "@/lib/stats/load-training-stats";
import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Pencil, ClipboardList, Clock, Flame, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { clubs, students, sessionStudents, sessions, users } from "@/db/schema";
import { cn } from "@/lib/utils";
import { DeleteStudentButton } from "./delete-student-button";
import { SessionFeedback } from "./session-feedback";
import { UpcomingList } from "./upcoming-list";
import { GenerateProfileLinkButton } from "./generate-profile-link";
import { GuardiansPanel } from "./guardians-panel";
import { listGuardians } from "@/lib/guardians";
import { isAdult } from "@/lib/age";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { defaultBallForStudent, loadStudentObjectives } from "@/lib/objectives";
import { ObjectivesChecklist } from "./objectives-checklist";

type Gender = "male" | "female" | "other";
type DominantHand = "left" | "right";
type PlayerLevel =
  | "beginner"
  | "amateur"
  | "intermediate"
  | "advanced"
  | "competitive";

const GENDER_LABEL: Record<Gender, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};
const HAND_LABEL: Record<DominantHand, string> = {
  left: "Zurdo",
  right: "Diestro",
};
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

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
function ageFromBirthDate(birthDate: string) {
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const PAST_RENDER_LIMIT = 120;
const UPCOMING_RENDER_LIMIT = 120;

export default async function StudentDetailPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const activeClubId = await getActiveWorkClubId(user.id);
  const [student] = await db
    .select()
    .from(students)
    .where(
      and(
        eq(students.id, id),
        sharedWithClubCondition(
          students.coachId,
          students.clubId,
          user.id,
          activeClubId
        )
      )
    )
    .limit(1);
  if (!student) notFound();

  const isOwner = student.coachId === user.id;
  const authorName = isOwner
    ? null
    : ((
        await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, student.coachId))
          .limit(1)
      )[0]?.name ?? null);

  // Contactos para los mensajes del club (solo alumnos de un club). Si las
  // tablas de mensajes no existieran, la ficha se muestra igual sin la sección.
  const guardiansData = student.clubId
    ? await Promise.all([
        listGuardians(student.id),
        db
          .select({ name: clubs.name })
          .from(clubs)
          .where(eq(clubs.id, student.clubId))
          .limit(1),
      ])
        .then(([list, [club]]) => ({ list, clubName: club?.name ?? "El club" }))
        .catch((error) => {
          console.error("[student] guardians failed", error);
          return null;
        })
    : null;

  const trainingStatsPromise = loadStudentTrainingStats(id);
  // Si las tablas de objetivos no existieran, la ficha se muestra igual sin la sección.
  const objectives = await loadStudentObjectives(student.id).catch((error) => {
    console.error("[student] objectives failed", error);
    return null;
  });
  const [statsRows, past, upcoming] = await Promise.all([
    db
      .select({
        totalSessions: sql<number>`COUNT(*)`,
        totalMinutes: sql<number>`COALESCE(SUM(${sessions.durationMinutes}), 0)`,
        pastCount: sql<number>`COUNT(*) FILTER (WHERE ${sessions.scheduledAt} < now())`,
        upcomingCount: sql<number>`COUNT(*) FILTER (WHERE ${sessions.scheduledAt} >= now())`,
        pastMinutes: sql<number>`COALESCE(SUM(${sessions.durationMinutes}) FILTER (WHERE ${sessions.scheduledAt} < now()), 0)`,
        avgRating: sql<
          number | null
        >`AVG(${sessionStudents.rating}) FILTER (WHERE ${sessions.scheduledAt} < now() AND ${sessionStudents.rating} IS NOT NULL)`,
        avgIntensity: sql<
          number | null
        >`AVG(${sessions.intensity}) FILTER (WHERE ${sessions.scheduledAt} < now() AND ${sessions.intensity} IS NOT NULL)`,
        pastWithAttendanceCount: sql<number>`COUNT(*) FILTER (WHERE ${sessions.scheduledAt} < now() AND ${sessionStudents.attended} IS NOT NULL)`,
        attendedCount: sql<number>`COUNT(*) FILTER (WHERE ${sessions.scheduledAt} < now() AND ${sessionStudents.attended} = true)`,
        last30PastCount: sql<number>`COUNT(*) FILTER (WHERE ${sessions.scheduledAt} >= (now() - INTERVAL '30 days') AND ${sessions.scheduledAt} < now())`,
      })
      .from(sessionStudents)
      .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
      .where(eq(sessionStudents.studentId, student.id)),
    db
      .select({
        ssId: sessionStudents.id,
        attended: sessionStudents.attended,
        rating: sessionStudents.rating,
        feedback: sessionStudents.feedback,
        sessionId: sessions.id,
        title: sessions.title,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        intensity: sessions.intensity,
        objective: sessions.objective,
      })
      .from(sessionStudents)
      .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
      .where(
        and(
          eq(sessionStudents.studentId, student.id),
          sql`${sessions.scheduledAt} < now()`
        )
      )
      .orderBy(desc(sessions.scheduledAt))
      .limit(PAST_RENDER_LIMIT),
    db
      .select({
        ssId: sessionStudents.id,
        sessionId: sessions.id,
        title: sessions.title,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
      })
      .from(sessionStudents)
      .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
      .where(
        and(
          eq(sessionStudents.studentId, student.id),
          sql`${sessions.scheduledAt} >= now()`
        )
      )
      .orderBy(asc(sessions.scheduledAt))
      .limit(UPCOMING_RENDER_LIMIT),
  ]);

  const stats = statsRows[0];
  const totalSessions = Number(stats?.totalSessions ?? 0);
  const totalMinutes = Number(stats?.totalMinutes ?? 0);
  const pastCount = Number(stats?.pastCount ?? 0);
  const upcomingCount = Number(stats?.upcomingCount ?? 0);
  const pastMinutes = Number(stats?.pastMinutes ?? 0);
  const avgRating = stats?.avgRating == null ? null : Number(stats.avgRating);
  const avgIntensity =
    stats?.avgIntensity == null ? null : Number(stats.avgIntensity);
  const pastWithAttendanceCount = Number(stats?.pastWithAttendanceCount ?? 0);
  const attendedCount = Number(stats?.attendedCount ?? 0);
  const attendanceRate =
    pastWithAttendanceCount > 0
      ? attendedCount / pastWithAttendanceCount
      : null;
  const isReliable =
    attendanceRate != null &&
    attendanceRate >= 0.8 &&
    pastWithAttendanceCount >= 3;

  const recentEvolution = past.slice(0, 8).reverse();

  const sessionsPerWeek =
    Number(stats?.last30PastCount ?? 0) > 0
      ? (Number(stats?.last30PastCount ?? 0) / 4.3).toFixed(1)
      : "0";

  const nextSession = upcoming[0];
  const age = student.birthDate ? ageFromBirthDate(student.birthDate) : null;
  const level = student.playerLevel as PlayerLevel | null;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-8">
        {/* Masthead */}
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/students"
                className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-black uppercase text-white/70 transition-colors hover:text-white"
              >
                ← Alumnos
              </Link>
              <span className="text-[11px] font-black uppercase text-white/25">
                /
              </span>
              <p className="rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
                Ficha individual
              </p>
            </div>
            {isOwner && (
              <div className="flex items-center gap-3">
                <Link
                  href={`/students/${student.id}/edit`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[11px] font-black uppercase text-white/70 transition-colors hover:border-[#D6FF38] hover:text-[#D6FF38]"
                >
                  <Pencil className="size-3" strokeWidth={1.6} />
                  Editar
                </Link>
                <DeleteStudentButton
                  studentId={student.id}
                  studentName={student.name}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-[auto_1fr] items-end gap-4 sm:gap-6">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/18 bg-white/8">
              {student.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={student.imageUrl}
                  alt={student.name}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black text-white/86">
                  {initialsFromName(student.name)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-4xl font-black leading-tight text-white md:text-5xl">
                {student.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[12px] tabular-nums">
                {level && (
                  <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-black uppercase text-white/62">
                    {LEVEL_CODE[level]} · {LEVEL_LABEL[level]}
                  </span>
                )}
                {age != null && (
                  <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-black uppercase text-white/58">
                    {age} años
                  </span>
                )}
                {isReliable && (
                  <span className="rounded-full bg-[#D6FF38]/15 px-3 py-1 text-[10px] font-black uppercase text-[#D6FF38]">
                    ◆ Fiable
                  </span>
                )}
                {student.email && (
                  <span className="truncate text-white/50">
                    {student.email}
                  </span>
                )}
                {!isOwner && authorName && (
                  <span className="rounded-full bg-white/8 px-3 py-1 text-[10px] font-black uppercase text-white/58">
                    Alumno de {authorName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Stats strip */}
        <section className="tp-panel grid grid-cols-2 overflow-hidden p-0 md:grid-cols-4 lg:grid-cols-6">
          <StatCell label="Sesiones totales" value={totalSessions.toString()} />
          <StatCell label="Completadas" value={pastCount.toString()} />
          <StatCell label="Próximas" value={upcomingCount.toString()} accent />
          <StatCell
            label="Horas totales"
            value={`${Math.round(totalMinutes / 60)}h`}
          />
          <StatCell
            label="Intensidad media"
            value={avgIntensity != null ? `${avgIntensity.toFixed(1)}/5` : "—"}
          />
          <StatCell
            label="Valoración media"
            value={avgRating != null ? `${avgRating.toFixed(1)}/5` : "—"}
          />
        </section>

        <TrainingStatsPanel
          stats={await trainingStatsPromise}
          title="Estadística de entrenamiento"
        />

        {/* Perfil + enlace */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="tp-panel p-5 sm:p-6">
            <div className="grid grid-cols-[auto_1fr] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
              <p className="text-[10px] font-black tabular-nums text-brand">
                01
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Ficha física
              </p>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-y divide-[#050505]/10 border-b border-[#050505]/10 dark:divide-white/10 dark:border-white/10 md:grid-cols-3">
              <InfoRow
                label="Género"
                value={
                  student.gender ? GENDER_LABEL[student.gender as Gender] : "—"
                }
              />
              <InfoRow
                label="Nacimiento"
                value={
                  student.birthDate
                    ? new Intl.DateTimeFormat("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(student.birthDate))
                    : "—"
                }
              />
              <InfoRow
                label="Mano"
                value={
                  student.dominantHand
                    ? HAND_LABEL[student.dominantHand as DominantHand]
                    : "—"
                }
              />
              <InfoRow
                label="Altura"
                value={student.heightCm ? `${student.heightCm} cm` : "—"}
              />
              <InfoRow
                label="Peso"
                value={student.weightKg ? `${student.weightKg} kg` : "—"}
              />
              <InfoRow
                label="Experiencia"
                value={
                  student.yearsExperience != null
                    ? `${student.yearsExperience} año${student.yearsExperience !== 1 ? "s" : ""}`
                    : "—"
                }
              />
            </dl>
            {student.notes && (
              <div className="mt-6">
                <p className="mb-2 text-[10px] font-black uppercase text-foreground/50">
                  Notas del entrenador
                </p>
                <p className="whitespace-pre-wrap rounded-[20px] border border-brand/20 bg-brand/10 p-4 text-[15px] font-semibold leading-relaxed text-foreground/80">
                  {student.notes}
                </p>
              </div>
            )}
          </div>

          <aside className="tp-panel p-5 sm:p-6">
            <div className="grid grid-cols-[auto_1fr] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
              <p className="text-[10px] font-black tabular-nums text-brand">
                02
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Enlace de perfil
              </p>
            </div>
            <p className="text-[13px] text-foreground/60 leading-relaxed mt-4 mb-4">
              Genera un enlace temporal para que el alumno rellene sus datos
              físicos sin necesidad de cuenta. Caduca en 7 días.
            </p>
            {isOwner ? (
              <GenerateProfileLinkButton studentId={student.id} />
            ) : (
              <p className="text-[12px] italic text-foreground/40">
                Solo {authorName ?? "el entrenador"} puede generar este enlace.
              </p>
            )}
          </aside>
        </section>

        {guardiansData && (
          <section className="tp-panel p-5 sm:p-6">
            <div className="mb-4 grid grid-cols-[auto_1fr] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
              <Mail className="size-3 text-brand" />
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Contactos para mensajes
              </p>
            </div>
            <GuardiansPanel
              studentId={student.id}
              studentName={student.name}
              clubName={guardiansData.clubName}
              adult={isAdult(student.birthDate)}
              initialGuardians={guardiansData.list}
            />
          </section>
        )}

        {/* Fiabilidad + Proyección */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="tp-panel p-5 sm:p-6">
            <div className="grid grid-cols-[auto_1fr] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
              <p className="text-[10px] font-black tabular-nums text-brand">
                03
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Fiabilidad · asistencia
              </p>
            </div>
            {pastWithAttendanceCount === 0 ? (
              <p className="text-[13px] text-foreground/55 mt-4">
                Registra la asistencia en sesiones pasadas para ver esta
                métrica.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-black uppercase text-foreground/55">
                    Asistencia
                  </span>
                  <span className="text-3xl font-black tabular-nums text-foreground">
                    {Math.round((attendanceRate ?? 0) * 100)}%
                  </span>
                </div>
                <div className="h-px bg-foreground/10 relative overflow-hidden">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 h-[3px] -translate-y-px",
                      (attendanceRate ?? 0) >= 0.8
                        ? "bg-brand"
                        : (attendanceRate ?? 0) >= 0.5
                          ? "bg-foreground/60"
                          : "bg-destructive"
                    )}
                    style={{
                      width: `${Math.round((attendanceRate ?? 0) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-foreground/50 tabular-nums">
                  {attendedCount} de {pastWithAttendanceCount} sesiones con
                  registro ·{" "}
                  {isReliable
                    ? "Cliente fiable"
                    : pastWithAttendanceCount < 3
                      ? "Pocas sesiones"
                      : "Asistencia irregular"}
                </p>
              </div>
            )}
          </div>

          <div className="tp-panel p-5 sm:p-6">
            <div className="grid grid-cols-[auto_1fr] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
              <p className="text-[10px] font-black tabular-nums text-brand">
                04
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Proyección · ritmo
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-5">
              <div>
                <p className="mb-1 text-[9px] font-black uppercase text-foreground/45">
                  Próxima
                </p>
                {nextSession ? (
                  <Link
                    href={`/sessions/${nextSession.sessionId}`}
                    className="group block"
                  >
                    <p className="truncate text-[14px] font-black leading-tight text-foreground transition-colors group-hover:text-brand">
                      {nextSession.title}
                    </p>
                    <p className="text-[11px] text-foreground/50 mt-0.5 tabular-nums">
                      {fmtDate(new Date(nextSession.scheduledAt))}
                    </p>
                  </Link>
                ) : (
                  <p className="text-[13px] text-foreground/50">Ninguna</p>
                )}
              </div>
              <div>
                <p className="mb-1 text-[9px] font-black uppercase text-foreground/45">
                  Ritmo
                </p>
                <p className="text-3xl font-black tabular-nums leading-none text-foreground">
                  {sessionsPerWeek}
                </p>
                <p className="text-[11px] text-foreground/50 mt-1">
                  ses/semana · 30d
                </p>
              </div>
              <div>
                <p className="mb-1 text-[9px] font-black uppercase text-foreground/45">
                  Acumuladas
                </p>
                <p className="text-3xl font-black tabular-nums leading-none text-foreground">
                  {Math.round(pastMinutes / 60)}h
                </p>
                <p className="text-[11px] text-foreground/50 mt-1">
                  entrenadas
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Evolución */}
        {recentEvolution.length > 0 && (
          <section className="tp-panel p-5 sm:p-6">
            <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
              <p className="text-[10px] font-black tabular-nums text-brand">
                05
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Evolución reciente
              </p>
              <p className="text-[10px] font-black tabular-nums text-foreground/40">
                últimas {recentEvolution.length}
              </p>
            </div>
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-8">
              <EvolutionChart
                label="Intensidad"
                items={recentEvolution.map((s) => s.intensity)}
              />
              <EvolutionChart
                label="Valoración"
                items={recentEvolution.map((s) => s.rating)}
              />
            </div>
          </section>
        )}

        {/* Objetivos por etapa */}
        {objectives && (
          <section className="tp-panel p-5 sm:p-6">
            <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
              <p className="text-[10px] font-black tabular-nums text-brand">
                06
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                Objetivos por etapa
              </p>
              <p className="text-[10px] font-black tabular-nums text-foreground/40">
                {objectives.filter((o) => o.achieved).length}/
                {objectives.length}
              </p>
            </div>
            <ObjectivesChecklist
              studentId={student.id}
              items={objectives}
              defaultBall={defaultBallForStudent(
                student.playerLevel,
                student.birthDate
              )}
            />
          </section>
        )}

        {/* Próximas */}
        <section className="tp-panel p-5 sm:p-6">
          <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
            <p className="text-[10px] font-black tabular-nums text-brand">07</p>
            <p className="text-[10px] font-black uppercase text-foreground/50">
              Próximas sesiones
            </p>
            <p className="text-[10px] font-black tabular-nums text-foreground/40">
              {upcomingCount}
            </p>
          </div>
          <div className="pt-4">
            <UpcomingList
              items={upcoming.map((s) => ({
                ssId: s.ssId,
                sessionId: s.sessionId,
                title: s.title,
                scheduledAt: new Date(s.scheduledAt).toISOString(),
                durationMinutes: s.durationMinutes,
              }))}
            />
          </div>
        </section>

        {/* Historial */}
        <section className="tp-panel p-5 sm:p-6">
          <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-[#050505]/10 pb-3 dark:border-white/10">
            <p className="text-[10px] font-black tabular-nums text-brand">08</p>
            <p className="text-[10px] font-black uppercase text-foreground/50">
              Historial y feedback
            </p>
            <p className="text-[10px] font-black tabular-nums text-foreground/40">
              {pastCount}
            </p>
          </div>
          {past.length === 0 ? (
            <p className="text-[13px] text-foreground/55 mt-6">
              Todavía no hay sesiones completadas.
            </p>
          ) : (
            <ul className="divide-y divide-[#050505]/10 dark:divide-white/10">
              {past.map((s, idx) => (
                <li
                  key={s.ssId}
                  className="py-5 grid grid-cols-1 lg:grid-cols-[auto_1fr_1fr] gap-5 items-start"
                >
                  <div className="flex items-start gap-4">
                    <span className="font-sans text-[10px] tabular-nums tracking-[0.18em] text-foreground/35 w-8 pt-1">
                      {String(idx + 1).padStart(3, "0")}
                    </span>
                    <div className="size-9 border border-foreground/20 flex items-center justify-center shrink-0">
                      <ClipboardList
                        className="size-3.5 text-foreground/60"
                        strokeWidth={1.6}
                      />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/sessions/${s.sessionId}`}
                      className="block truncate text-[17px] font-black text-foreground transition-colors hover:text-brand"
                    >
                      {s.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-[11px] text-foreground/55 tabular-nums">
                      <span>{fmtDate(new Date(s.scheduledAt))}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" strokeWidth={1.6} />{" "}
                        {s.durationMinutes}′
                      </span>
                      {s.intensity != null && (
                        <span className="inline-flex items-center gap-1">
                          <Flame className="size-3" strokeWidth={1.6} />{" "}
                          {s.intensity}/5
                        </span>
                      )}
                    </div>
                    {s.objective && (
                      <p className="text-[12px] text-foreground/55 italic mt-1 truncate">
                        {s.objective}
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    {isOwner ? (
                      <SessionFeedback
                        sessionStudentId={s.ssId}
                        studentId={student.id}
                        initialAttended={s.attended}
                        initialRating={s.rating}
                        initialFeedback={s.feedback}
                      />
                    ) : (
                      <p className="text-[12px] italic text-foreground/40">
                        {s.attended == null
                          ? "Sin registro de asistencia."
                          : s.attended
                            ? "Asistió."
                            : "No asistió."}
                        {s.rating != null && ` · ${s.rating}/5`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="grid gap-3 pt-2 text-[11px] text-foreground/45 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-4">
          <p className="max-w-md text-[13px] font-semibold text-foreground/55">
            &ldquo;Entrenar es acompañar — cada ficha, una conversación.&rdquo;
          </p>
          <p className="font-black uppercase tabular-nums">
            /tenplanner · 04·{student.id.slice(0, 4)}
          </p>
        </footer>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border-l border-[#050505]/10 px-4 py-5 first:border-l-0 dark:border-white/10">
      <p className="mb-1.5 text-[9px] font-black uppercase text-foreground/45">
        {label}
      </p>
      <p
        className={cn(
          "text-3xl font-black tabular-nums leading-none",
          accent ? "text-brand" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-4">
      <p className="mb-1 text-[9px] font-black uppercase text-foreground/45">
        {label}
      </p>
      <p className="text-[14px] text-foreground">{value}</p>
    </div>
  );
}

function EvolutionChart({
  label,
  items,
}: {
  label: string;
  items: Array<number | null>;
}) {
  const max = 5;
  return (
    <div>
      <p className="mb-3 text-[10px] font-black uppercase text-foreground/55">
        {label}
      </p>
      <div className="flex items-end gap-1.5 h-20 border-b border-foreground/15">
        {items.map((v, i) => {
          const h = v == null ? 0 : (v / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end gap-1.5"
            >
              <div
                className={cn(
                  "w-full transition-all",
                  v == null ? "bg-foreground/10" : "bg-brand"
                )}
                style={{ height: v == null ? "2px" : `${Math.max(h, 8)}%` }}
                title={v == null ? "Sin datos" : `${v}/5`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-1.5 mt-1.5">
        {items.map((v, i) => (
          <span
            key={i}
            className="flex-1 text-center font-sans text-[9px] tabular-nums text-foreground/40"
          >
            {v ?? "—"}
          </span>
        ))}
      </div>
    </div>
  );
}
