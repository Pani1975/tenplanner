import { nivelLabel } from "@/lib/exercise-taxonomy";
import { planChangeReasonLabel } from "@/lib/sessions/plan-change";
import { STROKE_LABEL, typeLabel } from "@/lib/stats/labels";
import type { StatAspect, StatPhase } from "@/lib/stats/training-stats";
import { howFoundLabel, leftReasonLabel } from "@/lib/students/membership";
import { ageOn } from "@/lib/students/stats";
import type { ReportMetricId } from "./catalog";
import type { ClubReportData } from "./data";
import { formatHours, formatNumber, formatPct, pctOf, round2 } from "./format";

// Convierte los datos en bruto en "vistas" genéricas (cifras, barras, tablas
// y notas) que pintan igual la pantalla y el PDF. Funciones puras.

export interface StatItem {
  label: string;
  value: string;
  hint?: string;
}
export interface BarItem {
  label: string;
  /** Valor numérico para el largo de la barra. */
  value: number;
  /** Texto a la derecha de la barra. */
  display: string;
}
export type ViewPart =
  | { kind: "stats"; items: StatItem[] }
  | { kind: "bars"; title?: string; rows: BarItem[] }
  | {
      kind: "table";
      title?: string;
      columns: { label: string; align?: "right" }[];
      rows: string[][];
    }
  | { kind: "note"; text: string };

export interface MetricView {
  title: string;
  hint?: string;
  parts: ViewPart[];
  /** Texto cuando no hay datos (sustituye a las partes vacías). */
  empty?: string;
}

export interface CountRow {
  label: string;
  count: number;
}

