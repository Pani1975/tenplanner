import { notFound, redirect } from "next/navigation";
import { TrainingStatsPanel } from "@/components/app/training-stats-panel";
import { loadGroupTrainingStats } from "@/lib/stats/load-training-stats";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  classes,
  groups,
  groupStudents,
  sessions,
  students,
  users,
} from "@/db/schema";
import { and, desc, eq, ne, notInArray } from "drizzle-orm";
import { GroupReportButton } from "@/components/app/group-report-button";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  GraduationCap,
  Plus,
  Users,
} from "lucide-react";
import { GroupDetailClient } from "./group-detail-client";
import { GroupEditDetails } from "./group-edit-details";
import { AssignClassToGroupButton } from "@/components/app/assign-class-to-group-button";
import { GroupScheduleEditor } from "./group-schedule-editor";
import { GroupObjectivesEditor } from "./group-objectives-editor";
import { ballFromLevels } from "@/lib/objectives-taxonomy";
import { FeatureLocked } from "@/components/app/feature-locked";
import { getBooleanSetting } from "@/lib/app-settings";
import {
  getActiveWorkClubId,
  getOwnedClub,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { AssignedCoachesPanel } from "@/components/app/assigned-coaches-panel";
import { getAssignableCoaches, listGroupCoaches } from "@/lib/club-coaches";

interface PageProps {
  params: Promise<{ id: string }>;
}

type GroupSessionRow = {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled";
  sourceClassId: string | null;
  className: string | null;
};

const sessionDateFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

function GroupSessionsList({
  title,
  emptyText,
  rows,
  pastList,
}: {
  title: string;
  emptyText: string;
  rows: GroupSessionRow[];
  pastList?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="size-4 text-brand" />
        <h2 className="text-sm font-black uppercase tracking-wide text-foreground">
          {title}
        </h2>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5">
              <Link
                href={`/sessions/${row.id}`}
                className="flex items-center gap-3 transition-colors hover:text-brand"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {row.title}
                  </span>
                  <span className="block text-xs capitalize text-muted-foreground">
                    {sessionDateFormat.format(row.scheduledAt)}
                  </span>
                </span>
                {pastList && row.status !== "completed" && (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Sin cerrar
                  </span>
                )}
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {row.durationMinutes} min
                </span>
              </Link>
              {row.className && row.sourceClassId && (
                <Link
                  href={`/classes/${row.sourceClassId}`}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-brand"
                >
                  <GraduationCap className="size-3" />
                  {row.className}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function GroupDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const groupsEnabled = await getBooleanSetting("feature.groups_enabled");
  if (!groupsEnabled) {
    return (
      <FeatureLocked
        title="Grupos desactivados"
        description="El administrador ha pausado temporalmente la organización por grupos."
        href="/students"
        cta="Volver a alumnos"
      />
    );
  }

  const { id } = await params;

  const activeClubId = await getActiveWorkClubId(user.id);

  const [group] = await db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.id, id),
        sharedWithClubCondition(
          groups.coachId,
          groups.clubId,
          user.id,
          activeClubId
        )
      )
    )
    .limit(1);

  if (!group) notFound();

  const isOwner = group.coachId === user.id;
  const authorName = isOwner
    ? null
    : ((
        await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, group.coachId))
          .limit(1)
      )[0]?.name ?? null);

  const memberRows = await db
    .select({
      id: students.id,
      name: students.name,
      imageUrl: students.imageUrl,
      playerLevel: students.playerLevel,
    })
    .from(groupStudents)
    .innerJoin(students, eq(groupStudents.studentId, students.id))
    .where(eq(groupStudents.groupId, id))
    .orderBy(students.name);

  const memberIds = memberRows.map((m) => m.id);

  // Sesiones vinculadas a este grupo (sessions.group_id): esto ES la
  // planificación del grupo, ordenada en el tiempo. Las canceladas no se
  // muestran. Se incluye de qué clase (plantilla) viene cada una, para que
  // se vea de un vistazo qué contenido se ha dado y cuándo, sin tener que
  // entrar sesión por sesión.
  const groupSessions: GroupSessionRow[] = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      scheduledAt: sessions.scheduledAt,
      durationMinutes: sessions.durationMinutes,
      status: sessions.status,
      sourceClassId: sessions.sourceClassId,
      className: classes.name,
    })
    .from(sessions)
    .leftJoin(classes, eq(classes.id, sessions.sourceClassId))
    .where(and(eq(sessions.groupId, id), ne(sessions.status, "cancelled")))
    .orderBy(desc(sessions.scheduledAt));
  const now = new Date();
  // Impartidas: completadas o con la fecha ya pasada (más reciente primero).
  const pastSessions = groupSessions.filter(
    (s) => s.status === "completed" || s.scheduledAt < now
  );
  // Próximas: aún por llegar (la más cercana primero).
  const upcomingSessions = groupSessions
    .filter((s) => s.status !== "completed" && s.scheduledAt >= now)
    .reverse();

  const trainingStats = await loadGroupTrainingStats(id);

  // Monitores asignados por el gestor (solo grupos de un club). Los ve todo
  // el club; solo el gestor, dueño del club, puede cambiarlos.
  const ownedClub = group.clubId ? await getOwnedClub(user.id) : null;
  const canAssignCoaches = !!group.clubId && ownedClub?.id === group.clubId;
  const [assignedCoaches, coachOptions] = group.clubId
    ? await Promise.all([
        listGroupCoaches(id),
        canAssignCoaches
          ? getAssignableCoaches(group.clubId, group.sport)
          : Promise.resolve([]),
      ])
    : [[], []];

  const availableStudents = await db
    .select({
      id: students.id,
      name: students.name,
      imageUrl: students.imageUrl,
      playerLevel: students.playerLevel,
    })
    .from(students)
    .where(
      memberIds.length > 0
        ? and(eq(students.coachId, user.id), notInArray(students.id, memberIds))
        : eq(students.coachId, user.id)
    )
    .orderBy(students.name);

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        {/* Header */}
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Link
              href="/groups"
              className="flex size-10 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/70 transition-colors hover:bg-white/12 hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <p className="text-xs font-black uppercase text-white/45">Grupos</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505]">
                  <Users className="size-5" />
                </div>
                <h1 className="min-w-0 break-words text-4xl font-black leading-tight text-white md:text-5xl">
                  {group.name}
                </h1>
              </div>
              {group.description && (
                <p className="ml-[60px] mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/62">
                  {group.description}
                </p>
              )}
              <p className="ml-[60px] mt-2 text-xs font-semibold tabular-nums text-white/50">
                <span className="font-black text-[#D6FF38]">
                  {memberRows.length}
                </span>{" "}
                {memberRows.length === 1 ? "alumno" : "alumnos"}
                {!isOwner && authorName && <> · Grupo de {authorName}</>}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <GroupReportButton groupId={id} tone="hero" />
              {isOwner && (
                <GroupEditDetails
                  key={`${group.name}|${group.description ?? ""}`}
                  groupId={id}
                  name={group.name}
                  description={group.description}
                />
              )}
            </div>
          </div>
        </header>

        <GroupDetailClient
          groupId={id}
          groupName={group.name}
          members={memberRows}
          availableStudents={availableStudents}
          isOwner={isOwner}
        />

        {group.clubId && (
          <AssignedCoachesPanel
            key={assignedCoaches.map((c) => c.id).join(",")}
            endpoint={`/api/groups/${id}/coaches`}
            assigned={assignedCoaches}
            options={coachOptions}
            canEdit={canAssignCoaches}
            subject="este grupo"
          />
        )}

        <GroupObjectivesEditor
          key={group.objetivos ?? ""}
          groupId={id}
          initialObjetivos={group.objetivos}
          defaultBall={ballFromLevels(
            memberRows.map((m) => m.playerLevel ?? "")
          )}
          canEdit={isOwner}
        />

        {/* Planificación: la secuencia de sesiones del grupo en el tiempo,
            con la clase (plantilla) de la que viene cada una. Esto es "el
            plan del grupo", no solo un listado suelto. */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-foreground">
                Planificación de {group.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {groupSessions.length === 0
                  ? "Aún no hay sesiones programadas para este grupo."
                  : `${groupSessions.length} sesión${groupSessions.length !== 1 ? "es" : ""} en total · ${pastSessions.length} impartida${pastSessions.length !== 1 ? "s" : ""} · ${upcomingSessions.length} próxima${upcomingSessions.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <AssignClassToGroupButton
                groupId={id}
                weeklySchedule={group.weeklySchedule}
              />
              <Link
                href="/sessions/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#D6FF38] px-4 py-2 text-sm font-bold text-[#050505] transition-colors hover:bg-[#c8f52e]"
              >
                <Plus className="size-4" />
                Nueva sesión
              </Link>
            </div>
          </div>

          <GroupScheduleEditor
            groupId={id}
            initialSchedule={group.weeklySchedule}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <GroupSessionsList
              title="Sesiones impartidas"
              emptyText="Todavía no hay sesiones impartidas con este grupo."
              rows={pastSessions}
              pastList
            />
            <GroupSessionsList
              title="Próximas sesiones"
              emptyText="No hay sesiones programadas para este grupo."
              rows={upcomingSessions}
            />
          </div>
        </section>

        <TrainingStatsPanel
          stats={trainingStats.stats}
          studentHours={trainingStats.studentHours}
          title={`Estadística de ${group.name}`}
        />
      </div>
    </div>
  );
}
