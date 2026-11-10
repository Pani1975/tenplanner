import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  REPORT_TIME_ZONE,
  rangeBounds,
  type ReportRange,
} from "@/lib/club-reports";
import { planChangeReasonLabel } from "@/lib/sessions/plan-change";
import { howFoundLabel, leftReasonLabel } from "@/lib/students/membership";
import { ageOn } from "@/lib/students/stats";
import { statsForSessionIds } from "@/lib/stats/load-training-stats";
import type { Share, StatAspect, TopExercise } from "@/lib/stats/training-stats";

// Datos detallados del informe de gestión de un club en un periodo: alumnos,
// frecuencia, altas, reparto de las clases, ejercicios, aspectos, valoración,
// cancelaciones y cambios sobre el plan. Igual que en lib/club-reports.ts, solo
// cuenta lo que es del club (club_id = el club).

/** Secciones que se pueden incluir en el informe en PDF. */
export const REPORT_SECTIONS = [
  { id: "alumnos", label: "Número de alumnos y de grupos" },
  { id: "genero", label: "Alumnos por género" },
  { id: "edad", label: "Edad media y mediana" },
  { id: "procedencia", label: "De dónde vienen los alumnos" },
  { id: "frecuencia", label: "Veces por semana que vienen (media)" },
  { id: "altas", label: "Altas y bajas del periodo" },
  { id: "dia_semana", label: "Clases por día de la semana" },
  { id: "monitores", label: "Clases y horas en pista por monitor" },
  { id: "ejercicios_monitor", label: "Ejercicios usados por monitor" },
  { id: "ejercicio_top", label: "Ejercicio más repetido" },
  { id: "aspectos", label: "% por aspectos técnicos, tácticos, mentales y físicos" },
  { id: "valoracion", label: "Valoración media de las sesiones" },
  { id: "ejercicios_valorados", label: "Ejercicios mejor y peor valorados" },
  { id: "canceladas", label: "Sesiones canceladas y motivos" },
  { id: "modificadas", label: "Sesiones modificadas y motivos" },
] as const;

export type ReportSectionId = (typeof REPORT_SECTIONS)[number]["id"];

export const REPORT_SECTION_IDS = REPORT_SECTIONS.map((s) => s.id) as [
  ReportSectionId,
  ...ReportSectionId[],
];

/** Lee `secciones=a,b,c`; sin parámetro (o todo inválido) son todas. */
export function parseReportSections(value: unknown): ReportSectionId[] {
  if (typeof value !== "string" || !value.trim()) return [...REPORT_SECTION_IDS];
  const wanted = new Set(value.split(",").map((v) => v.trim()));
  const picked = REPORT_SECTION_IDS.filter((id) => wanted.has(id));
  return picked.length ? picked : [...REPORT_SECTION_IDS];
}

export const GENDER_LABELS = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
  unknown: "Sin indicar",
} as const;
export type GenderKey = keyof typeof GENDER_LABELS;

export const ASPECT_LABELS: Record<StatAspect, string> = {
  tecnica: "Técnico",
  tactica: "Táctico",
  mental: "Mental",
  fisico: "Físico",
};

/** Lunes primero, como se lee un calendario en España. */
export const WEEKDAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export interface CountRow {
  label: string;
  count: number;
}

export interface RatedExercise {
  name: string;
  average: number;
  count: number;
}

