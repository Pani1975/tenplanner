import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  ACCENT,
  BRAND_DARK,
  CHART_COLORS,
  Donut,
  HBars,
  SectionHeading,
  StatTile,
  VIOLET,
  Watermark,
} from "@/lib/pdf/brand";
import {
  ASPECT_COLOR,
  PHASE_COLOR,
  PHASE_LABEL,
} from "@/lib/stats/labels";
import {
  BORDER,
  BRAND,
  BRAND_LIGHT,
  GRAY,
  LIGHT_GRAY,
  styles as base,
} from "@/lib/sessions/pdf";
import { ASPECTS, BALLS, type BallId } from "@/lib/objectives-taxonomy";
import type { StatAspect } from "@/lib/stats/training-stats";
import type { StudentReport } from "./report-data";

const GREEN = "#15803D";
const RED = "#B91C1C";

const ASPECT_LABEL: Record<StatAspect, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisico: "Físico",
  mental: "Mental",
};
const STROKE_LABEL: Record<string, string> = {
  derecha: "Derecha",
  reves: "Revés",
  saque: "Saque",
  volea: "Volea",
  remate: "Remate",
  dejada: "Dejada",
  globo: "Globo",
  resto: "Resto",
};
const BALL_COLOR = Object.fromEntries(
  BALLS.map((b) => [b.id, b.color])
) as Record<BallId, string>;
const BALL_LABEL = Object.fromEntries(
  BALLS.map((b) => [b.id, b.label.toLowerCase()])
) as Record<BallId, string>;

