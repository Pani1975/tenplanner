import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  loadClubReport,
  rangeBounds,
  REPORT_TIME_ZONE,
  type ClubReport,
  type ReportRange,
} from "@/lib/club-reports";
import { statsForSessionIds } from "@/lib/stats/load-training-stats";
import type { TrainingStats } from "@/lib/stats/training-stats";

// Datos en bruto del informe de gestión de un club en un periodo. Solo cuenta
// lo que es del club (club_id = el club), nunca el trabajo particular de sus
// monitores. Las cifras ya listas para mostrar salen de ./views.ts.
//
// - Sesiones impartidas: del club, con fecha dentro del periodo, ya pasadas y
//   no canceladas. El monitor de una sesión es quien la imparte
//   (coach_id) o, si no hay, quien la creó.
// - Alumnos del periodo: los dados de alta (joined_at) hasta el fin del
//   periodo; los que ya estaban de baja entonces no cuentan como activos.

export interface ReportStudent {
  id: string;
  name: string;
  coachName: string;
  gender: string | null;
  birthDate: string | null;
  level: string | null;
  hand: string | null;
  locality: string | null;
  joinedAt: string;
  isSignup: boolean;
  howFound: string | null;
  howFoundDetail: string | null;
  /** Ya de baja al final del periodo. */
  isGone: boolean;
  leftInPeriod: boolean;
  leftAt: string | null;
  leftReason: string | null;
  leftReasonDetail: string | null;
}

export interface ReportSession {
  id: string;
  coachId: string;
  coachName: string;
  minutes: number;
  /** 1 = lunes … 7 = domingo (hora local). */
  isoDow: number;
  hour: number;
  /** YYYY-MM (hora local). */
  month: string;
  place: string | null;
  groupId: string | null;
  intensity: number | null;
  rating: number | null;
  planFollowed: boolean | null;
  planChangeReason: string | null;
  sourceClassId: string | null;
}

export interface ClubReportData {
  range: ReportRange;
  /** Fecha (YYYY-MM-DD) en que acaba el periodo: base de las edades. */
  endDate: string;
  base: ClubReport;
  students: ReportStudent[];
  groups: { id: string; name: string; studentIds: string[] }[];
  sessions: ReportSession[];
  cancelled: { coachId: string; coachName: string; note: string | null }[];
  /** Lista de alumnos en sesiones impartidas. attended null = sin anotar. */
  attendance: {
    sessionId: string;
    studentId: string;
    attended: boolean | null;
  }[];
  /** Cada vez que aparece un ejercicio de biblioteca en una sesión impartida. */
  exerciseUses: { sessionId: string; exerciseId: string; name: string }[];
  exerciseRatings: { exerciseId: string; name: string; rating: number }[];
  objectives: { studentId: string; aspect: string }[];
  exercisesCreated: number;
  classes: {
    id: string;
    name: string;
    niveles: string[];
    aspectos: string[];
    createdInPeriod: boolean;
  }[];
  /** Nombres de las clases usadas en las sesiones (también de la Biblioteca). */
  classNames: Map<string, string>;
  bookings: {
    place: string;
    minutes: number;
    kind: string;
    cancelled: boolean;
  }[];
  training: TrainingStats;
}

function n(v: unknown) {
  return Number(v ?? 0);
}

