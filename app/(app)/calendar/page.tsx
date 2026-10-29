import { redirect } from "next/navigation";
import { getWorkMode, personalTitle } from "@/lib/work-mode";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  sessions as sessionsTable,
  calendarEvents as calendarEventsTable,
  calendarHolidays as calendarHolidaysTable,
  groups as groupsTable,
  users as usersTable,
} from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { CalendarClient } from "./calendar-client";
import { FeatureLocked } from "@/components/app/feature-locked";
import { getBooleanSetting } from "@/lib/app-settings";
import {
  getActiveWorkClubId,
  getClubMembersDirectory,
  getOwnedClub,
  sharedWithClubCondition,
} from "@/lib/clubs";
import {
  calendarEventsVisibility,
  isManagementWorkMode,
} from "@/lib/calendar-events";
import { CalendarDays, Download, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Sessions loaded into the calendar are limited to this window to keep
// initial payload bounded. User can navigate the UI within this range.
const WINDOW_PAST_DAYS = 90;
const WINDOW_FUTURE_DAYS = 365;
const MAX_SESSIONS = 1000;

interface PageProps {
  searchParams: Promise<{ monitor?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const { monitor } = await searchParams;

  const calendarEnabled = await getBooleanSetting("feature.calendar_enabled");
  if (!calendarEnabled) {
    return (
      <FeatureLocked
        title="Calendario desactivado"
        description="El administrador ha pausado temporalmente la vista de calendario."
        href="/sessions"
        cta="Volver a sesiones"
      />
    );
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() - WINDOW_PAST_DAYS);
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + WINDOW_FUTURE_DAYS);

  const activeClubId = await getActiveWorkClubId(user.id);
  const clubMembers = activeClubId
    ? await getClubMembersDirectory([activeClubId])
    : [];
  const monitorFilter =
    monitor && clubMembers.some((m) => m.id === monitor) ? monitor : null;

  const sessionsVisibility = sharedWithClubCondition(
    sessionsTable.userId,
    sessionsTable.clubId,
    user.id,
    activeClubId
  );
  const eventsVisibility = calendarEventsVisibility(
    user.id,
    activeClubId,
    await isManagementWorkMode(user.id)
  );

  const sessions = await db
    .select({
      id: sessionsTable.id,
      title: sessionsTable.title,
      scheduledAt: sessionsTable.scheduledAt,
      durationMinutes: sessionsTable.durationMinutes,
      status: sessionsTable.status,
      userId: sessionsTable.userId,
      groupId: sessionsTable.groupId,
      authorName: usersTable.name,
    })
    .from(sessionsTable)
    .leftJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(
      and(
        sessionsVisibility,
        monitorFilter ? eq(sessionsTable.userId, monitorFilter) : undefined,
        gte(sessionsTable.scheduledAt, windowStart),
        lte(sessionsTable.scheduledAt, windowEnd)
      )
    )
    .orderBy(asc(sessionsTable.scheduledAt))
    .limit(MAX_SESSIONS);

  const events = await db
    .select({
      id: calendarEventsTable.id,
      title: calendarEventsTable.title,
      description: calendarEventsTable.description,
      startAt: calendarEventsTable.startAt,
      endAt: calendarEventsTable.endAt,
      clubId: calendarEventsTable.clubId,
      userId: calendarEventsTable.userId,
      authorName: usersTable.name,
    })
    .from(calendarEventsTable)
    .leftJoin(usersTable, eq(usersTable.id, calendarEventsTable.userId))
    .where(
      and(
        eventsVisibility,
        monitorFilter
          ? eq(calendarEventsTable.userId, monitorFilter)
          : undefined,
        gte(calendarEventsTable.startAt, windowStart),
        lte(calendarEventsTable.startAt, windowEnd)
      )
    )
    .orderBy(asc(calendarEventsTable.startAt))
    .limit(MAX_SESSIONS);

  const holidaysVisibility = sharedWithClubCondition(
    calendarHolidaysTable.userId,
    calendarHolidaysTable.clubId,
    user.id,
    activeClubId
  );
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const [holidays, ownedClub, spaceGroups] = await Promise.all([
    db
      .select({
        id: calendarHolidaysTable.id,
        title: calendarHolidaysTable.title,
        description: calendarHolidaysTable.description,
        startDate: calendarHolidaysTable.startDate,
        endDate: calendarHolidaysTable.endDate,
        groupId: calendarHolidaysTable.groupId,
        clubId: calendarHolidaysTable.clubId,
        userId: calendarHolidaysTable.userId,
        authorName: usersTable.name,
      })
      .from(calendarHolidaysTable)
      .leftJoin(usersTable, eq(usersTable.id, calendarHolidaysTable.userId))
      .where(
        and(
          holidaysVisibility,
          gte(calendarHolidaysTable.endDate, toDateStr(windowStart)),
          lte(calendarHolidaysTable.startDate, toDateStr(windowEnd))
        )
      )
      .orderBy(asc(calendarHolidaysTable.startDate))
      .limit(MAX_SESSIONS),
    getOwnedClub(user.id),
    db
      .select({ id: groupsTable.id, name: groupsTable.name })
      .from(groupsTable)
      .where(
        sharedWithClubCondition(
          groupsTable.coachId,
          groupsTable.clubId,
          user.id,
          activeClubId
        )
      )
      .orderBy(asc(groupsTable.name)),
  ]);

  const serializedHolidays = holidays.map((h) => ({
    ...h,
    authorName: h.userId !== user.id ? (h.authorName ?? null) : null,
    // Lo edita quien lo creó o el dueño del club al que pertenece.
    canEdit: h.userId === user.id || (!!h.clubId && ownedClub?.id === h.clubId),
  }));

  const serialized = sessions.map((s) => ({
    ...s,
    scheduledAt: s.scheduledAt.toISOString(),
    authorName: s.userId !== user.id ? (s.authorName ?? null) : null,
  }));

  const serializedEvents = events.map((e) => ({
    ...e,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    authorName: e.userId !== user.id ? (e.authorName ?? null) : null,
  }));

  const total = serialized.length;
  const totalEvents = serializedEvents.length;
  const totalHolidays = serializedHolidays.length;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel flex flex-col gap-6 p-6 text-white sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
              <CalendarDays className="size-3.5" />
              Agenda operativa
            </div>
            <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
              {personalTitle("Calendario", await getWorkMode(user.id))}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
              {total} sesión{total !== 1 ? "es" : ""} planificada
              {total !== 1 ? "s" : ""}
              {totalEvents > 0 && (
                <>
                  {" "}
                  y {totalEvents} evento{totalEvents !== 1 ? "s" : ""}
                </>
              )}{" "}
              dentro de la ventana activa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/calendar/ical"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/14 px-4 text-sm font-black text-white transition-colors hover:border-[#D6FF38] hover:text-[#D6FF38]"
            >
              <Download className="size-4" />
              Exportar iCal
            </Link>
            <Link
              href="/sessions/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-4 text-sm font-black text-[#050505] transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" />
              Nueva sesión
            </Link>
          </div>
        </header>
        {clubMembers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#050505]/10 bg-white p-2 shadow-[0_12px_40px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
            <span className="pl-2 text-[11px] font-bold uppercase tracking-wide text-foreground/45">
              Monitor
            </span>
            <Link
              href="/calendar"
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
                href={`/calendar?monitor=${m.id}`}
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
        {total === 0 && totalEvents === 0 && totalHolidays === 0 ? (
          <div className="tp-panel flex flex-col items-center justify-center gap-4 border-dashed py-20 text-center">
            <p className="max-w-xs text-sm leading-6 text-foreground/55">
              Aún no tienes sesiones ni eventos planificados. Crea el primero
              para verlo aquí.
            </p>
            <Link
              href="/sessions/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" />
              Crear primera sesión
            </Link>
          </div>
        ) : (
          <CalendarClient
            sessions={serialized}
            events={serializedEvents}
            holidays={serializedHolidays}
            groups={spaceGroups}
            currentUserId={user.id}
          />
        )}
      </div>
    </div>
  );
}
