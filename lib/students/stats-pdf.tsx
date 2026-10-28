import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  ACCENT,
  AMBER,
  BORDER,
  BRAND,
  BRAND_DARK,
  BRAND_MUTED,
  HBars,
  SectionHeading,
  StatTile,
  VIOLET,
  Watermark,
  type BarRow,
} from "@/lib/pdf/brand";
import { studentsLabel, type StudentsStats } from "@/lib/students/stats";

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
  muted: { fontSize: 9, color: "#6B7280" },
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

/** Las etiquetas de las barras miden una sola línea: se recortan las largas. */
function shorten(label: string, max = 15) {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

function barRows(
  items: { label: string; count: number; color?: string }[],
  color: string
): BarRow[] {
  const max = Math.max(...items.map((i) => i.count), 1);
  return items.map((i) => ({
    label: shorten(i.label),
    pct: (i.count / max) * 100,
    value: String(i.count),
    color: i.color ?? color,
  }));
}

/**
 * Informe estadístico de la cartera de alumnos. El mapa de procedencia no
 * cabe en un PDF sin imagen de mapa, así que se resume como ranking de
 * localidades.
 */
export function StudentsStatsPdf({
  scopeLabel,
  coachName,
  generatedAt,
  stats,
}: {
  scopeLabel: string;
  coachName: string;
  generatedAt: Date;
  stats: StudentsStats;
}) {
  const levels = stats.levels.filter((l) => l.count > 0);
  const ages = stats.ageBands.filter((b) => b.count > 0);
  const groups = stats.groupSizes.slice(0, 10);
  const origins = stats.origins.slice(0, 12);

  return (
    <Document
      title={`Informe de alumnos · ${scopeLabel}`}
      author={coachName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <Page size="A4" style={styles.page}>
        <Watermark />

        <View style={styles.header}>
          <Text style={styles.brandLabel}>TenPlanner · Informe de alumnos</Text>
          <Text style={styles.title}>{scopeLabel}</Text>
          <Text style={styles.subtitle}>
            Generado por {coachName} el {dateFormat.format(generatedAt)}
          </Text>
        </View>

        <View style={styles.row}>
          <StatTile
            label="Alumnos"
            value={String(stats.totalStudents)}
            hint={`${stats.groupedStudents} en algún grupo`}
            color={BRAND}
          />
          <StatTile
            label="Grupos"
            value={String(stats.groupCount)}
            color={ACCENT}
          />
          <StatTile
            label="Edad máxima"
            value={stats.oldest ? `${stats.oldest.age} años` : "—"}
            hint={
              stats.oldest
                ? `${stats.oldest.name}${stats.oldest.groupName ? ` · ${stats.oldest.groupName}` : ""}`
                : "Sin fechas de nacimiento en grupos"
            }
            color={VIOLET}
          />
          <StatTile
            label="Localidades"
            value={String(stats.origins.length)}
            hint={
              stats.withoutLocality > 0
                ? `${studentsLabel(stats.withoutLocality)} sin localidad`
                : undefined
            }
            color={AMBER}
          />
        </View>

        <SectionHeading color={BRAND}>Alumnos por nivel</SectionHeading>
        {levels.length === 0 ? (
          <Text style={styles.muted}>Ningún alumno tiene nivel asignado.</Text>
        ) : (
          <HBars
            rows={barRows(
              levels.map((l) => ({
                label: l.label,
                count: l.count,
                color: l.color,
              })),
              BRAND
            )}
          />
        )}

        <SectionHeading color={VIOLET}>Edades en los grupos</SectionHeading>
        {ages.length === 0 ? (
          <Text style={styles.muted}>
            Faltan fechas de nacimiento en los alumnos de grupos.
          </Text>
        ) : (
          <>
            <HBars rows={barRows(ages, VIOLET)} />
            {stats.groupedWithoutBirthDate > 0 && (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                {studentsLabel(stats.groupedWithoutBirthDate)} sin fecha de
                nacimiento no se cuenta
                {stats.groupedWithoutBirthDate === 1 ? "" : "n"}.
              </Text>
            )}
          </>
        )}

        <SectionHeading color={ACCENT}>Alumnos por grupo</SectionHeading>
        {groups.length === 0 ? (
          <Text style={styles.muted}>Todavía no hay grupos.</Text>
        ) : (
          <>
            <HBars
              rows={barRows(
                groups.map((g) => ({ label: g.name, count: g.count })),
                ACCENT
              )}
            />
            {stats.groupSizes.length > groups.length && (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                Los {groups.length} grupos con más alumnos de {stats.groupCount}
                .
              </Text>
            )}
          </>
        )}

        <SectionHeading color={AMBER}>Procedencia</SectionHeading>
        {origins.length === 0 ? (
          <Text style={styles.muted}>
            Ningún alumno tiene localidad registrada.
          </Text>
        ) : (
          <>
            <HBars
              rows={barRows(
                origins.map((o) => ({ label: o.name, count: o.count })),
                AMBER
              )}
            />
            {(stats.origins.length > origins.length ||
              stats.unlocatedStudents > 0) && (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                {stats.origins.length > origins.length
                  ? `Las ${origins.length} localidades con más alumnos de ${stats.origins.length}. `
                  : ""}
                {stats.unlocatedStudents > 0
                  ? `${studentsLabel(stats.unlocatedStudents)} con una localidad que no se ha podido situar.`
                  : ""}
              </Text>
            )}
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
