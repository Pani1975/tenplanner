import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  ACCENT,
  AMBER,
  BORDER,
  BRAND,
  BRAND_DARK,
  BRAND_LIGHT,
  BRAND_MUTED,
  CHART_COLORS,
  Donut,
  GRAY,
  HBars,
  SectionHeading,
  StatTile,
  VIOLET,
  Watermark,
} from "@/lib/pdf/brand";
import { GROUP_LEVEL_LABEL, type GroupReport } from "@/lib/groups/report";
import {
  ASPECT_COLOR,
  ASPECT_LABEL,
  PHASE_COLOR,
  PHASE_LABEL,
  STROKE_LABEL,
  formatHours,
  typeLabel,
} from "@/lib/stats/labels";
import type { StudentHours } from "@/lib/stats/load-training-stats";
import type { TrainingStats } from "@/lib/stats/training-stats";

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Madrid",
});
const dateTimeFormat = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const styles = StyleSheet.create({
  page: {
    padding: 44,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: BRAND_DARK,
    borderBottomWidth: 4,
    borderBottomColor: ACCENT,
  },
  brandLabel: {
    fontSize: 8,
    color: ACCENT,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  subtitle: { fontSize: 9.5, color: BRAND_MUTED, marginTop: 4 },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  card: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BRAND_DARK,
    color: "#FFFFFF",
    padding: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    fontSize: 9,
  },
  zebra: { backgroundColor: "#F8FAFC" },
  colWide: { flexGrow: 3, flexBasis: 0 },
  colNum: { flexGrow: 1, flexBasis: 0, textAlign: "right" },
  muted: { fontSize: 9, color: GRAY },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rank: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BRAND_LIGHT,
    color: BRAND,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    paddingTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
});

