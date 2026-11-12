import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { ArrowLeft, CalendarClock, Sparkles, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { groups, groupStudents, sessions } from "@/db/schema";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import {
  nextScheduleOccurrenceInZone,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";
import {
  buildProposal,
  ENGINE_TIME_ZONE,
  localDateKey,
} from "@/lib/session-engine/today";
import { HOY_TOCA, MONTAR } from "@/lib/session-engine/messages";
import { FeatureLocked } from "@/components/app/feature-locked";
import { HoyTocaClient } from "@/components/app/dashboard/hoy-toca-client";

interface PageProps {
  searchParams: Promise<{ group?: string }>;
}

const CARD =
  "rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_12px_36px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]";

/** Próximo entreno del grupo; sin horario, la próxima hora en punto. */
function nextAt(schedule: GroupScheduleEntry[] | null, now: Date): Date {
  const at = nextScheduleOccurrenceInZone(schedule, now, ENGINE_TIME_ZONE, 60);
  if (at) return at;
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/**
 * "Que la monte Ten Planner": el monitor elige un grupo y el motor (F1)
 * monta la clase de su próximo entreno con la misma tarjeta del panel.
 */
export default async function MontarSessionPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  if (!(await getBooleanSetting("feature.session_creation_enabled"))) {
    return (
      <FeatureLocked
        title="Crear sesiones está bloqueado"
        description="Un administrador ha desactivado temporalmente la creación manual de sesiones."
        href="/sessions"
        cta="Volver a sesiones"
      />
    );
  }

  const [activeClubId, sport, { group: groupParam }] = await Promise.all([
    getActiveWorkClubId(user.id),
    getActiveSport(user.id),
    searchParams,
  ]);

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      schedule: groups.weeklySchedule,
    })
    .from(groups)
    .where(
      and(
        sharedWithClubCondition(
          groups.coachId,
          groups.clubId,
          user.id,
          activeClubId
        ),
        eq(groups.sport, sport as "tenis")
      )
    )
    .orderBy(asc(groups.name));

  const now = new Date();
  const selected = groupParam
    ? (rows.find((g) => g.id === groupParam) ?? null)
    : null;

  let body: React.ReactNode;

  if (selected) {
    const at = nextAt(selected.schedule, now);
    const [existing] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.groupId, selected.id),
          gte(sessions.scheduledAt, new Date(at.getTime() - 12 * 3600_000)),
          lt(sessions.scheduledAt, new Date(at.getTime() + 12 * 3600_000)),
          ne(sessions.status, "cancelled")
        )
      )
      .limit(1);

    if (existing) {
      body = (
        <section className={CARD}>
          <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
            <CalendarClock className="size-5 text-brand" />
            {HOY_TOCA.alreadyHave(selected.name)}
          </h2>
          <Link
            href={`/sessions/${existing.id}`}
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#D6FF38] px-4 text-sm font-bold text-[#050505]"
          >
            {HOY_TOCA.openSession}
          </Link>
        </section>
      );
    } else {
      const date = localDateKey(at);
      const proposal = await buildProposal(user.id, activeClubId, {
        groupId: selected.id,
        date,
        durationMinutes: 60,
        intensity: "media",
        focus: "auto",
        attendeeIds: null,
      });
      body = proposal ? (
        <HoyTocaClient
          key={selected.id}
          initial={proposal}
          date={date}
          scheduledAt={at.toISOString()}
          kicker={MONTAR.kicker}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{MONTAR.notFound}</p>
      );
    }
    body = (
      <div className="flex flex-col gap-3">
        <Link
          href="/sessions/new/montar"
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {MONTAR.otherGroup}
        </Link>
        {body}
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <section className={CARD}>
        <p className="text-sm text-muted-foreground">{MONTAR.noGroups}</p>
        <Link
          href="/groups"
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#D6FF38] px-4 text-sm font-bold text-[#050505]"
        >
          {MONTAR.goGroups}
        </Link>
      </section>
    );
  } else {
    const counts = await db
      .select({ groupId: groupStudents.groupId, n: count() })
      .from(groupStudents)
      .where(
        inArray(
          groupStudents.groupId,
          rows.map((g) => g.id)
        )
      )
      .groupBy(groupStudents.groupId);
    const countBy = new Map(counts.map((c) => [c.groupId, c.n]));
    const fmt = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ENGINE_TIME_ZONE,
    });
    body = (
      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {MONTAR.chooseGroup}
        </h2>
        {groupParam && (
          <p className="mb-3 text-sm text-destructive">{MONTAR.notFound}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => {
            const at = nextScheduleOccurrenceInZone(
              g.schedule,
              now,
              ENGINE_TIME_ZONE,
              60
            );
            return (
              <Link
                key={g.id}
                href={`/sessions/new/montar?group=${g.id}`}
                className={`group ${CARD} transition-colors hover:border-[#D6FF38]/70 hover:bg-[#D6FF38]/10`}
              >
                <p className="font-heading text-base text-foreground group-hover:text-brand">
                  {g.name}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {MONTAR.students(countBy.get(g.id) ?? 0)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground first-letter:uppercase">
                  <CalendarClock className="size-3.5" />
                  {at ? fmt.format(at) : MONTAR.noSchedule}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="relative min-h-full w-full bg-[#F4F4F1] dark:bg-[#050505]">
      <div className="relative flex min-h-full w-full flex-col gap-6 px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <header className="relative overflow-hidden rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_18px_60px_rgba(5,5,5,0.06)] dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
          <div
            aria-hidden
            className="court-grid pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
          />
          <div className="relative flex items-center gap-4">
            <Link
              href="/sessions/new"
              aria-label="Volver a nueva sesión"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-[#F4F4F1] text-foreground/60 transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-[#050505]/70"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-[#F4F4F1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60 dark:bg-[#050505]/70">
                <Sparkles className="size-3.5 text-brand" />
                Nueva sesión
              </p>
              <h1 className="font-heading text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
                {MONTAR.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {MONTAR.subtitle}
              </p>
            </div>
          </div>
        </header>
        {body}
      </div>
    </div>
  );
}