export interface ClubDetailReport {
  students: {
    total: number;
    groups: number;
    gender: Record<GenderKey, number>;
    ageAverage: number | null;
    ageMedian: number | null;
    agesCounted: number;
    origins: CountRow[];
    withoutLocality: number;
  };
  /** Veces por semana que asiste de media un alumno que ha asistido. */
  weekly: { average: number | null; students: number; weeks: number };
  signups: {
    count: number;
    rows: { name: string; date: string; howFound: string | null }[];
    /** Cómo conocieron la escuela los alumnos dados de alta en el periodo. */
    howFound: CountRow[];
  };
  departures: {
    count: number;
    rows: { name: string; date: string; reason: string | null }[];
    reasons: CountRow[];
  };
  weekdays: { label: string; sessions: number; minutes: number }[];
  exercisesByCoach: {
    id: string;
    name: string;
    uses: number;
    distinct: number;
  }[];
  topExercises: TopExercise[];
  aspects: Share<StatAspect>[];
  sessionRating: { average: number | null; rated: number; sessions: number };
  bestExercises: RatedExercise[];
  worstExercises: RatedExercise[];
  cancelled: { count: number; reasons: CountRow[] };
  modified: {
    count: number;
    /** Sesiones cuyo monitor respondió si se dio como estaba planificada. */
    answered: number;
    reasons: CountRow[];
  };
}

