import { sql, type SQL } from "drizzle-orm";
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

/** Zona horaria con la que se cortan los días de un periodo personalizado. */
export const REPORT_TIME_ZONE = "Atlantic/Canary";

const MAX_CUSTOM_DAYS = 366 * 5;

/**
 * Periodo de un informe: uno de los fijos (30 días, 3 meses, 12 meses hasta
 * ahora) o uno personalizado entre dos fechas (ambas incluidas).
 */
export type ReportRange =
  | {
      kind: "preset";
      period: ReportPeriod;
      days: number;
      /** "30 días" */
      label: string;
      /** "los últimos 30 días" */
      phrase: string;
    }
  | {
      kind: "custom";
      /** YYYY-MM-DD, ambas incluidas. */
      fromDate: string;
      toDate: string;
      days: number;
      label: string;
      phrase: string;
    };

const PRESET_LABELS: Record<ReportPeriod, string> = {
  30: "30 días",
  90: "3 meses",
  365: "12 meses",
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value ? value : null;
}

function dayNumber(isoDate: string) {
  return Math.round(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de los informes. */
export function reportToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Fecha (YYYY-MM-DD) de hace `days` días, contando desde hoy. */
export function reportDaysAgo(days: number, now = new Date()): string {
  const d = new Date(`${reportToday(now)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function shortDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Lee el periodo de la URL: `periodo=30|90|365|personalizado` y, para el
 * personalizado, `desde` y `hasta` (YYYY-MM-DD). Si algo no es válido, 30
 * días. Un fin futuro se recorta a hoy y un rango invertido se da la vuelta.
 */
export function parseReportRange(
  params: { periodo?: unknown; desde?: unknown; hasta?: unknown },
  now = new Date()
): ReportRange {
  const preset = (period: ReportPeriod): ReportRange => ({
    kind: "preset",
    period,
    days: period,
    label: PRESET_LABELS[period],
    phrase: `los últimos ${PRESET_LABELS[period]}`,
  });

  if (params.periodo === "personalizado") {
    const today = reportToday(now);
    let from = validIsoDate(params.desde);
    let to = validIsoDate(params.hasta);
    if (!from || !to) return preset(30);
    if (from > to) [from, to] = [to, from];
    if (to > today) to = today;
    if (from > to) return preset(30);
    const days = dayNumber(to) - dayNumber(from) + 1;
    if (days > MAX_CUSTOM_DAYS) return preset(30);
    const label = `${shortDate(from)} – ${shortDate(to)}`;
    return {
      kind: "custom",
      fromDate: from,
      toDate: to,
      days,
      label,
      phrase: `el periodo ${label}`,
    };
  }

  const n = Number(params.periodo);
  return preset(
    (REPORT_PERIODS as readonly number[]).includes(n) ? (n as ReportPeriod) : 30
  );
}

/** Parámetros de URL que describen un periodo (para enlaces y el PDF). */
export function rangeQuery(range: ReportRange): URLSearchParams {
  const q = new URLSearchParams();
  if (range.kind === "custom") {
    q.set("periodo", "personalizado");
    q.set("desde", range.fromDate);
    q.set("hasta", range.toDate);
  } else if (range.period !== 30) {
    q.set("periodo", String(range.period));
  }
  return q;
}

/**
 * Límites del periodo como expresiones SQL. `until` nunca pasa de "ahora":
 * lo futuro no se ha impartido.
 */
export function rangeBounds(range: ReportRange): { since: SQL; until: SQL } {
  if (range.kind === "preset") {
    return {
      since: sql`(now() - make_interval(days => ${range.days}))`,
      until: sql`(now())`,
    };
  }
  return {
    since: sql`(((${range.fromDate}::date)::timestamp) at time zone ${REPORT_TIME_ZONE})`,
    until: sql`least((((${range.toDate}::date + 1)::timestamp) at time zone ${REPORT_TIME_ZONE}), now())`,
  };
}

export type ClubCoachRow = {
  id: string;
  name: string;
  email: string;
  /** Es la cuenta que gestiona el club (aparece si también da clases). */
  isOwner: boolean;
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
  range: ReportRange;
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
  range: ReportRange
): Promise<ClubReport> {
  const { since, until } = rangeBounds(range);

  const [[summary], coachRows, playerRows] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      with done as (
        select s.id, s.duration_minutes from sessions s
        where s.club_id = ${clubId}
          and s.scheduled_at >= ${since} and s.scheduled_at < ${until}
          and s.status <> 'cancelled'
      )
      select
        (select count(distinct cm.user_id) from club_members cm
          where cm.club_id = ${clubId} and cm.role = 'coach'
            and cm.status = 'active') as coaches,
        (select count(*) from club_invites ci
          where ci.club_id = ${clubId} and ci.status = 'pending'
            and ci.expires_at > now()) as pending_invites,
        (select count(*) from students st
          where st.club_id = ${clubId}
            and (st.left_at is null or st.left_at > current_date)) as players,
        (select count(*) from students st
          where st.club_id = ${clubId} and st.created_at >= ${since}
            and st.created_at < ${until}) as new_players,
        (select count(*) from done) as sessions,
        (select coalesce(sum(duration_minutes), 0) from done) as minutes,
        (select count(*) from sessions s
          where s.club_id = ${clubId} and s.status = 'cancelled'
            and s.scheduled_at >= ${since} and s.scheduled_at < ${until}) as cancelled,
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
            and so.achieved_at >= ${since}
            and so.achieved_at < ${until}) as objectives
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
          and s.scheduled_at >= ${since} and s.scheduled_at < ${until}
          and s.status <> 'cancelled'
      )
      select u.id, u.name, u.email,
        (u.id = (select c.owner_id from clubs c where c.id = ${clubId})) as is_owner,
        (select count(*) from students st
          where st.club_id = ${clubId} and st.coach_id = u.id
            and (st.left_at is null or st.left_at > current_date)) as players,
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
          and s.scheduled_at >= ${since} and s.scheduled_at < ${until}
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
            and so.achieved_at >= ${since}
            and so.achieved_at < ${until}) as objectives_period
      from students st
      join users u on u.id = st.coach_id
      where st.club_id = ${clubId}
        and (st.left_at is null or st.left_at > current_date)
      order by st.name
    `),
  ]);

  return {
    range,
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
      isOwner: r.is_owner === true,
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
