import { sql } from "drizzle-orm";
import { db } from "@/db";

// Informes del Modo gestión (solo la cuenta del club): actividad de los
// monitores y seguimiento de los alumnos del club en un periodo.
//
// Solo cuenta lo que es del club (sesiones y fichas de alumno con club_id =
// el club), nunca el trabajo particular de sus monitores.
// - Sesiones impartidas: sesiones del club con fecha dentro del periodo, ya
//   pasadas y no canceladas (no todos los monitores las marcan como
//   completadas).
// - Asistencia: alumnos marcados como presentes sobre los que tienen la
//   asistencia anotada, en esas sesiones.

export const REPORT_PERIODS = [30, 90, 365] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export function parseReportPeriod(value: unknown): ReportPeriod {
  const n = Number(value);
  return (REPORT_PERIODS as readonly number[]).includes(n)
    ? (n as ReportPeriod)
    : 30;
}

export type ClubCoachRow = {
  id: string;
  name: string;
  email: string;
  players: number;
  sessions: number;
  minutes: number;
  upcoming: number;
  /** % de asistencia (0-100) o null si no hay asistencia anotada. */
  attendance: number | null;
  lastSession: string | null;
};

export type ClubPlayerRow = {
  id: string;
  name: string;
  coachName: string;
  level: string | null;
  attended: number;
  attendance: number | null;
  objectives: number;
  objectivesInPeriod: number;
};

export type ClubReport = {
  period: ReportPeriod;
  coaches: number;
  pendingInvites: number;
  players: number;
  newPlayers: number;
  sessions: number;
  minutes: number;
  cancelled: number;
  upcoming: number;
  attendance: number | null;
  objectives: number;
  coachRows: ClubCoachRow[];
  playerRows: ClubPlayerRow[];
};

function n(v: unknown) {
  return Number(v ?? 0);
}

function pct(present: unknown, marked: unknown): number | null {
  const m = n(marked);
  return m > 0 ? Math.round((n(present) / m) * 100) : null;
}

function iso(v: unknown): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

export async function loadClubReport(
  clubId: string,
  period: ReportPeriod
): Promise<ClubReport> {
  const since = sql`now() - make_interval(days => ${period})`;

  const [[summary], coachRows, playerRows] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      with done as (
        select s.id, s.duration_minutes from sessions s
        where s.club_id = ${clubId}
          and s.scheduled_at >= ${since} and s.scheduled_at < now()
          and s.status <> 'cancelled'
      )
      select
        (select count(distinct cm.user_id) from club_members cm
          where cm.club_id = ${clubId} and cm.role = 'coach'
            and cm.status = 'active') as coaches,
        (select count(*) from club_invites ci
          where ci.club_id = ${clubId} and ci.status = 'pending'
            and ci.expires_at > now()) as pending_invites,
        (select count(*) from students st where st.club_id = ${clubId}) as players,
        (select count(*) from students st
          where st.club_id = ${clubId} and st.created_at >= ${since}) as new_players,
        (select count(*) from done) as sessions,
        (select coalesce(sum(duration_minutes), 0) from done) as minutes,
        (select count(*) from sessions s
          where s.club_id = ${clubId} and s.status = 'cancelled'
            and s.scheduled_at >= ${since} and s.scheduled_at < now()) as cancelled,
        (select count(*) from sessions s
          where s.club_id = ${clubId} and s.status <> 'cancelled'
            and s.scheduled_at >= now()
            and s.scheduled_at < now() + interval '30 days') as upcoming,
        (select count(*) filter (where ss.attended) from session_students ss
          where ss.session_id in (select id from done)) as present,
        (select count(*) filter (where ss.attended is not null) from session_students ss
          where ss.session_id in (select id from done)) as marked,
        (select count(*) from student_objectives so
          join students st on st.id = so.student_id
          where st.club_id = ${clubId} and so.achieved
            and so.achieved_at >= ${since}) as objectives
    `),
    db.execute<Record<string, unknown>>(sql`
      with coach_ids as (
        select cm.user_id from club_members cm
        where cm.club_id = ${clubId} and cm.role = 'coach' and cm.status = 'active'
        union
        select s.user_id from sessions s where s.club_id = ${clubId}
        union
        select st.coach_id from students st where st.club_id = ${clubId}
      ),
      done as (
        select s.id, s.user_id, s.duration_minutes, s.scheduled_at from sessions s
        where s.club_id = ${clubId}
          and s.scheduled_at >= ${since} and s.scheduled_at < now()
          and s.status <> 'cancelled'
      )
      select u.id, u.name, u.email,
        (select count(*) from students st
          where st.club_id = ${clubId} and st.coach_id = u.id) as players,
        (select count(*) from done d where d.user_id = u.id) as sessions,
        (select coalesce(sum(d.duration_minutes), 0) from done d
          where d.user_id = u.id) as minutes,
        (select count(*) from sessions s
          where s.club_id = ${clubId} and s.user_id = u.id
            and s.status <> 'cancelled' and s.scheduled_at >= now()
            and s.scheduled_at < now() + interval '30 days') as upcoming,
        (select count(*) filter (where ss.attended) from session_students ss
          join done d on d.id = ss.session_id where d.user_id = u.id) as present,
        (select count(*) filter (where ss.attended is not null) from session_students ss
          join done d on d.id = ss.session_id where d.user_id = u.id) as marked,
        (select max(s.scheduled_at) from sessions s
          where s.club_id = ${clubId} and s.user_id = u.id
            and s.status <> 'cancelled' and s.scheduled_at < now()) as last_session
      from users u
      where u.id in (select user_id from coach_ids)
      order by u.name
    `),
    db.execute<Record<string, unknown>>(sql`
      with done as (
        select s.id from sessions s
        where s.club_id = ${clubId}
          and s.scheduled_at >= ${since} and s.scheduled_at < now()
          and s.status <> 'cancelled'
      )
      select st.id, st.name, st.player_level, u.name as coach_name,
        (select count(*) filter (where ss.attended) from session_students ss
          where ss.student_id = st.id
            and ss.session_id in (select id from done)) as present,
        (select count(*) filter (where ss.attended is not null) from session_students ss
          where ss.student_id = st.id
            and ss.session_id in (select id from done)) as marked,
        (select count(*) from student_objectives so
          where so.student_id = st.id and so.achieved) as objectives,
        (select count(*) from student_objectives so
          where so.student_id = st.id and so.achieved
            and so.achieved_at >= ${since}) as objectives_period
      from students st
      join users u on u.id = st.coach_id
      where st.club_id = ${clubId}
      order by st.name
    `),
  ]);

  return {
    period,
    coaches: n(summary?.coaches),
    pendingInvites: n(summary?.pending_invites),
    players: n(summary?.players),
    newPlayers: n(summary?.new_players),
    sessions: n(summary?.sessions),
    minutes: n(summary?.minutes),
    cancelled: n(summary?.cancelled),
    upcoming: n(summary?.upcoming),
    attendance: pct(summary?.present, summary?.marked),
    objectives: n(summary?.objectives),
    coachRows: coachRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      players: n(r.players),
      sessions: n(r.sessions),
      minutes: n(r.minutes),
      upcoming: n(r.upcoming),
      attendance: pct(r.present, r.marked),
      lastSession: iso(r.last_session),
    })),
    playerRows: playerRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      coachName: String(r.coach_name),
      level: r.player_level ? String(r.player_level) : null,
      attended: n(r.present),
      attendance: pct(r.present, r.marked),
      objectives: n(r.objectives),
      objectivesInPeriod: n(r.objectives_period),
    })),
  };
}