function n(v: unknown) {
  return Number(v ?? 0);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Agrupa textos libres (sin distinguir mayúsculas) y los cuenta, más frecuentes primero. */
export function countReasons(
  values: (string | null | undefined)[],
  emptyLabel: string
): CountRow[] {
  const groups = new Map<string, CountRow>();
  for (const raw of values) {
    const text = (raw ?? "").trim().replace(/\s+/g, " ");
    const key = text.toLowerCase();
    const entry = groups.get(key) ?? { label: text || emptyLabel, count: 0 };
    entry.count += 1;
    groups.set(key, entry);
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

/** Mejor y peor valorados; el peor excluye a los que ya salen entre los mejores. */
export function splitRatedExercises(
  rated: RatedExercise[],
  size = 5
): { best: RatedExercise[]; worst: RatedExercise[] } {
  const byBest = [...rated].sort(
    (a, b) =>
      b.average - a.average || b.count - a.count || a.name.localeCompare(b.name)
  );
  const best = byBest.slice(0, size);
  const bestNames = new Set(best.map((e) => e.name));
  const worst = [...rated]
    .sort(
      (a, b) =>
        a.average - b.average ||
        b.count - a.count ||
        a.name.localeCompare(b.name)
    )
    .filter((e) => !bestNames.has(e.name))
    .slice(0, size);
  return { best, worst };
}

export async function loadClubDetailReport(
  clubId: string,
  range: ReportRange
): Promise<ClubDetailReport> {
  const { since, until } = rangeBounds(range);
  const tz = REPORT_TIME_ZONE;

  // Sesiones impartidas: del club, dentro del periodo y no canceladas.
  const doneCte = sql`
    done as (
      select s.id, s.user_id, s.duration_minutes, s.coach_rating,
        s.plan_followed, s.plan_change_reason, s.scheduled_at
      from sessions s
      where s.club_id = ${clubId}
        and s.scheduled_at >= ${since} and s.scheduled_at < ${until}
        and s.status <> 'cancelled'
    )`;

  const [
    studentRows,
    groupRows,
    attendanceRows,
    weekdayRows,
    coachExerciseRows,
    ratingRows,
    exerciseRatingRows,
    cancelledRows,
    modifiedRows,
    doneIdRows,
  ] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      select st.id, st.name, st.gender, st.birth_date, st.locality,
        to_char(st.joined_at, 'YYYY-MM-DD') as joined_text,
        (st.joined_at >= (${since} at time zone ${tz})::date) as is_signup,
        st.how_found, st.how_found_detail,
        (st.left_at is not null
          and st.left_at <= ((${until} - interval '1 microsecond') at time zone ${tz})::date) as is_gone,
        to_char(st.left_at, 'YYYY-MM-DD') as left_at_text,
        st.left_reason, st.left_reason_detail,
        (st.left_at is not null
          and st.left_at >= (${since} at time zone ${tz})::date
          and st.left_at <= ((${until} - interval '1 microsecond') at time zone ${tz})::date) as left_in_period
      from students st
      where st.club_id = ${clubId}
        and st.joined_at <= ((${until} - interval '1 microsecond') at time zone ${tz})::date
    `),
    db.execute<Record<string, unknown>>(sql`
      select count(*) as total from groups g
      where g.club_id = ${clubId} and g.created_at < ${until}
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select ss.student_id, count(*) filter (where ss.attended) as present
      from session_students ss
      join done d on d.id = ss.session_id
      group by ss.student_id
      having count(*) filter (where ss.attended) > 0
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select extract(isodow from d.scheduled_at at time zone ${tz}) as dow,
        count(*) as sessions, coalesce(sum(d.duration_minutes), 0) as minutes
      from done d group by 1
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte},
      uses as (
        select d.user_id, i.exercise_id
        from session_block_items i
        join session_blocks b on b.id = i.block_id
        join done d on d.id = b.session_id
        where i.exercise_id is not null
        union all
        select d.user_id, (st.value ->> 'exerciseId')::uuid
        from session_block_items i
        join session_blocks b on b.id = i.block_id
        join done d on d.id = b.session_id
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(i.stations) = 'array'
            then i.stations else '[]'::jsonb end
        ) as st(value)
        where st.value ->> 'exerciseId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
      select u.id, u.name, count(*) as uses,
        count(distinct uses.exercise_id) as distinct_exercises
      from uses join users u on u.id = uses.user_id
      group by u.id, u.name
      order by uses desc, u.name
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select count(*) as sessions, count(d.coach_rating) as rated,
        avg(d.coach_rating) as average
      from done d
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select e.name, avg(se.coach_rating) as average,
        count(se.coach_rating) as ratings
      from session_exercises se
      join done d on d.id = se.session_id
      join exercises e on e.id = se.exercise_id
      where se.coach_rating is not null
      group by e.id, e.name
    `),
    db.execute<Record<string, unknown>>(sql`
      select s.status_note from sessions s
      where s.club_id = ${clubId} and s.status = 'cancelled'
        and s.scheduled_at >= ${since} and s.scheduled_at < ${until}
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte}
      select d.plan_followed, d.plan_change_reason from done d
      where d.plan_followed is not null
    `),
    db.execute<Record<string, unknown>>(sql`
      with ${doneCte} select d.id from done d
    `),
  ]);

  // Alumnos: género, edades (a fecha del fin del periodo) y procedencia.
  const asOf =
    range.kind === "custom"
      ? new Date(`${range.toDate}T12:00:00Z`)
      : new Date();
  const gender: Record<GenderKey, number> = {
    male: 0,
    female: 0,
    other: 0,
    unknown: 0,
  };
  const ages: number[] = [];
  const localities = new Map<string, CountRow>();
  let withoutLocality = 0;
  const signupRows: {
    name: string;
    date: string;
    at: number;
    howFound: string | null;
    howFoundKey: string | null;
  }[] = [];
  const departureRows: {
    name: string;
    date: string;
    reason: string | null;
    detail: string | null;
  }[] = [];
  let activeStudents = 0;
  for (const st of studentRows) {
    if (st.is_signup === true) {
      const key = st.how_found ? String(st.how_found) : null;
      const detail = st.how_found_detail ? String(st.how_found_detail) : null;
      signupRows.push({
        name: String(st.name),
        date: String(st.joined_text),
        at: Date.parse(`${st.joined_text}T00:00:00Z`),
        howFound: howFoundLabel(key) ?? (detail || null),
        howFoundKey: key,
      });
    }
    if (st.left_in_period === true) {
      departureRows.push({
        name: String(st.name),
        date: String(st.left_at_text),
        reason: leftReasonLabel(st.left_reason ? String(st.left_reason) : null),
        detail: st.left_reason_detail ? String(st.left_reason_detail) : null,
      });
    }
    // Los alumnos que ya se habían dado de baja no cuentan como alumnos.
    if (st.is_gone === true) continue;
    activeStudents += 1;
    const g = String(st.gender ?? "");
    gender[g === "male" || g === "female" || g === "other" ? g : "unknown"] += 1;
    const age = ageOn(st.birth_date ? String(st.birth_date) : null, asOf);
    if (age !== null) ages.push(age);
    const locality = String(st.locality ?? "").trim();
    if (!locality) withoutLocality += 1;
    else {
      const key = locality
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      const entry = localities.get(key) ?? { label: locality, count: 0 };
      entry.count += 1;
      localities.set(key, entry);
    }
  }
  signupRows.sort((a, b) => a.at - b.at);

  // Frecuencia: asistencias de cada alumno que ha venido / semanas del periodo.
  const weeks = Math.max(range.days / 7, 1 / 7);
  const perStudent = attendanceRows.map((r) => n(r.present) / weeks);
  const weeklyAverage = perStudent.length
    ? round1(perStudent.reduce((a, b) => a + b, 0) / perStudent.length)
    : null;

  const weekdayByDow = new Map(
    weekdayRows.map((r) => [
      n(r.dow),
      { sessions: n(r.sessions), minutes: n(r.minutes) },
    ])
  );

  const doneIds = doneIdRows.map((r) => String(r.id));
  const training = await statsForSessionIds(doneIds);

  const ratingSummary = ratingRows[0];
  const sessionAverage =
    n(ratingSummary?.rated) > 0 ? round1(n(ratingSummary?.average)) : null;

  const rated: RatedExercise[] = exerciseRatingRows.map((r) => ({
    name: String(r.name),
    average: round1(n(r.average)),
    count: n(r.ratings),
  }));
  const { best, worst } = splitRatedExercises(rated);

  const modifiedOnes = modifiedRows.filter((r) => r.plan_followed === false);

  return {
    students: {
      total: activeStudents,
      groups: n(groupRows[0]?.total),
      gender,
      ageAverage: ages.length
        ? round1(ages.reduce((a, b) => a + b, 0) / ages.length)
        : null,
      ageMedian: median(ages),
      agesCounted: ages.length,
      origins: [...localities.values()].sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label)
      ),
      withoutLocality,
    },
    weekly: { average: weeklyAverage, students: perStudent.length, weeks },
    signups: {
      count: signupRows.length,
      rows: signupRows.map(({ name, date, howFound }) => ({
        name,
        date,
        howFound,
      })),
      howFound: countReasons(
        signupRows.map((r) => r.howFound),
        "Sin indicar"
      ),
    },
    departures: {
      count: departureRows.length,
      rows: departureRows
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({
          name: r.name,
          date: r.date,
          reason: r.detail ? `${r.reason ?? "Sin motivo"} · ${r.detail}` : r.reason,
        })),
      reasons: countReasons(
        departureRows.map((r) => r.reason),
        "Sin motivo indicado"
      ),
    },
    weekdays: WEEKDAY_NAMES.map((label, i) => ({
      label,
      sessions: weekdayByDow.get(i + 1)?.sessions ?? 0,
      minutes: weekdayByDow.get(i + 1)?.minutes ?? 0,
    })),
    exercisesByCoach: coachExerciseRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      uses: n(r.uses),
      distinct: n(r.distinct_exercises),
    })),
    topExercises: training.topExercises.slice(0, 5),
    aspects: training.aspects,
    sessionRating: {
      average: sessionAverage,
      rated: n(ratingSummary?.rated),
      sessions: n(ratingSummary?.sessions),
    },
    bestExercises: best,
    worstExercises: worst,
    cancelled: {
      count: cancelledRows.length,
      reasons: countReasons(
        cancelledRows.map((r) => (r.status_note ? String(r.status_note) : null)),
        "Sin motivo indicado"
      ),
    },
    modified: {
      count: modifiedOnes.length,
      answered: modifiedRows.length,
      reasons: countReasons(
        modifiedOnes.map(
          (r) =>
            planChangeReasonLabel(
              r.plan_change_reason ? String(r.plan_change_reason) : null
            ) ?? null
        ),
        "Sin motivo indicado"
      ),
    },
  };
}