function pct(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function rating(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} / 5`;
}

function shareRows<T extends { key: string; minutes: number; pct: number }>(
  shares: T[],
  label: (key: string) => string,
  colors: (key: string, i: number) => string,
  max = 8
) {
  return shares.slice(0, max).map((s, i) => ({
    label: label(s.key),
    pct: s.pct,
    value: `${Math.round(s.pct)} %`,
    color: colors(s.key, i),
  }));
}

export function GroupReportPdf({
  groupName,
  coachName,
  generatedAt,
  report,
  training,
  studentHours = [],
}: {
  groupName: string;
  coachName: string;
  generatedAt: Date;
  report: GroupReport;
  training?: TrainingStats;
  studentHours?: StudentHours[];
}) {
  const hasPlan = !!training && training.sessionCount > 0;
  const topExercise = training?.topExercises[0];
  const hoursByStudent = new Map(studentHours.map((h) => [h.id, h]));

  return (
    <Document
      title={`Informe ${groupName}`}
      author={coachName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <Page size="A4" style={styles.page}>
        <Watermark />

        <View style={styles.header}>
          <Text style={styles.brandLabel}>TenPlanner · Informe de grupo</Text>
          <Text style={styles.title}>{groupName}</Text>
          <Text style={styles.subtitle}>
            Entrenador: {coachName} · Generado el {dateFormat.format(generatedAt)}
          </Text>
        </View>

        <View style={styles.row}>
          <StatTile
            label="Impartidas"
            value={String(report.taught)}
            hint={`${report.hoursTaught} h en total`}
            color={BRAND}
          />
          <StatTile
            label="Por impartir"
            value={String(report.upcoming)}
            hint={
              report.nextAt
                ? `Siguiente: ${dateFormat.format(report.nextAt)}`
                : "Ninguna programada"
            }
            color={ACCENT}
          />
          <StatTile
            label="Asistencia"
            value={pct(report.attendanceRate)}
            hint={
              report.unrecordedTaught > 0
                ? `${report.unrecordedTaught} sin registrar`
                : "Todas registradas"
            }
            color={VIOLET}
          />
        </View>
        <View style={styles.row}>
          <StatTile
            label="Valoración media"
            value={rating(report.avgRating)}
            hint={`${report.ratingsCount} valoraciones`}
            color={AMBER}
          />
          <StatTile
            label="Intensidad media"
            value={
              report.avgIntensity === null ? "—" : `${report.avgIntensity} / 5`
            }
            hint={
              report.lastTaughtAt
                ? `Última: ${dateFormat.format(report.lastTaughtAt)}`
                : "Sin sesiones impartidas"
            }
            color="#EC4899"
          />
          <StatTile
            label="Ejercicio más realizado"
            value={topExercise ? topExercise.name : "—"}
            hint={
              topExercise
                ? `${topExercise.times} veces · ${formatHours(topExercise.minutes)}`
                : "Sin datos de plan"
            }
            color={BRAND_DARK}
          />
        </View>

        <SectionHeading>Qué se ha trabajado</SectionHeading>
        {!hasPlan || !training ? (
          <Text style={styles.muted}>
            Todavía no hay sesiones pasadas con plan de ejercicios para calcular
            la estadística.
          </Text>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Tiempo por fase</Text>
                <Donut
                  size={84}
                  centerLabel={formatHours(
                    training.phases.reduce((a, p) => a + p.minutes, 0)
                  )}
                  slices={training.phases.map((p) => ({
                    label: PHASE_LABEL[p.key],
                    value: p.minutes,
                    color: PHASE_COLOR[p.key],
                  }))}
                />
              </View>
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Aspectos del juego</Text>
                {training.aspects.length === 0 ? (
                  <Text style={styles.muted}>Sin ejercicios clasificados.</Text>
                ) : (
                  <Donut
                    size={84}
                    slices={training.aspects.map((a) => ({
                      label: ASPECT_LABEL[a.key],
                      value: a.minutes,
                      color: ASPECT_COLOR[a.key],
                    }))}
                  />
                )}
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Golpes trabajados</Text>
                {training.strokes.length === 0 ? (
                  <Text style={styles.muted}>Sin golpes registrados.</Text>
                ) : (
                  <HBars
                    rows={shareRows(
                      training.strokes,
                      (k) => STROKE_LABEL[k] ?? k,
                      (_k, i) => CHART_COLORS[i % CHART_COLORS.length]
                    )}
                  />
                )}
              </View>
              <View style={styles.card} wrap={false}>
                <Text style={styles.cardTitle}>Tipo de juego realizado</Text>
                {training.types.length === 0 ? (
                  <Text style={styles.muted}>Sin tipos registrados.</Text>
                ) : (
                  <HBars
                    rows={shareRows(
                      training.types,
                      typeLabel,
                      (_k, i) => CHART_COLORS[(i + 2) % CHART_COLORS.length]
                    )}
                  />
                )}
              </View>
            </View>
            {training.topExercises.length > 0 && (
              <View
                style={[
                  styles.card,
                  { flexGrow: 0, flexBasis: "auto", marginBottom: 8 },
                ]}
                wrap={false}
              >
                <Text style={styles.cardTitle}>Ejercicios más repetidos</Text>
                {training.topExercises.map((e, i) => (
                  <View key={e.key} style={styles.topRow}>
                    <Text style={styles.rank}>{i + 1}</Text>
                    <Text style={{ flexGrow: 1, flexBasis: 0, fontSize: 9.5 }}>
                      {e.name}
                    </Text>
                    <Text style={styles.muted}>
                      {e.times} {e.times === 1 ? "vez" : "veces"} ·{" "}
                      {formatHours(e.minutes)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <SectionHeading color={ACCENT}>Sesiones impartidas</SectionHeading>
        {report.taughtSessions.length === 0 ? (
          <Text style={styles.muted}>Aún no se ha impartido ninguna sesión.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={{ width: 70 }}>Fecha</Text>
              <Text style={styles.colWide}>Sesión</Text>
              <Text style={styles.colNum}>Min.</Text>
              <Text style={styles.colNum}>Asistieron</Text>
              <Text style={styles.colNum}>Valoración</Text>
            </View>
            {report.taughtSessions.slice(0, 20).map((s, i) => (
              <View
                key={s.id}
                style={[styles.tableRow, i % 2 ? styles.zebra : {}]}
                wrap={false}
              >
                <Text style={{ width: 70 }}>{dateFormat.format(s.scheduledAt)}</Text>
                <Text style={styles.colWide}>{s.title}</Text>
                <Text style={styles.colNum}>{s.durationMinutes}</Text>
                <Text style={styles.colNum}>
                  {s.attended === null ? "—" : `${s.attended}/${s.recorded}`}
                </Text>
                <Text style={styles.colNum}>{rating(s.avgRating)}</Text>
              </View>
            ))}
            {report.taughtSessions.length > 20 && (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                Se muestran las 20 más recientes de {report.taughtSessions.length}.
              </Text>
            )}
          </View>
        )}

        <SectionHeading color={VIOLET}>Próximas sesiones</SectionHeading>
        {report.upcomingSessions.length === 0 ? (
          <Text style={styles.muted}>No hay sesiones programadas para este grupo.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={{ width: 110 }}>Cuándo</Text>
              <Text style={styles.colWide}>Sesión</Text>
              <Text style={styles.colNum}>Min.</Text>
            </View>
            {report.upcomingSessions.slice(0, 15).map((s, i) => (
              <View
                key={s.id}
                style={[styles.tableRow, i % 2 ? styles.zebra : {}]}
                wrap={false}
              >
                <Text style={{ width: 110 }}>
                  {dateTimeFormat.format(s.scheduledAt)}
                </Text>
                <Text style={styles.colWide}>{s.title}</Text>
                <Text style={styles.colNum}>{s.durationMinutes}</Text>
              </View>
            ))}
            {report.upcomingSessions.length > 15 && (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                Y {report.upcomingSessions.length - 15} más programadas.
              </Text>
            )}
          </View>
        )}

        <SectionHeading color={BRAND}>Alumnos</SectionHeading>
        {report.students.length === 0 ? (
          <Text style={styles.muted}>Este grupo no tiene alumnos todavía.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={styles.colWide}>Alumno</Text>
              <Text style={styles.colNum}>Asistencias</Text>
              <Text style={styles.colNum}>Asistencia</Text>
              <Text style={styles.colNum}>Horas</Text>
              <Text style={styles.colNum}>Valoración</Text>
            </View>
            {report.students.map((s, i) => (
              <View
                key={s.id}
                style={[styles.tableRow, i % 2 ? styles.zebra : {}]}
                wrap={false}
              >
                <Text style={styles.colWide}>{s.name}</Text>
                <Text style={styles.colNum}>
                  {s.sessionsRecorded > 0
                    ? `${s.attended}/${s.sessionsRecorded}`
                    : "—"}
                </Text>
                <Text style={styles.colNum}>{pct(s.attendanceRate)}</Text>
                <Text style={styles.colNum}>
                  {hoursByStudent.has(s.id)
                    ? formatHours(hoursByStudent.get(s.id)!.minutes)
                    : "—"}
                </Text>
                <Text style={styles.colNum}>{rating(s.avgRating)}</Text>
              </View>
            ))}
          </View>
        )}

        {report.levels.length > 0 && (
          <>
            <SectionHeading color={AMBER}>Niveles</SectionHeading>
            <Donut
              size={84}
              centerLabel={`${report.students.length}`}
              slices={report.levels.map((l, i) => ({
                label: GROUP_LEVEL_LABEL[l.level] ?? "Sin nivel",
                value: l.count,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
            />
          </>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generado con TenPlanner · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