const s = StyleSheet.create({
  chartCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 8 },
  chip: {
    backgroundColor: BRAND_LIGHT,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    fontSize: 9,
    color: "#1D4ED8",
  },
  smallLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 4,
  },
  sessionRow: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 5,
    padding: 8,
    marginBottom: 5,
    backgroundColor: "#FAFAFA",
  },
  sessionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  sessionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    flex: 1,
    lineHeight: 1.3,
  },
  sessionDate: { fontSize: 8.5, color: GRAY, marginBottom: 2 },
  tag: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sessionText: { fontSize: 9, color: "#374151", lineHeight: 1.4, marginTop: 3 },
  levelHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: LIGHT_GRAY,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  levelTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 1 },
  levelCount: { fontSize: 9, color: GRAY },
  completeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  completeText: { fontSize: 10, color: GREEN, fontFamily: "Helvetica-Bold" },
  groupTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    marginTop: 5,
    marginBottom: 2,
  },
  objRow: { flexDirection: "row", gap: 6, marginBottom: 2.5 },
  box: {
    width: 8,
    height: 8,
    borderRadius: 1.5,
    borderWidth: 1,
    marginTop: 2,
  },
  objText: { fontSize: 9, flex: 1, lineHeight: 1.35, color: "#374151" },
  newTag: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GREEN },
  notes: {
    backgroundColor: BRAND_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    borderRadius: 5,
    padding: 10,
    fontSize: 10,
    lineHeight: 1.5,
    color: "#374151",
  },
  empty: { fontSize: 9.5, color: GRAY },
});

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(d);
}
function fmtHours(minutes: number) {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)} h` : `${h.toFixed(1).replace(".", ",")} h`;
}
function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
function ageFrom(birthDate: string | null, today: Date) {
  if (!birthDate) return null;
  const d = new Date(birthDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View
      style={[
        s.box,
        checked
          ? { borderColor: GREEN, backgroundColor: GREEN }
          : { borderColor: "#9CA3AF" },
      ]}
    />
  );
}

export function StudentReportPdf({
  report,
  coachName,
}: {
  report: StudentReport;
  coachName: string;
}) {
  const { student, summary, stats, levels } = report;
  const age = ageFrom(student.birthDate, new Date());
  const hasStats = stats.sessionCount > 0;
  const strokes = stats.strokes.slice(0, 5);

  return (
    <Document
      title={`Informe de ${student.name}`}
      author={coachName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <Page size="A4" style={base.page}>
        <Watermark />
        <View style={base.header}>
          <Text style={base.brandLabel}>Informe del alumno</Text>
          <Text style={base.title}>{student.name}</Text>
          <Text style={base.subtitle}>
            Periodo: {fmtDate(report.from)} – {fmtDate(report.to)}
          </Text>
          <Text style={base.coachLine}>
            Entrenador: {coachName}
            {age != null ? ` · ${age} años` : ""}
          </Text>
        </View>

        <SectionHeading>Resumen del periodo</SectionHeading>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <StatTile label="Sesiones" value={String(summary.held)} color={BRAND} />
          <StatTile label="Asistió" value={String(summary.attended)} color={GREEN} />
          <StatTile label="Faltó" value={String(summary.absent)} color={RED} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <StatTile
            label="Horas entrenadas"
            value={fmtHours(summary.minutes)}
            color={BRAND_DARK}
          />
          <StatTile
            label="Asistencia"
            value={
              summary.attendanceRate != null
                ? `${summary.attendanceRate} %`
                : "—"
            }
            color={VIOLET}
          />
          <StatTile
            label="Objetivos nuevos"
            value={String(report.achievedInPeriod)}
            color={ACCENT}
          />
        </View>
        {summary.unrecorded > 0 && (
          <Text style={[s.empty, { marginBottom: 8 }]}>
            {summary.unrecorded} sesión
            {summary.unrecorded !== 1 ? "es" : ""} sin asistencia registrada.
          </Text>
        )}

        {hasStats && (
          <>
            <SectionHeading color={ACCENT}>Qué se ha trabajado</SectionHeading>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
              {stats.phases.length > 0 && (
                <View style={s.chartCard} wrap={false}>
                  <Text style={s.smallLabel}>Tiempo por fase</Text>
                  <Donut
                    size={78}
                    slices={stats.phases.map((p) => ({
                      label: PHASE_LABEL[p.key],
                      value: p.minutes,
                      color: PHASE_COLOR[p.key],
                    }))}
                  />
                </View>
              )}
              {stats.aspects.length > 0 && (
                <View style={s.chartCard} wrap={false}>
                  <Text style={s.smallLabel}>Aspectos del juego</Text>
                  <Donut
                    size={78}
                    slices={stats.aspects.map((a) => ({
                      label: ASPECT_LABEL[a.key],
                      value: a.minutes,
                      color: ASPECT_COLOR[a.key],
                    }))}
                  />
                </View>
              )}
            </View>
            {strokes.length > 0 && (
              <View style={s.chartCard} wrap={false}>
                <Text style={s.smallLabel}>Golpes trabajados</Text>
                <HBars
                  rows={strokes.map((a, i) => ({
                    label: STROKE_LABEL[a.key] ?? a.key,
                    pct: a.pct,
                    value: `${Math.round(a.pct)} %`,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                  }))}
                />
              </View>
            )}
            {stats.topExercises.length > 0 && (
              <>
                <Text style={s.smallLabel}>Ejercicios más repetidos</Text>
                {stats.topExercises.slice(0, 3).map((e) => (
                  <Text key={e.key} style={s.objText}>
                    {e.name} · {e.times} vez{e.times !== 1 ? "es" : ""}
                  </Text>
                ))}
              </>
            )}
          </>
        )}

        <Text style={base.sectionTitle}>Sesiones del periodo</Text>
        {report.sessions.length === 0 ? (
          <Text style={s.empty}>
            No hay sesiones realizadas en este periodo.
          </Text>
        ) : (
          report.sessions.map((row, i) => (
            <View key={i} style={s.sessionRow} wrap={false}>
              <Text style={s.sessionDate}>
                {fmtDate(row.scheduledAt)} · {row.durationMinutes} min
              </Text>
              <View style={s.sessionHead}>
                <Text style={s.sessionTitle}>{row.title}</Text>
                <Text
                  style={[
                    s.tag,
                    {
                      color:
                        row.attended === true
                          ? GREEN
                          : row.attended === false
                            ? RED
                            : GRAY,
                    },
                  ]}
                >
                  {row.attended === true
                    ? "Asistió"
                    : row.attended === false
                      ? "Faltó"
                      : "Sin registrar"}
                </Text>
              </View>
              {row.objective && (
                <Text style={s.sessionText}>
                  Objetivo: {clip(row.objective, 200)}
                </Text>
              )}
              {row.feedback && (
                <Text style={s.sessionText}>
                  Nota: {clip(row.feedback, 280)}
                </Text>
              )}
            </View>
          ))
        )}

        {levels.length > 0 && (
          <>
            <Text style={base.sectionTitle}>Objetivos por nivel</Text>
            {levels.map((level) => {
              const title = `Objetivos de Nivel ${level.stage} (bola ${BALL_LABEL[level.ball]})`;
              if (level.status === "complete") {
                return (
                  <View key={level.ball} style={s.completeRow} wrap={false}>
                    <View
                      style={[
                        s.dot,
                        { backgroundColor: BALL_COLOR[level.ball] },
                      ]}
                    />
                    <Text style={s.completeText}>{title} completados</Text>
                  </View>
                );
              }
              return (
                <View key={level.ball}>
                  <View style={s.levelHead} wrap={false}>
                    <View
                      style={[
                        s.dot,
                        { backgroundColor: BALL_COLOR[level.ball] },
                      ]}
                    />
                    <Text style={s.levelTitle}>{title}</Text>
                    <Text style={s.levelCount}>
                      {level.achieved.length} de {level.total}
                    </Text>
                  </View>
                  {(
                    [
                      ["Conseguidos", level.achieved, true],
                      ["Pendientes", level.pending, false],
                    ] as const
                  ).map(([label, list, done]) =>
                    list.length === 0 ? null : (
                      <View key={label}>
                        <Text style={s.smallLabel}>
                          {label} ({list.length})
                        </Text>
                        {ASPECTS.map((a) => {
                          const inAspect = list.filter(
                            (o) => o.aspect === a.id
                          );
                          if (inAspect.length === 0) return null;
                          return (
                            <View key={a.id}>
                              <Text style={s.groupTitle}>{a.label}</Text>
                              {inAspect.map((o) => {
                                const isNew =
                                  done &&
                                  !!o.achievedAt &&
                                  new Date(o.achievedAt) >= report.from &&
                                  new Date(o.achievedAt) <= report.to;
                                return (
                                  <View
                                    key={o.id}
                                    style={s.objRow}
                                    wrap={false}
                                  >
                                    <Checkbox checked={done} />
                                    <Text style={s.objText}>
                                      {o.title}
                                      {isNew ? "  " : ""}
                                      {isNew && (
                                        <Text style={s.newTag}>NUEVO</Text>
                                      )}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })}
                      </View>
                    )
                  )}
                </View>
              );
            })}
          </>
        )}

        {student.notes && student.notes.trim() && (
          <>
            <Text style={base.sectionTitle}>Anotaciones sobre el alumno</Text>
            <Text style={s.notes}>{student.notes.trim()}</Text>
          </>
        )}

        <Text style={base.footer} fixed>
          Generado con TenPlanner · {fmtDate(new Date())} · Entrenador:{" "}
          {coachName}
        </Text>
      </Page>
    </Document>
  );
}
