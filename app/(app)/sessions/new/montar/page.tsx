import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, count, eq, gte, inArray, ne } from "drizzle-orm";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Sparkles,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { groups, groupStudents, sessions } from "@/db/schema";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import {
  nextScheduleOccurrenceInZone,
  scheduleMinutesForDate,
  zonedTimeToUtc,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";
import {
  countSessionItems,
  loadBeforeProposalContext,
  ENGINE_TIME_ZONE,
} from "@/lib/session-engine/today";
import { ANTES, MONTAR } from "@/lib/session-engine/messages";
import { ballFromLevels } from "@/lib/objectives-taxonomy";
import { FeatureLocked } from "@/components/app/feature-locked";
import { OtherDatePicker } from "./other-date-picker";
import { BeforeProposalForm } from "./before-proposal-form";

interface PageProps {
  searchParams: Promise<{ group?: string; session?: string; at?: string }>;
}

const CARD =
  "rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_12px_36px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]";
const ROW =
  "flex min-h-11 w-full items-center gap-3 rounded-lg border border-[#050505]/10 bg-white px-4 py-3 text-left transition-colors hover:border-[#D6FF38]/70 hover:bg-[#D6FF38]/10 dark:border-white/10 dark:bg-white/[0.045]";

const WHEN = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ENGINE_TIME_ZONE,
});

/** "YYYY-MM-DDTHH:mm" (hora de Madrid) → instante. */
function parseLocalAt(value: string | undefined): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, hh, mm] = m.slice(1).map(Number);
  return zonedTimeToUtc(y, mo, d, hh, mm, ENGINE_TIME_ZONE);
}

