import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  BORDER,
  BRAND,
  BRAND_LIGHT,
  GRAY,
  LIGHT_GRAY,
} from "@/lib/sessions/pdf";
import { GROUP_LEVEL_LABEL, type GroupReport } from "@/lib/groups/report";

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
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
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BRAND },
  subtitle: { fontSize: 10, color: GRAY, marginTop: 4 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 8,
    color: "#111827",
  },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flexGrow: 1,
    flexBasis: 0,
    backgroundColor: BRAND_LIGHT,
    borderRadius: 4,
    padding: 10,
  },
  statLabel: { fontSize: 8, color: GRAY, textTransform: "uppercase" },
  statValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 },
  statHint: { fontSize: 8, color: GRAY, marginTop: 2 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: LIGHT_GRAY,
    padding: 6,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  colName: { flexGrow: 3, flexBasis: 0 },
  colNum: { flexGrow: 1, flexBasis: 0, textAlign: "right" },
  levelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    fontSize: 8,
    color: GRAY,
    textAlign: "center",
  },
});

function pct(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function rating(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} / 5`;
}

export function GroupReportPdf({
  groupName,
  coachName,
  generatedAt,
  report,
}: {
  groupName: string;
  coachName: string;
  generatedAt: Date;
  report: GroupReport;
}) {
  return (
    <Document
      title={`Informe ${groupName}`}
      author={coachName}
      creator="TenPlanner"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Informe de {groupName}</Text>
        <Text style={styles.subtitle}>
          {coachName} · Generado el {dateFormat.format(generatedAt)}
        </Text>

        <Text style={styles.sectionTitle}>Resumen</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Impartidas</Text>
            <Text style={styles.statValue}>{report.taught}</Text>
            <Text style={styles.statHint}>{report.hoursTaught} h en total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Asistencia</Text>
            <Text style={styles.statValue}>{pct(report.attendanceRate)}</Text>
            <Text style={styles.statHint}>
              {report.unrecordedTaught > 0
                ? `${report.unrecordedTaught} sin registrar`
                : "Todas registradas"}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Valoración media</Text>
            <Text style={styles.statValue}>{rating(report.avgRating)}</Text>
            <Text style={styles.statHint}>
              {report.ratingsCount} valoraciones
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Intensidad media</Text>
            <Text style={styles.statValue}>
              {report.avgIntensity === null
                ? "—"
                : `${report.avgIntensity} / 5`}
            </Text>
            <Text style={styles.statHint}>
              {report.lastTaughtAt
                ? `Última: ${dateFormat.format(report.lastTaughtAt)}`
                : "Sin sesiones impartidas"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Alumnos</Text>
        {report.students.length === 0 ? (
          <Text>Este grupo no tiene alumnos todavía.</Text>
        ) : (
          <View>
            <View style={styles.tableHeader}>
              <Text style={styles.colName}>Alumno</Text>
              <Text style={styles.colNum}>Asistencias</Text>
              <Text style={styles.colNum}>Asistencia</Text>
              <Text style={styles.colNum}>Valoración</Text>
            </View>
            {report.students.map((s) => (
              <View key={s.id} style={styles.tableRow} wrap={false}>
                <Text style={styles.colName}>{s.name}</Text>
                <Text style={styles.colNum}>
                  {s.sessionsRecorded > 0
                    ? `${s.attended}/${s.sessionsRecorded}`
                    : "—"}
                </Text>
                <Text style={styles.colNum}>{pct(s.attendanceRate)}</Text>
                <Text style={styles.colNum}>{rating(s.avgRating)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Niveles</Text>
        {report.levels.length === 0 ? (
          <Text>Sin alumnos.</Text>
        ) : (
          report.levels.map((l) => (
            <View key={l.level} style={styles.levelRow}>
              <Text>{GROUP_LEVEL_LABEL[l.level] ?? "Sin nivel"}</Text>
              <Text>{l.count}</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Próximas sesiones</Text>
        <Text>
          {report.upcoming} programada{report.upcoming !== 1 ? "s" : ""}
          {report.nextAt &&
            ` · la siguiente el ${dateFormat.format(report.nextAt)}`}
        </Text>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `TenPlanner · ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