function str(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

function list(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

export async function loadClubReportData(
  clubId: string,
  range: ReportRange
): Promise<ClubReportData> {
  const { since, until } = rangeBounds(range);
  const tz = REPORT_TIME_ZONE;
  const sinceDate = sql`((${since}) at time zone ${tz})::date`;
  const untilDate = sql`(((${until}) - interval '1 microsecond') at time zone ${tz})::date`;
  const doneCte = sql`
    done as (
      select s.* from sessions s
      where s.club_id = ${clubId}
        and s.scheduled_at >= ${since} and s.scheduled_at < ${until}
        and s.status <> 'cancelled'
    )`;

  const [
    base,
    [endRow],
    studentRows,
    groupRows,
    membershipRows,
    sessionRows,
    cancelledRows,
    attendanceRows,
    useRows,
    ratingRows,
    objectiveRows,
    [createdRow],
    classRows,
    classNameRows,
    bookingRows,
  ] = await Promise.all([
    loadClubReport(clubId, range),
    db.execute<Record<string, unknown>>(
      sql`select to_char(${untilDate}, 'YYYY-MM-DD') as end_date`
    ),
    db.execute<Record<string, unknown>>(sql`
      select st.id, st.name, u.name as coach_name, st.gender,
        to_char(st.birth_date, 'YYYY-MM-DD') as birth_date,
        st.player_level, st.dominant_hand, st.locality,
        to_char(st.joined_at, 'YYYY-MM-DD') as joined_at,
        (st.joined_at >= ${sinceDate}) as is_signup,
        st.how_found, st.how_found_detail,
        (st.left_at is not null and st.left_at <= ${untilDate}) as is_gone,
        (st.left_at is not null and st.left_at >= ${sinceDate}
          and st.left_at <= ${untilDate}) as left_in_period,
        to_char(st.left_at, 'YYYY-MM-DD') as left_at,
        st.left_reason, st.left_reason_detail
      from students st
      left join users u on u.id = st.coach_id
      where st.club_id = ${clubId} and st.joined_at <= ${untilDate}
      order by st.name
    `),
    db.execute<Record<string, unknown>>(sql`
      select g.id, g.name from groups g
      where g.club_id = ${clubId} and g.created_at < ${until}
      order by g.name
    `),
    db.execute<Record<string, unknown>>(sql`
      select gs.group_id, gs.student_id from group_students gs
      join groups g on g.id = gs.group_id
      where g.club_id = ${clubId}
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select d.id, coalesce(d.coach_id, d.user_id) as coach_id,
        u.name as coach_name, d.duration_minutes,
        extract(isodow from d.scheduled_at at time zone ${tz}) as dow,
        extract(hour from d.scheduled_at at time zone ${tz}) as hour,
        to_char(d.scheduled_at at time zone ${tz}, 'YYYY-MM') as month,
        coalesce(p.name, nullif(trim(d.location), '')) as place,
        d.group_id, d.intensity, d.coach_rating, d.plan_followed,
        d.plan_change_reason, d.source_class_id
      from done d
      left join users u on u.id = coalesce(d.coach_id, d.user_id)
      left join places p on p.id = d.place_id
    `),
    db.execute<Record<string, unknown>>(sql`
      select coalesce(s.coach_id, s.user_id) as coach_id, u.name as coach_name,
        s.status_note
      from sessions s
      left join users u on u.id = coalesce(s.coach_id, s.user_id)
      where s.club_id = ${clubId} and s.status = 'cancelled'
        and s.scheduled_at >= ${since} and s.scheduled_at < ${until}
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select ss.session_id, ss.student_id, ss.attended
      from session_students ss join done d on d.id = ss.session_id
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte},
      uses as (
        select b.session_id, i.exercise_id
        from session_block_items i
        join session_blocks b on b.id = i.block_id
        join done d on d.id = b.session_id
        where i.exercise_id is not null
        union all
        select b.session_id, (st.value ->> 'exerciseId')::uuid
        from session_block_items i
        join session_blocks b on b.id = i.block_id
        join done d on d.id = b.session_id
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(i.stations) = 'array'
            then i.stations else '[]'::jsonb end
        ) as st(value)
        where st.value ->> 'exerciseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
      select uses.session_id, uses.exercise_id, e.name
      from uses join exercises e on e.id = uses.exercise_id
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select se.exercise_id, e.name, se.coach_rating
      from session_exercises se
      join done d on d.id = se.session_id
      join exercises e on e.id = se.exercise_id
      where se.coach_rating is not null
    `),
    db.execute<Record<string, unknown>>(sql`
      select so.student_id, o.aspect
      from student_objectives so
      join students st on st.id = so.student_id
      join tennis_objectives o on o.id = so.objective_id
      where st.club_id = ${clubId} and so.achieved
        and so.achieved_at >= ${since} and so.achieved_at < ${until}
    `),
    db.execute<Record<string, unknown>>(sql`
      select count(*) as total from exercises e
      where e.club_id = ${clubId}
        and e.created_at >= ${since} and e.created_at < ${until}
    `),
    db.execute<Record<string, unknown>>(sql`
      select c.id, c.name, c.nivel, c.niveles, c.aspecto_juego, c.aspectos_juego,
        (c.created_at >= ${since} and c.created_at < ${until}) as created_in_period
      from classes c
      where c.club_id = ${clubId} and c.status = 'published'
        and c.created_at < ${until}
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select distinct c.id, c.name from done d
      join classes c on c.id = d.source_class_id
    `),
    db.execute<Record<string, unknown>>(sql`
      select p.name as place, b.duration_minutes, b.kind,
        (b.cancelled_at is not null) as cancelled
      from court_bookings b
      join places p on p.id = b.place_id
      where b.owner_id = (select c.owner_id from clubs c where c.id = ${clubId})
        and b.start_at >= ${since} and b.start_at < ${until}
    `),
  ]);

  const memberships = new Map<string, string[]>();
  for (const r of membershipRows) {
    const key = String(r.group_id);
    memberships.set(key, [
      ...(memberships.get(key) ?? []),
      String(r.student_id),
    ]);
  }

  const sessions: ReportSession[] = sessionRows.map((r) => ({
    id: String(r.id),
    coachId: String(r.coach_id),
    coachName: str(r.coach_name) ?? "Sin monitor",
    minutes: n(r.duration_minutes),
    isoDow: n(r.dow),
    hour: n(r.hour),
    month: String(r.month),
    place: str(r.place),
    groupId: str(r.group_id),
    intensity: r.intensity === null ? null : n(r.intensity),
    rating: r.coach_rating === null ? null : n(r.coach_rating),
    planFollowed:
      r.plan_followed === true
        ? true
        : r.plan_followed === false
          ? false
          : null,
    planChangeReason: str(r.plan_change_reason),
    sourceClassId: str(r.source_class_id),
  }));

  const training = await statsForSessionIds(sessions.map((s) => s.id));

  return {
    range,
    endDate: String(endRow?.end_date),
    base,
    students: studentRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      coachName: str(r.coach_name) ?? "",
      gender: str(r.gender),
      birthDate: str(r.birth_date),
      level: str(r.player_level),
      hand: str(r.dominant_hand),
      locality: str(r.locality)?.trim() || null,
      joinedAt: String(r.joined_at),
      isSignup: r.is_signup === true,
      howFound: str(r.how_found),
      howFoundDetail: str(r.how_found_detail),
      isGone: r.is_gone === true,
      leftInPeriod: r.left_in_period === true,
      leftAt: str(r.left_at),
      leftReason: str(r.left_reason),
      leftReasonDetail: str(r.left_reason_detail),
    })),
    groups: groupRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      studentIds: memberships.get(String(r.id)) ?? [],
    })),
    sessions,
    cancelled: cancelledRows.map((r) => ({
      coachId: String(r.coach_id),
      coachName: str(r.coach_name) ?? "Sin monitor",
      note: str(r.status_note),
    })),
    attendance: attendanceRows.map((r) => ({
      sessionId: String(r.session_id),
      studentId: String(r.student_id),
      attended:
        r.attended === true ? true : r.attended === false ? false : null,
    })),
    exerciseUses: useRows.map((r) => ({
      sessionId: String(r.session_id),
      exerciseId: String(r.exercise_id),
      name: String(r.name),
    })),
    exerciseRatings: ratingRows.map((r) => ({
      exerciseId: String(r.exercise_id),
      name: String(r.name),
      rating: n(r.coach_rating),
    })),
    objectives: objectiveRows.map((r) => ({
      studentId: String(r.student_id),
      aspect: String(r.aspect),
    })),
    exercisesCreated: n(createdRow?.total),
    classes: classRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      niveles: list(r.niveles).length
        ? list(r.niveles)
        : r.nivel
          ? [String(r.nivel)]
          : [],
      aspectos: list(r.aspectos_juego).length
        ? list(r.aspectos_juego)
        : r.aspecto_juego
          ? [String(r.aspecto_juego)]
          : [],
      createdInPeriod: r.created_in_period === true,
    })),
    classNames: new Map(
      classNameRows.map((r) => [String(r.id), String(r.name)])
    ),
    bookings: bookingRows.map((r) => ({
      place: String(r.place),
      minutes: n(r.duration_minutes),
      kind: String(r.kind),
      cancelled: r.cancelled === true,
    })),
    training,
  };
}