/** Instante → "YYYY-MM-DDTHH:mm" en hora de Madrid. */
function toLocalAt(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ENGINE_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Próximos entrenos del horario del grupo que aún no tienen sesión. */
function freeOccurrences(
  schedule: GroupScheduleEntry[] | null,
  taken: Date[],
  now: Date,
  max = 2
): Date[] {
  const out: Date[] = [];
  let from = now;
  for (let i = 0; i < 12 && out.length < max; i++) {
    const at = nextScheduleOccurrenceInZone(
      schedule,
      from,
      ENGINE_TIME_ZONE,
      0
    );
    if (!at) break;
    const busy = taken.some(
      (t) => Math.abs(t.getTime() - at.getTime()) < 12 * 3600_000
    );
    if (!busy) out.push(at);
    from = new Date(at.getTime() + 60_000);
  }
  return out;
}

/**
 * "Que la diseñe Ten Planner": el monitor elige un grupo y para qué clase
 * (una sesión ya programada, un próximo entreno sin sesión u otro día) y el
 * motor (F1) le propone la clase con el nivel y el historial del grupo. Si
 * la acepta, sustituye los ejercicios de esa sesión o crea una nueva.
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

  const [activeClubId, sport, params] = await Promise.all([
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
  const selected = params.group
    ? (rows.find((g) => g.id === params.group) ?? null)
    : null;

  let body: React.ReactNode;

  if (selected && (params.session || params.at)) {
    // ── Paso 3: antes de la propuesta (duración, objetivos y lugar) ──
    let target: {
      at: Date;
      baseHref: string;
      durationMinutes: number | null;
      placeId: string | null;
      objective: string | null;
    } | null = null;
    if (params.session) {
      const [s] = await db
        .select({
          id: sessions.id,
          scheduledAt: sessions.scheduledAt,
          durationMinutes: sessions.durationMinutes,
          placeId: sessions.placeId,
          objective: sessions.objective,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, params.session),
            eq(sessions.groupId, selected.id),
            ne(sessions.status, "cancelled")
          )
        )
        .limit(1);
      if (s) {
        target = {
          at: s.scheduledAt,
          baseHref: `/sessions/${s.id}/edit`,
          durationMinutes: s.durationMinutes,
          placeId: s.placeId,
          objective: s.objective,
        };
      }
    } else {
      const at = parseLocalAt(params.at);
      if (at) {
        const qs = new URLSearchParams({ group: selected.id, at: params.at! });
        target = {
          at,
          baseHref: `/sessions/new?${qs.toString()}`,
          // La duración sale del horario del grupo (inicio–fin) si ese día
          // tiene clase fija; si no, la habitual.
          durationMinutes: scheduleMinutesForDate(
            selected.schedule as GroupScheduleEntry[] | null,
            at
          ),
          placeId: null,
          objective: null,
        };
      }
    }

    const back = (
      <Link
        href={`/sessions/new/montar?group=${selected.id}`}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {MONTAR.changeWhen}
      </Link>
    );

    if (!target) {
      body = (
        <div className="flex flex-col gap-3">
          {back}
          <p className="text-sm text-muted-foreground">
            {MONTAR.sessionNotFound}
          </p>
        </div>
      );
    } else {
      const ctx = await loadBeforeProposalContext(user.id, selected.id);
      const groupObjectives = (ctx.groupObjetivos ?? "")
        .split(/\r?\n/)
        .map((l) => l.replace(/^[\s•·\-*]+/, "").trim())
        .filter(Boolean);
      body = (
        <div className="flex flex-col gap-4">
          {back}
          <section className={CARD}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {ANTES.title}
            </p>
            <h2 className="mt-1 font-heading text-xl text-foreground">
              {selected.name}{" "}
              <span className="text-muted-foreground">
                · {WHEN.format(target.at)}
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {ANTES.level(ctx.levelLabel)} · {ANTES.history(ctx.historyCount)}
            </p>
            <div className="mt-5">
              <BeforeProposalForm
                baseHref={target.baseHref}
                defaultDuration={target.durationMinutes ?? ctx.usualDuration}
                defaultObjectives={target.objective ?? ""}
                suggestions={groupObjectives}
                places={ctx.places}
                defaultPlaceId={target.placeId}
                defaultBall={ballFromLevels([ctx.levelCode])}
              />
            </div>
          </section>
        </div>
      );
    }
  } else if (selected) {
    // ── Paso 2: ¿para qué clase? ──
    const upcoming = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        scheduledAt: sessions.scheduledAt,
        status: sessions.status,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.groupId, selected.id),
          // También las ya marcadas como completadas aunque sean futuras:
          // ocupan ese entreno (no se ofrece como día libre).
          ne(sessions.status, "cancelled"),
          gte(sessions.scheduledAt, new Date(now.getTime() - 3600_000))
        )
      )
      .orderBy(asc(sessions.scheduledAt))
      .limit(6);
    // Para los días libres hay que mirar todas las sesiones futuras del
    // grupo, no solo las 6 que se listan.
    const [counts, takenRows] = await Promise.all([
      countSessionItems(upcoming.map((s) => s.id)),
      db
        .select({ scheduledAt: sessions.scheduledAt })
        .from(sessions)
        .where(
          and(
            eq(sessions.groupId, selected.id),
            ne(sessions.status, "cancelled"),
            gte(sessions.scheduledAt, new Date(now.getTime() - 3600_000))
          )
        ),
    ]);
    const free = freeOccurrences(
      selected.schedule,
      takenRows.map((s) => s.scheduledAt),
      now
    );

    body = (
      <div className="flex flex-col gap-5">
        <Link
          href="/sessions/new/montar"
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {MONTAR.otherGroup}
        </Link>
        <h2 className="font-heading text-xl text-foreground">
          {MONTAR.whenTitle}{" "}
          <span className="text-muted-foreground">· {selected.name}</span>
        </h2>

        <section className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {MONTAR.scheduled}
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {MONTAR.nothingUpcoming}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {MONTAR.scheduledHint}
              </p>
              {upcoming.map((s) => (
                <Link
                  key={s.id}
                  href={`/sessions/new/montar?group=${selected.id}&session=${s.id}`}
                  className={ROW}
                >
                  <CalendarCheck className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground first-letter:uppercase">
                      {WHEN.format(s.scheduledAt)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.title} · {MONTAR.itemCount(counts.get(s.id) ?? 0)}
                      {s.status === "completed" && ` · ${MONTAR.completed}`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-foreground/30" />
                </Link>
              ))}
            </>
          )}
        </section>

        {free.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {MONTAR.freeDays}
            </h3>
            {free.map((d) => (
              <Link
                key={d.toISOString()}
                href={`/sessions/new/montar?group=${selected.id}&at=${toLocalAt(d)}`}
                className={ROW}
              >
                <CalendarClock className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 text-sm font-bold text-foreground first-letter:uppercase">
                  {WHEN.format(d)}
                </span>
                <ChevronRight className="size-4 shrink-0 text-foreground/30" />
              </Link>
            ))}
          </section>
        )}

        <OtherDatePicker
          groupId={selected.id}
          schedule={selected.schedule ?? []}
        />
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
    // ── Paso 1: elegir el grupo ──
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
    body = (
      <section>
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {MONTAR.chooseGroup}
        </h2>
        {params.group && (
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
                  {at ? WHEN.format(at) : MONTAR.noSchedule}
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