// ─── utilidades ────────────────────────────────────────────────────────────

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values: number[]): number | null {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

/** Agrupa textos (sin distinguir mayúsculas) y los cuenta; más frecuentes primero. */
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

export interface RatedExercise {
  name: string;
  average: number;
  count: number;
}

/** Mejor y peor valorados; el peor excluye a los que ya salen entre los mejores. */
export function splitRatedExercises(
  rated: RatedExercise[],
  size = 5
): { best: RatedExercise[]; worst: RatedExercise[] } {
  const best = [...rated]
    .sort(
      (a, b) =>
        b.average - a.average ||
        b.count - a.count ||
        a.name.localeCompare(b.name)
    )
    .slice(0, size);
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

/** Barras de un reparto: "3 · 33,33 %". */
function shareBars(rows: CountRow[], limit = 12): BarItem[] {
  const total = rows.reduce((a, r) => a + r.count, 0);
  return rows.slice(0, limit).map((r) => ({
    label: r.label,
    value: r.count,
    display: `${r.count} · ${formatPct(pctOf(r.count, total))}`,
  }));
}

function countBars(rows: CountRow[], limit = 12): BarItem[] {
  return rows
    .slice(0, limit)
    .map((r) => ({ label: r.label, value: r.count, display: String(r.count) }));
}

function tally<T>(items: T[], key: (item: T) => string): CountRow[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

const DATE_FMT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function fmtDate(isoDate: string | null) {
  return isoDate ? DATE_FMT.format(new Date(`${isoDate}T12:00:00Z`)) : "—";
}

const MONTH_FMT = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const GENDER_LABELS: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
  other: "Otro",
};
const HAND_LABELS: Record<string, string> = {
  right: "Diestro",
  left: "Zurdo",
};
export const WEEKDAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const HOUR_BANDS: { label: string; from: number; to: number }[] = [
  { label: "Antes de las 10", from: 0, to: 9 },
  { label: "10 a 12", from: 10, to: 11 },
  { label: "12 a 14", from: 12, to: 13 },
  { label: "14 a 16", from: 14, to: 15 },
  { label: "16 a 18", from: 16, to: 17 },
  { label: "18 a 20", from: 18, to: 19 },
  { label: "20 o más", from: 20, to: 23 },
];
const AGE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Menos de 7", min: 0, max: 6 },
  { label: "7-8", min: 7, max: 8 },
  { label: "9-10", min: 9, max: 10 },
  { label: "11-12", min: 11, max: 12 },
  { label: "13-14", min: 13, max: 14 },
  { label: "15-16", min: 15, max: 16 },
  { label: "17-18", min: 17, max: 18 },
  { label: "19-29", min: 19, max: 29 },
  { label: "30-49", min: 30, max: 49 },
  { label: "50 o más", min: 50, max: 120 },
];
export const ASPECT_LABELS: Record<StatAspect, string> = {
  tecnica: "Técnico",
  tactica: "Táctico",
  mental: "Mental",
  fisico: "Físico",
};
const OBJECTIVE_ASPECT_LABELS: Record<string, string> = {
  tecnico: "Técnico",
  tactico: "Táctico",
  mental: "Mental",
  fisico: "Físico",
};
const PHASE_LABELS: Record<StatPhase, string> = {
  activation: "Calentamiento",
  main: "Bloque principal",
  cooldown: "Vuelta a la calma",
};

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// ─── vistas ────────────────────────────────────────────────────────────────

/**
 * Construye las vistas de los datos pedidos. `phrase` describe el periodo
 * ("los últimos 30 días").
 */
export function buildMetricViews(
  data: ClubReportData,
  metrics: readonly ReportMetricId[]
): Map<ReportMetricId, MetricView> {
  const phrase = data.range.phrase;
  const active = data.students.filter((s) => !s.isGone);
  const asOf = new Date(`${data.endDate}T12:00:00Z`);
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]));
  const weeks = Math.max(data.range.days / 7, 1 / 7);

  // Asistencia por alumno en las sesiones impartidas.
  const presentByStudent = new Map<string, number>();
  let present = 0;
  let marked = 0;
  for (const a of data.attendance) {
    if (a.attended !== null) marked += 1;
    if (a.attended) {
      present += 1;
      presentByStudent.set(
        a.studentId,
        (presentByStudent.get(a.studentId) ?? 0) + 1
      );
    }
  }
  const studentName = new Map(data.students.map((s) => [s.id, s.name]));

  const coachIds = new Map<string, string>();
  for (const s of data.sessions) coachIds.set(s.coachId, s.coachName);
  for (const c of data.cancelled) coachIds.set(c.coachId, c.coachName);

  const builders: Record<ReportMetricId, () => MetricView> = {
    // ── Alumnos ──
    alumnos_resumen: () => {
      const signups = data.students.filter((s) => s.isSignup).length;
      const departures = data.students.filter((s) => s.leftInPeriod).length;
      const net = signups - departures;
      return {
        title: "Alumnos",
        hint: `Alumnos activos al final del periodo; altas y bajas en ${phrase}.`,
        parts: [
          {
            kind: "stats",
            items: [
              { label: "Alumnos activos", value: String(active.length) },
              { label: "Altas", value: String(signups) },
              { label: "Bajas", value: String(departures) },
              {
                label: "Variación",
                value: net > 0 ? `+${net}` : String(net),
              },
            ],
          },
        ],
      };
    },
    alumnos_genero: () => ({
      title: "Alumnos por género",
      parts: [
        {
          kind: "bars",
          rows: shareBars(
            tally(active, (s) => GENDER_LABELS[s.gender ?? ""] ?? "Sin indicar")
          ),
        },
      ],
      empty: active.length ? undefined : "No hay alumnos.",
    }),
    alumnos_edad: () => {
      const ages = active
        .map((s) => ageOn(s.birthDate, asOf))
        .filter((a): a is number => a !== null);
      const bands = AGE_BANDS.map((b) => ({
        label: b.label,
        count: ages.filter((a) => a >= b.min && a <= b.max).length,
      })).filter((b) => b.count > 0);
      const avg = average(ages);
      const med = median(ages);
      return {
        title: "Edad",
        hint: `${ages.length} de ${active.length} alumnos con fecha de nacimiento.`,
        parts: ages.length
          ? [
              {
                kind: "stats",
                items: [
                  {
                    label: "Edad media",
                    value: `${formatNumber(round2(avg!))} años`,
                  },
                  {
                    label: "Edad mediana",
                    value: `${formatNumber(round2(med!))} años`,
                  },
                  { label: "Más joven", value: `${Math.min(...ages)} años` },
                  { label: "Mayor", value: `${Math.max(...ages)} años` },
                ],
              },
              {
                kind: "bars",
                title: "Por tramos de edad",
                rows: shareBars(bands, 20),
              },
            ]
          : [],
        empty: "Faltan fechas de nacimiento en las fichas.",
      };
    },
    alumnos_nivel: () => ({
      title: "Alumnos por nivel",
      parts: [
        {
          kind: "bars",
          rows: shareBars(
            tally(active, (s) => (s.level ? nivelLabel(s.level) : "Sin nivel")),
            20
          ),
        },
      ],
      empty: active.length ? undefined : "No hay alumnos.",
    }),
    alumnos_mano: () => ({
      title: "Mano dominante",
      parts: [
        {
          kind: "bars",
          rows: shareBars(
            tally(active, (s) => HAND_LABELS[s.hand ?? ""] ?? "Sin indicar")
          ),
        },
      ],
      empty: active.length ? undefined : "No hay alumnos.",
    }),
    alumnos_procedencia: () => {
      const byKey = new Map<string, CountRow>();
      let without = 0;
      for (const s of active) {
        if (!s.locality) {
          without += 1;
          continue;
        }
        const key = normalizeKey(s.locality);
        const e = byKey.get(key) ?? { label: s.locality, count: 0 };
        e.count += 1;
        byKey.set(key, e);
      }
      const rows = [...byKey.values()].sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label)
      );
      return {
        title: "De dónde vienen",
        hint: `${plural(rows.length, "localidad", "localidades")}${without ? ` · ${plural(without, "alumno", "alumnos")} sin localidad` : ""}.`,
        parts: rows.length ? [{ kind: "bars", rows: shareBars(rows, 15) }] : [],
        empty: "Ningún alumno tiene localidad registrada.",
      };
    },
    alumnos_frecuencia: () => {
      const perWeek = active
        .map((s) => (presentByStudent.get(s.id) ?? 0) / weeks)
        .filter((v) => v > 0);
      const buckets = [
        { label: "Menos de 1 vez", count: perWeek.filter((v) => v < 1).length },
        {
          label: "De 1 a 2 veces",
          count: perWeek.filter((v) => v >= 1 && v < 2).length,
        },
        {
          label: "De 2 a 3 veces",
          count: perWeek.filter((v) => v >= 2 && v < 3).length,
        },
        { label: "3 veces o más", count: perWeek.filter((v) => v >= 3).length },
      ].filter((b) => b.count > 0);
      const avg = average(perWeek);
      return {
        title: "Veces por semana que vienen",
        hint: `Asistencias anotadas en ${phrase}, entre los alumnos que han venido alguna vez.`,
        parts: perWeek.length
          ? [
              {
                kind: "stats",
                items: [
                  {
                    label: "Media por alumno",
                    value: `${formatNumber(round2(avg!))} / semana`,
                  },
                  {
                    label: "Alumnos que han venido",
                    value: String(perWeek.length),
                  },
                ],
              },
              {
                kind: "bars",
                title: "Alumnos según frecuencia",
                rows: shareBars(buckets),
              },
            ]
          : [],
        empty: "No hay asistencia anotada en el periodo.",
      };
    },
    alumnos_asistencia: () => {
      const top = [...presentByStudent.entries()]
        .map(([id, count]) => ({
          label: studentName.get(id) ?? "Alumno",
          count,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      return {
        title: "Asistencia",
        hint: "Alumnos presentes sobre los que tienen la asistencia anotada.",
        parts: marked
          ? [
              {
                kind: "stats",
                items: [
                  {
                    label: "Asistencia",
                    value: formatPct(pctOf(present, marked)),
                  },
                  { label: "Presencias", value: String(present) },
                  { label: "Faltas", value: String(marked - present) },
                ],
              },
              {
                kind: "bars",
                title: "Alumnos que más vienen",
                rows: countBars(top, 10),
              },
            ]
          : [],
        empty: "No hay asistencia anotada en el periodo.",
      };
    },
    alumnos_altas: () => {
      const rows = data.students
        .filter((s) => s.isSignup)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
      return {
        title: "Altas",
        hint: `Alumnos dados de alta en ${phrase}.`,
        parts: rows.length
          ? [
              {
                kind: "stats",
                items: [{ label: "Altas", value: String(rows.length) }],
              },
              {
                kind: "bars",
                title: "Cómo nos conocieron",
                rows: shareBars(
                  countReasons(
                    rows.map((s) => howFoundLabel(s.howFound)),
                    "Sin indicar"
                  )
                ),
              },
              {
                kind: "table",
                columns: [
                  { label: "Alumno" },
                  { label: "Alta", align: "right" },
                  { label: "Cómo nos conoció" },
                ],
                rows: rows.map((s) => [
                  s.name,
                  fmtDate(s.joinedAt),
                  [howFoundLabel(s.howFound), s.howFoundDetail]
                    .filter(Boolean)
                    .join(" · ") || "—",
                ]),
              },
            ]
          : [],
        empty: "No hay altas en el periodo.",
      };
    },
    alumnos_bajas: () => {
      const rows = data.students
        .filter((s) => s.leftInPeriod)
        .sort((a, b) => (a.leftAt ?? "").localeCompare(b.leftAt ?? ""));
      return {
        title: "Bajas",
        hint: `Alumnos dados de baja en ${phrase}.`,
        parts: rows.length
          ? [
              {
                kind: "stats",
                items: [
                  { label: "Bajas", value: String(rows.length) },
                  {
                    label: "Sobre los alumnos",
                    value: formatPct(
                      pctOf(rows.length, active.length + rows.length)
                    ),
                  },
                ],
              },
              {
                kind: "bars",
                title: "Motivos",
                rows: shareBars(
                  countReasons(
                    rows.map((s) => leftReasonLabel(s.leftReason)),
                    "Sin motivo indicado"
                  )
                ),
              },
              {
                kind: "table",
                columns: [
                  { label: "Alumno" },
                  { label: "Baja", align: "right" },
                  { label: "Motivo" },
                ],
                rows: rows.map((s) => [
                  s.name,
                  fmtDate(s.leftAt),
                  [leftReasonLabel(s.leftReason), s.leftReasonDetail]
                    .filter(Boolean)
                    .join(" · ") || "—",
                ]),
              },
            ]
          : [],
        empty: "No hay bajas en el periodo.",
      };
    },
    alumnos_objetivos: () => {
      const byStudent = tally(
        data.objectives,
        (o) => studentName.get(o.studentId) ?? "Alumno"
      );
      return {
        title: "Objetivos conseguidos",
        hint: `Objetivos marcados como conseguidos en ${phrase}.`,
        parts: data.objectives.length
          ? [
              {
                kind: "stats",
                items: [
                  { label: "Objetivos", value: String(data.objectives.length) },
                  { label: "Alumnos", value: String(byStudent.length) },
                ],
              },
              {
                kind: "bars",
                title: "Por aspecto",
                rows: shareBars(
                  tally(
                    data.objectives,
                    (o) => OBJECTIVE_ASPECT_LABELS[o.aspect] ?? o.aspect
                  )
                ),
              },
              {
                kind: "bars",
                title: "Alumnos con más objetivos",
                rows: countBars(byStudent, 10),
              },
            ]
          : [],
        empty: "No hay objetivos conseguidos en el periodo.",
      };
    },
    alumnos_fichas: () => {
      const noBirth = active.filter(
        (s) => ageOn(s.birthDate, asOf) === null
      ).length;
      const noLevel = active.filter((s) => !s.level).length;
      const noLocality = active.filter((s) => !s.locality).length;
      const noGender = active.filter((s) => !s.gender).length;
      const noHowFound = active.filter((s) => !s.howFound).length;
      const complete = active.filter(
        (s) =>
          ageOn(s.birthDate, asOf) !== null && s.level && s.locality && s.gender
      ).length;
      return {
        title: "Fichas de los alumnos",
        hint: "Completa = con fecha de nacimiento, nivel, localidad y género.",
        parts: [
          {
            kind: "stats",
            items: [
              {
                label: "Fichas completas",
                value: formatPct(pctOf(complete, active.length)),
              },
            ],
          },
          {
            kind: "bars",
            title: "Fichas sin…",
            rows: countBars([
              { label: "Fecha de nacimiento", count: noBirth },
              { label: "Nivel", count: noLevel },
              { label: "Localidad", count: noLocality },
              { label: "Género", count: noGender },
              { label: "Cómo nos conoció", count: noHowFound },
            ]),
          },
        ],
        empty: active.length ? undefined : "No hay alumnos.",
      };
    },
    alumnos_tabla: () => ({
      title: "Tabla de alumnos",
      hint: `Asistencia en ${phrase} y objetivos conseguidos (en total y en el periodo).`,
      parts: data.base.playerRows.length
        ? [
            {
              kind: "table",
              columns: [
                { label: "Alumno" },
                { label: "Monitor" },
                { label: "Clases", align: "right" },
                { label: "Asistencia", align: "right" },
                { label: "Objetivos", align: "right" },
              ],
              rows: data.base.playerRows.map((p) => [
                p.name,
                p.coachName,
                String(p.attended),
                formatPct(p.attendance),
                p.objectivesInPeriod
                  ? `${p.objectives} (+${p.objectivesInPeriod})`
                  : String(p.objectives),
              ]),
            },
          ]
        : [],
      empty: "Aún no hay alumnos del club.",
    }),

    // ── Grupos ──
    grupos_resumen: () => {
      const activeIds = new Set(active.map((s) => s.id));
      const sizes = data.groups.map(
        (g) => g.studentIds.filter((id) => activeIds.has(id)).length
      );
      const inGroup = new Set(
        data.groups.flatMap((g) =>
          g.studentIds.filter((id) => activeIds.has(id))
        )
      );
      return {
        title: "Grupos",
        parts: [
          {
            kind: "stats",
            items: [
              { label: "Grupos", value: String(data.groups.length) },
              {
                label: "Tamaño medio",
                value: sizes.length
                  ? formatNumber(round2(average(sizes)!))
                  : "—",
              },
              { label: "Alumnos en algún grupo", value: String(inGroup.size) },
              {
                label: "Alumnos sin grupo",
                value: String(active.length - inGroup.size),
              },
            ],
          },
        ],
      };
    },
    grupos_tamano: () => {
      const activeIds = new Set(active.map((s) => s.id));
      const rows = data.groups
        .map((g) => ({
          label: g.name,
          count: g.studentIds.filter((id) => activeIds.has(id)).length,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      return {
        title: "Alumnos por grupo",
        parts: rows.length ? [{ kind: "bars", rows: countBars(rows, 20) }] : [],
        empty: "Todavía no hay grupos.",
      };
    },
    grupos_actividad: () => {
      const rows = data.groups
        .map((g) => {
          const ss = data.sessions.filter((s) => s.groupId === g.id);
          const ids = new Set(ss.map((s) => s.id));
          const att = data.attendance.filter((a) => ids.has(a.sessionId));
          const m = att.filter((a) => a.attended !== null).length;
          const p = att.filter((a) => a.attended).length;
          return {
            name: g.name,
            sessions: ss.length,
            minutes: ss.reduce((a, s) => a + s.minutes, 0),
            attendance: pctOf(p, m),
          };
        })
        .filter((r) => r.sessions > 0)
        .sort(
          (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name)
        );
      const noGroup = data.sessions.filter((s) => !s.groupId).length;
      return {
        title: "Actividad por grupo",
        hint: `Sesiones impartidas en ${phrase}.`,
        parts: rows.length
          ? [
              {
                kind: "table",
                columns: [
                  { label: "Grupo" },
                  { label: "Sesiones", align: "right" },
                  { label: "Horas", align: "right" },
                  { label: "Asistencia", align: "right" },
                ],
                rows: rows.map((r) => [
                  r.name,
                  String(r.sessions),
                  formatHours(r.minutes),
                  formatPct(r.attendance),
                ]),
              },
              ...(noGroup
                ? [
                    {
                      kind: "note" as const,
                      text: `${plural(noGroup, "sesión", "sesiones")} sin grupo (alumnos sueltos o particulares).`,
                    },
                  ]
                : []),
            ]
          : [],
        empty: "Ninguna sesión del periodo tiene grupo.",
      };
    },

    // ── Monitores ──
    monitores_resumen: () => ({
      title: "Monitores",
      parts: [
        {
          kind: "stats",
          items: [
            { label: "Monitores", value: String(data.base.coaches) },
            {
              label: "Invitaciones pendientes",
              value: String(data.base.pendingInvites),
            },
            {
              label: "Con clases en el periodo",
              value: String(new Set(data.sessions.map((s) => s.coachId)).size),
            },
          ],
        },
      ],
    }),
    monitores_actividad: () => ({
      title: "Actividad por monitor",
      hint: `Clases y horas en pista en ${phrase}.`,
      parts: data.base.coachRows.length
        ? [
            {
              kind: "table",
              columns: [
                { label: "Monitor" },
                { label: "Alumnos", align: "right" },
                { label: "Clases", align: "right" },
                { label: "Horas en pista", align: "right" },
                { label: "Asistencia", align: "right" },
                { label: "Próximas", align: "right" },
                { label: "Última sesión", align: "right" },
              ],
              rows: data.base.coachRows.map((c) => [
                c.isOwner ? `${c.name} (gestor)` : c.name,
                String(c.players),
                String(c.sessions),
                formatHours(c.minutes),
                formatPct(c.attendance),
                String(c.upcoming),
                c.lastSession ? fmtDate(c.lastSession.slice(0, 10)) : "—",
              ]),
            },
            {
              kind: "bars",
              title: "Horas en pista",
              rows: data.base.coachRows
                .filter((c) => c.minutes > 0)
                .sort((a, b) => b.minutes - a.minutes)
                .map((c) => ({
                  label: c.name,
                  value: c.minutes,
                  display: `${formatHours(c.minutes)} h`,
                })),
            },
          ]
        : [],
      empty: "Aún no hay monitores en el club.",
    }),
    monitores_valoracion: () => {
      const rows = [...coachIds.entries()]
        .map(([id, name]) => {
          const rated = data.sessions.filter(
            (s) => s.coachId === id && s.rating !== null
          );
          return {
            name,
            count: rated.length,
            avg: average(rated.map((s) => s.rating!)),
          };
        })
        .filter((r) => r.count > 0)
        .sort((a, b) => b.avg! - a.avg! || a.name.localeCompare(b.name));
      return {
        title: "Valoración media por monitor",
        hint: "Valoración que da el monitor a cada sesión al cerrarla (1 a 5).",
        parts: rows.length
          ? [
              {
                kind: "bars",
                rows: rows.map((r) => ({
                  label: r.name,
                  value: r.avg!,
                  display: `${formatNumber(round2(r.avg!))} / 5 (${r.count})`,
                })),
              },
            ]
          : [],
        empty: "No hay sesiones valoradas en el periodo.",
      };
    },
    monitores_ejercicios: () => {
      const rows = [...coachIds.entries()]
        .map(([id, name]) => {
          const uses = data.exerciseUses.filter(
            (u) => sessionById.get(u.sessionId)?.coachId === id
          );
          return {
            name,
            uses: uses.length,
            distinct: new Set(uses.map((u) => u.exerciseId)).size,
          };
        })
        .filter((r) => r.uses > 0)
        .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
      return {
        title: "Ejercicios usados por monitor",
        hint: "Veces que aparece un ejercicio de biblioteca en sus sesiones impartidas.",
        parts: rows.length
          ? [
              {
                kind: "table",
                columns: [
                  { label: "Monitor" },
                  { label: "Usos", align: "right" },
                  { label: "Ejercicios distintos", align: "right" },
                ],
                rows: rows.map((r) => [
                  r.name,
                  String(r.uses),
                  String(r.distinct),
                ]),
              },
            ]
          : [],
        empty: "No hay ejercicios de biblioteca en las sesiones del periodo.",
      };
    },
    monitores_cambios: () => {
      const rows = [...coachIds.entries()]
        .map(([id, name]) => ({
          name,
          cancelled: data.cancelled.filter((c) => c.coachId === id).length,
          modified: data.sessions.filter(
            (s) => s.coachId === id && s.planFollowed === false
          ).length,
          sessions: data.sessions.filter((s) => s.coachId === id).length,
        }))
        .filter((r) => r.cancelled + r.modified > 0)
        .sort((a, b) => b.cancelled + b.modified - (a.cancelled + a.modified));
      return {
        title: "Canceladas y modificadas por monitor",
        parts: rows.length
          ? [
              {
                kind: "table",
                columns: [
                  { label: "Monitor" },
                  { label: "Impartidas", align: "right" },
                  { label: "Canceladas", align: "right" },
                  { label: "Modificadas", align: "right" },
                ],
                rows: rows.map((r) => [
                  r.name,
                  String(r.sessions),
                  String(r.cancelled),
                  String(r.modified),
                ]),
              },
            ]
          : [],
        empty: "Ninguna sesión cancelada ni modificada en el periodo.",
      };
    },

    // ── Sesiones ──
    sesiones_resumen: () => {
      const minutes = data.sessions.reduce((a, s) => a + s.minutes, 0);
      const avg = average(data.sessions.map((s) => s.minutes));
      return {
        title: "Sesiones",
        hint: `Sesiones impartidas en ${phrase}.`,
        parts: [
          {
            kind: "stats",
            items: [
              { label: "Impartidas", value: String(data.sessions.length) },
              { label: "Horas de clase", value: formatHours(minutes) },
              {
                label: "Duración media",
                value: avg === null ? "—" : `${formatNumber(round2(avg))} min`,
              },
              {
                label: "Por semana",
                value: formatNumber(round2(data.sessions.length / weeks)),
              },
              { label: "Canceladas", value: String(data.cancelled.length) },
              {
                label: "Próximas (30 días)",
                value: String(data.base.upcoming),
              },
            ],
          },
        ],
      };
    },
    sesiones_dia: () => ({
      title: "Clases por día de la semana",
      parts: data.sessions.length
        ? [
            {
              kind: "bars",
              rows: shareBars(
                WEEKDAY_NAMES.map((label, i) => ({
                  label,
                  count: data.sessions.filter((s) => s.isoDow === i + 1).length,
                })),
                7
              ),
            },
          ]
        : [],
      empty: "No hay sesiones impartidas en el periodo.",
    }),
    sesiones_franja: () => ({
      title: "Clases por franja horaria",
      hint: "Hora de inicio de la sesión.",
      parts: data.sessions.length
        ? [
            {
              kind: "bars",
              rows: shareBars(
                HOUR_BANDS.map((b) => ({
                  label: b.label,
                  count: data.sessions.filter(
                    (s) => s.hour >= b.from && s.hour <= b.to
                  ).length,
                })).filter((b) => b.count > 0),
                10
              ),
            },
          ]
        : [],
      empty: "No hay sesiones impartidas en el periodo.",
    }),
    sesiones_mes: () => {
      const months = tally(data.sessions, (s) => s.month).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      return {
        title: "Clases por mes",
        parts: months.length
          ? [
              {
                kind: "bars",
                rows: months.map((m) => ({
                  label: MONTH_FMT.format(new Date(`${m.label}-15T12:00:00Z`)),
                  value: m.count,
                  display: String(m.count),
                })),
              },
            ]
          : [],
        empty: "No hay sesiones impartidas en el periodo.",
      };
    },
    sesiones_lugar: () => ({
      title: "Clases por pista o lugar",
      parts: data.sessions.length
        ? [
            {
              kind: "bars",
              rows: shareBars(
                tally(data.sessions, (s) => s.place ?? "Sin lugar")
              ),
            },
          ]
        : [],
      empty: "No hay sesiones impartidas en el periodo.",
    }),
    sesiones_alumnos: () => {
      const perSession = new Map<string, number>();
      for (const a of data.attendance)
        if (a.attended !== false)
          perSession.set(a.sessionId, (perSession.get(a.sessionId) ?? 0) + 1);
      const counts = [...perSession.values()];
      const avg = average(counts);
      return {
        title: "Alumnos por sesión",
        hint: "Alumnos en la lista de cada sesión, sin contar los que faltaron.",
        parts: counts.length
          ? [
              {
                kind: "stats",
                items: [
                  { label: "Media", value: formatNumber(round2(avg!)) },
                  {
                    label: "Mediana",
                    value: formatNumber(round2(median(counts)!)),
                  },
                  { label: "Máximo", value: String(Math.max(...counts)) },
                  {
                    label: "Sesiones sin alumnos en la lista",
                    value: String(data.sessions.length - counts.length),
                  },
                ],
              },
            ]
          : [],
        empty: "Las sesiones del periodo no tienen alumnos en la lista.",
      };
    },
    sesiones_fases: () => ({
      title: "Tiempo por fase de la clase",
      hint: "Reparto del tiempo planificado de las sesiones impartidas.",
      parts: data.training.phases.some((p) => p.minutes > 0)
        ? [
            {
              kind: "bars",
              rows: data.training.phases.map((p) => ({
                label: PHASE_LABELS[p.key],
                value: p.pct,
                display: `${formatPct(round2(p.pct))} · ${formatHours(p.minutes)} h`,
              })),
            },
          ]
        : [],
      empty: "Las sesiones del periodo no tienen plan por bloques.",
    }),
    sesiones_intensidad: () => {
      const values = data.sessions
        .map((s) => s.intensity)
        .filter((v): v is number => v !== null);
      return {
        title: "Intensidad",
        hint: "Intensidad indicada en la sesión (1 a 5).",
        parts: values.length
          ? [
              {
                kind: "stats",
                items: [
                  {
                    label: "Intensidad media",
                    value: `${formatNumber(round2(average(values)!))} / 5`,
                  },
                  {
                    label: "Sesiones con intensidad",
                    value: String(values.length),
                  },
                ],
              },
              {
                kind: "bars",
                rows: shareBars(
                  [1, 2, 3, 4, 5].map((v) => ({
                    label: `Intensidad ${v}`,
                    count: values.filter((x) => x === v).length,
                  })),
                  5
                ),
              },
            ]
          : [],
        empty: "Ninguna sesión del periodo tiene intensidad indicada.",
      };
    },
    sesiones_valoracion: () => {
      const values = data.sessions
        .map((s) => s.rating)
        .filter((v): v is number => v !== null);
      return {
        title: "Valoración de las sesiones",
        hint: `${values.length} de ${data.sessions.length} sesiones valoradas por el monitor.`,
        parts: values.length
          ? [
              {
                kind: "stats",
                items: [
                  {
                    label: "Valoración media",
                    value: `${formatNumber(round2(average(values)!))} / 5`,
                  },
                ],
              },
              {
                kind: "bars",
                rows: shareBars(
                  [5, 4, 3, 2, 1].map((v) => ({
                    label: `${v} ${v === 1 ? "estrella" : "estrellas"}`,
                    count: values.filter((x) => x === v).length,
                  })),
                  5
                ),
              },
            ]
          : [],
        empty: "No hay sesiones valoradas en el periodo.",
      };
    },
    sesiones_canceladas: () => ({
      title: "Sesiones canceladas",
      hint: `Sesiones del club canceladas en ${phrase}.`,
      parts: data.cancelled.length
        ? [
            {
              kind: "stats",
              items: [
                { label: "Canceladas", value: String(data.cancelled.length) },
                {
                  label: "Sobre las programadas",
                  value: formatPct(
                    pctOf(
                      data.cancelled.length,
                      data.cancelled.length + data.sessions.length
                    )
                  ),
                },
              ],
            },
            {
              kind: "bars",
              title: "Motivos",
              rows: shareBars(
                countReasons(
                  data.cancelled.map((c) => c.note),
                  "Sin motivo indicado"
                )
              ),
            },
          ]
        : [],
      empty: "No hay sesiones canceladas en el periodo.",
    }),
    sesiones_modificadas: () => {
      const answered = data.sessions.filter((s) => s.planFollowed !== null);
      const modified = answered.filter((s) => s.planFollowed === false);
      return {
        title: "Sesiones modificadas",
        hint: "Sesiones que no se dieron tal y como estaban planificadas.",
        parts: answered.length
          ? [
              {
                kind: "stats",
                items: [
                  { label: "Modificadas", value: String(modified.length) },
                  {
                    label: "Sobre las respondidas",
                    value: formatPct(pctOf(modified.length, answered.length)),
                  },
                  { label: "Con respuesta", value: String(answered.length) },
                ],
              },
              ...(modified.length
                ? [
                    {
                      kind: "bars" as const,
                      title: "Motivos",
                      rows: shareBars(
                        countReasons(
                          modified.map((s) =>
                            planChangeReasonLabel(s.planChangeReason)
                          ),
                          "Sin motivo indicado"
                        )
                      ),
                    },
                  ]
                : []),
            ]
          : [],
        empty:
          "Ningún monitor ha respondido si la sesión se dio como estaba planificada.",
      };
    },

    // ── Ejercicios ──
    ejercicios_resumen: () => {
      const distinct = new Set(data.exerciseUses.map((u) => u.exerciseId)).size;
      return {
        title: "Ejercicios",
        hint: `Ejercicios de biblioteca en las sesiones impartidas en ${phrase}.`,
        parts: [
          {
            kind: "stats",
            items: [
              { label: "Usos", value: String(data.exerciseUses.length) },
              { label: "Ejercicios distintos", value: String(distinct) },
              {
                label: "Por sesión",
                value: data.sessions.length
                  ? formatNumber(
                      round2(data.exerciseUses.length / data.sessions.length)
                    )
                  : "—",
              },
              {
                label: "Creados en el club",
                value: String(data.exercisesCreated),
              },
            ],
          },
        ],
      };
    },
    ejercicios_top: () => {
      const rows = tally(data.exerciseUses, (u) => u.name);
      return {
        title: "Ejercicios más repetidos",
        parts: rows.length ? [{ kind: "bars", rows: countBars(rows, 10) }] : [],
        empty: "No hay ejercicios de biblioteca en las sesiones del periodo.",
      };
    },
    ejercicios_valorados: () => {
      const byId = new Map<string, { name: string; values: number[] }>();
      for (const r of data.exerciseRatings) {
        const e = byId.get(r.exerciseId) ?? { name: r.name, values: [] };
        e.values.push(r.rating);
        byId.set(r.exerciseId, e);
      }
      const rated = [...byId.values()].map((e) => ({
        name: e.name,
        average: round2(average(e.values)!),
        count: e.values.length,
      }));
      const { best, worst } = splitRatedExercises(rated);
      const toRows = (list: RatedExercise[]) =>
        list.map((e) => ({
          label: e.name,
          value: e.average,
          display: `${formatNumber(e.average)} / 5 (${e.count})`,
        }));
      return {
        title: "Ejercicios mejor y peor valorados",
        hint: "Valoración del monitor a cada ejercicio al dar la sesión (1 a 5).",
        parts: rated.length
          ? [
              { kind: "bars", title: "Mejor valorados", rows: toRows(best) },
              ...(worst.length
                ? [
                    {
                      kind: "bars" as const,
                      title: "Peor valorados",
                      rows: toRows(worst),
                    },
                  ]
                : []),
            ]
          : [],
        empty: "No hay ejercicios valorados en el periodo.",
      };
    },
    ejercicios_aspectos: () => ({
      title: "Aspectos del juego",
      hint: "Porcentaje del tiempo de las sesiones por aspecto.",
      parts: data.training.aspects.some((a) => a.minutes > 0)
        ? [
            {
              kind: "bars",
              rows: data.training.aspects.map((a) => ({
                label: ASPECT_LABELS[a.key],
                value: a.pct,
                display: formatPct(round2(a.pct)),
              })),
            },
          ]
        : [],
      empty: "No hay tiempo clasificado por aspectos.",
    }),
    ejercicios_tipos: () => ({
      title: "Tipos de actividad",
      hint: "Porcentaje del tiempo por tipo de ejercicio.",
      parts: data.training.types.length
        ? [
            {
              kind: "bars",
              rows: data.training.types.map((t) => ({
                label: typeLabel(t.key),
                value: t.pct,
                display: formatPct(round2(t.pct)),
              })),
            },
          ]
        : [],
      empty: "Los ejercicios del periodo no tienen tipo de actividad.",
    }),
    ejercicios_golpes: () => ({
      title: "Golpes trabajados",
      hint: "Porcentaje del tiempo de golpeo por golpe.",
      parts: data.training.strokes.length
        ? [
            {
              kind: "bars",
              rows: data.training.strokes.map((t) => ({
                label: STROKE_LABEL[t.key] ?? t.key,
                value: t.pct,
                display: formatPct(round2(t.pct)),
              })),
            },
          ]
        : [],
      empty: "Los ejercicios del periodo no tienen golpes indicados.",
    }),

    // ── Clases ──
    clases_resumen: () => {
      const fromClass = data.sessions.filter((s) => s.sourceClassId).length;
      return {
        title: "Clases",
        hint: "Clases publicadas del club y sesiones creadas a partir de una clase.",
        parts: [
          {
            kind: "stats",
            items: [
              { label: "Clases del club", value: String(data.classes.length) },
              {
                label: "Creadas en el periodo",
                value: String(
                  data.classes.filter((c) => c.createdInPeriod).length
                ),
              },
              { label: "Sesiones desde una clase", value: String(fromClass) },
              {
                label: "Sobre las impartidas",
                value: formatPct(pctOf(fromClass, data.sessions.length)),
              },
            ],
          },
        ],
      };
    },
    clases_usadas: () => {
      const rows = tally(
        data.sessions.filter((s) => s.sourceClassId),
        (s) => data.classNames.get(s.sourceClassId!) ?? "Clase"
      );
      return {
        title: "Clases más usadas",
        hint: "Sesiones impartidas a partir de cada clase (del club o de la Biblioteca).",
        parts: rows.length ? [{ kind: "bars", rows: countBars(rows, 10) }] : [],
        empty: "Ninguna sesión del periodo sale de una clase.",
      };
    },
    clases_nivel: () => {
      const rows = tally(
        data.classes.flatMap((c) =>
          c.niveles.length ? c.niveles : ["sin_nivel"]
        ),
        (id) => (id === "sin_nivel" ? "Sin nivel" : nivelLabel(id))
      );
      return {
        title: "Clases por nivel",
        hint: "Una clase con varios niveles cuenta en cada uno.",
        parts: data.classes.length
          ? [{ kind: "bars", rows: countBars(rows, 20) }]
          : [],
        empty: "El club no tiene clases publicadas.",
      };
    },
    clases_aspecto: () => {
      const rows = tally(
        data.classes.flatMap((c) => (c.aspectos.length ? c.aspectos : ["sin"])),
        (id) =>
          id === "sin"
            ? "Sin aspecto"
            : ((ASPECT_LABELS as Record<string, string>)[id] ?? id)
      );
      return {
        title: "Clases por aspecto",
        hint: "Una clase con varios aspectos cuenta en cada uno.",
        parts: data.classes.length
          ? [{ kind: "bars", rows: countBars(rows) }]
          : [],
        empty: "El club no tiene clases publicadas.",
      };
    },

    // ── Pistas ──
    pistas_reservas: () => {
      const ok = data.bookings.filter((b) => !b.cancelled);
      const minutesByPlace = new Map<string, number>();
      for (const b of ok)
        minutesByPlace.set(
          b.place,
          (minutesByPlace.get(b.place) ?? 0) + b.minutes
        );
      return {
        title: "Reservas de pistas",
        hint: `Reservas con inicio en ${phrase}.`,
        parts: data.bookings.length
          ? [
              {
                kind: "stats",
                items: [
                  { label: "Reservas", value: String(ok.length) },
                  {
                    label: "Horas reservadas",
                    value: formatHours(ok.reduce((a, b) => a + b.minutes, 0)),
                  },
                  {
                    label: "Desde el enlace público",
                    value: String(ok.filter((b) => b.kind === "public").length),
                  },
                  {
                    label: "Del club",
                    value: String(ok.filter((b) => b.kind === "club").length),
                  },
                  {
                    label: "Canceladas",
                    value: String(data.bookings.length - ok.length),
                  },
                ],
              },
              {
                kind: "bars",
                title: "Horas por pista",
                rows: [...minutesByPlace.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, minutes]) => ({
                    label,
                    value: minutes,
                    display: `${formatHours(minutes)} h`,
                  })),
              },
            ]
          : [],
        empty: "No hay reservas de pistas en el periodo.",
      };
    },
  };

  const out = new Map<ReportMetricId, MetricView>();
  for (const id of metrics) out.set(id, builders[id]());
  return out;
}
