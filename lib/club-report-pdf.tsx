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
  SKY,
  StatTile,
  VIOLET,
  Watermark,
  type BarRow,
} from "@/lib/pdf/brand";
import {
  ASPECT_LABELS,
  GENDER_LABELS,
  type ClubDetailReport,
  type CountRow,
  type GenderKey,
  type RatedExercise,
  type ReportSectionId,
} from "@/lib/club-report-detail";
import type { ClubReport } from "@/lib/club-reports";

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
  note: { fontSize: 8.5, color: "#6B7280", marginTop: 4 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  th: { fontSize: 8, color: "#6B7280", fontFamily: "Helvetica-Bold" },
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

function shorten(label: string, max = 15) {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

function bars(
  items: { label: string; count: number }[],
  color: string,
  format: (n: number) => string = String
): BarRow[] {
  const max = Math.max(...items.map((i) => i.count), 1);
  return items.map((i) => ({
    label: shorten(i.label),
    pct: (i.count / max) * 100,
    value: format(i.count),
    color,
  }));
}

function num(value: number) {
  return String(value).replace(".", ",");
}

function hoursText(minutes: number) {
  const h = minutes / 60;
  return h % 1 === 0 ? String(h) : h.toFixed(1).replace(".", ",");
}

function Empty({ children }: { children: string }) {
  return <Text style={styles.muted}>{children}</Text>;
}

function Reasons({ rows }: { rows: CountRow[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={[styles.th, { marginBottom: 3 }]}>MOTIVOS</Text>
      {rows.map((r) => (
        <View key={r.label} style={styles.tableRow} wrap={false}>
          <Text style={{ flex: 1, fontSize: 9 }}>{r.label}</Text>
          <Text style={{ width: 30, textAlign: "right", fontSize: 9 }}>
            {r.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RatedList({ rows }: { rows: RatedExercise[] }) {
  if (rows.length === 0) return <Empty>Sin datos.</Empty>;
  return (
    <View>
      {rows.map((r) => (
        <View key={r.name} style={styles.tableRow} wrap={false}>
          <Text style={{ flex: 1, fontSize: 9 }}>{r.name}</Text>
          <Text style={{ width: 70, textAlign: "right", fontSize: 9 }}>
            {num(r.average)} / 5 ({r.count})
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Informe de gestión del club en PDF. Solo se pintan las secciones elegidas
 * (`sections`); los datos llegan ya calculados.
 */
export function ClubReportPdf({
  clubName,
  periodLabel,
  coachName,
  generatedAt,
  sections,
  base,
  detail,
}: {
  clubName: string;
  periodLabel: string;
  coachName: string;
  generatedAt: Date;
  sections: ReportSectionId[];
  base: ClubReport;
  detail: ClubDetailReport;
}) {
  const has = (id: ReportSectionId) => sections.includes(id);
  const d = detail;

  return (
    <Document
      title={`Informe de gestión · ${clubName}`}
      author={coachName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <Page size="A4" style={styles.page}>
        <Watermark />

        <View style={styles.header}>
          <Text style={styles.brandLabel}>TenPlanner · Informe de gestión</Text>
          <Text style={styles.title}>{clubName}</Text>
          <Text style={styles.subtitle}>
            Periodo: {periodLabel} · Generado por {coachName} el{" "}
            {dateFormat.format(generatedAt)}
          </Text>
        </View>

        {has("alumnos") && (
          <>
            <SectionHeading color={BRAND}>Alumnos y grupos</SectionHeading>
            <View style={styles.row}>
              <StatTile
                label="Alumnos"
                value={String(d.students.total)}
                hint="Fichas del club"
                color={BRAND}
              />
              <StatTile
                label="Grupos"
                value={String(d.students.groups)}
                color={ACCENT}
              />
            </View>
          </>
        )}

        {has("genero") && (
          <>
            <SectionHeading color={VIOLET}>Alumnos por género</SectionHeading>
            {d.students.total === 0 ? (
              <Empty>No hay alumnos.</Empty>
            ) : (
              <HBars
                rows={bars(
                  (Object.keys(GENDER_LABELS) as GenderKey[])
                    .map((k) => ({
                      label: GENDER_LABELS[k],
                      count: d.students.gender[k],
                    }))
                    .filter((r) => r.count > 0),
                  VIOLET
                )}
              />
            )}
          </>
        )}

        {has("edad") && (
          <>
            <SectionHeading color={SKY}>Edad</SectionHeading>
            <View style={styles.row}>
              <StatTile
                label="Edad media"
                value={
                  d.students.ageAverage === null
                    ? "—"
                    : `${num(d.students.ageAverage)} años`
                }
                color={SKY}
              />
              <StatTile
                label="Edad mediana"
                value={
                  d.students.ageMedian === null
                    ? "—"
                    : `${num(d.students.ageMedian)} años`
                }
                hint={`${d.students.agesCounted} de ${d.students.total} con fecha de nacimiento`}
                color={SKY}
              />
            </View>
          </>
        )}

        {has("procedencia") && (
          <>
            <SectionHeading color={AMBER}>
              De dónde vienen los alumnos
            </SectionHeading>
            {d.students.origins.length === 0 ? (
              <Empty>Ningún alumno tiene localidad registrada.</Empty>
            ) : (
              <>
                <HBars
                  rows={bars(
                    d.students.origins.slice(0, 12).map((o) => ({
                      label: o.label,
                      count: o.count,
                    })),
                    AMBER
                  )}
                />
                <Text style={styles.note}>
                  {d.students.origins.length > 12
                    ? `Las 12 localidades con más alumnos de ${d.students.origins.length}. `
                    : ""}
                  {d.students.withoutLocality > 0
                    ? `${d.students.withoutLocality} sin localidad.`
                    : ""}
                </Text>
              </>
            )}
          </>
        )}

        {has("frecuencia") && (
          <>
            <SectionHeading color={ACCENT}>
              Veces por semana que vienen
            </SectionHeading>
            <View style={styles.row}>
              <StatTile
                label="Media por alumno"
                value={
                  d.weekly.average === null
                    ? "—"
                    : `${num(d.weekly.average)} / semana`
                }
                hint={`${d.weekly.students} alumno(s) con asistencia anotada`}
                color={ACCENT}
              />
            </View>
          </>
        )}

        {has("altas") && (
          <>
            <SectionHeading color={BRAND}>Altas y bajas</SectionHeading>
            <View style={styles.row}>
              <StatTile
                label="Altas"
                value={String(d.signups.count)}
                color={BRAND}
              />
              <StatTile
                label="Bajas"
                value={String(d.departures.count)}
                color="#EF4444"
              />
            </View>
            {d.signups.count > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text style={[styles.th, { marginBottom: 3 }]}>
                  ALTAS · CÓMO NOS CONOCIERON
                </Text>
                {d.signups.rows.map((r, i) => (
                  <View key={`${r.name}-${i}`} style={styles.tableRow} wrap={false}>
                    <Text style={{ flex: 1, fontSize: 9 }}>{r.name}</Text>
                    <Text style={{ fontSize: 9, color: "#6B7280" }}>
                      {dateFormat.format(new Date(r.date))}
                      {r.howFound ? ` · ${r.howFound}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {d.departures.count > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.th, { marginBottom: 3 }]}>
                  BAJAS · MOTIVO
                </Text>
                {d.departures.rows.map((r, i) => (
                  <View key={`${r.name}-${i}`} style={styles.tableRow} wrap={false}>
                    <Text style={{ flex: 1, fontSize: 9 }}>{r.name}</Text>
                    <Text style={{ fontSize: 9, color: "#6B7280" }}>
                      {dateFormat.format(new Date(`${r.date}T12:00:00Z`))}
                      {r.reason ? ` · ${r.reason}` : ""}
                    </Text>
                  </View>
                ))}
                <Reasons rows={d.departures.reasons} />
              </View>
            )}
          </>
        )}

        {has("dia_semana") && (
          <>
            <SectionHeading color={SKY}>
              Clases por día de la semana
            </SectionHeading>
            <HBars
              rows={bars(
                d.weekdays.map((w) => ({ label: w.label, count: w.sessions })),
                SKY
              )}
            />
          </>
        )}

        {has("monitores") && (
          <>
            <SectionHeading color={BRAND}>
              Clases y horas en pista por monitor
            </SectionHeading>
            {base.coachRows.length === 0 ? (
              <Empty>No hay monitores.</Empty>
            ) : (
              <View>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 1 }]}>MONITOR</Text>
                  <Text style={[styles.th, { width: 55, textAlign: "right" }]}>
                    CLASES
                  </Text>
                  <Text style={[styles.th, { width: 55, textAlign: "right" }]}>
                    HORAS
                  </Text>
                </View>
                {base.coachRows.map((c) => (
                  <View key={c.id} style={styles.tableRow} wrap={false}>
                    <Text style={{ flex: 1, fontSize: 9 }}>{c.name}</Text>
                    <Text style={{ width: 55, textAlign: "right", fontSize: 9 }}>
                      {c.sessions}
                    </Text>
                    <Text style={{ width: 55, textAlign: "right", fontSize: 9 }}>
                      {hoursText(c.minutes)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {has("ejercicios_monitor") && (
          <>
            <SectionHeading color={VIOLET}>
              Ejercicios usados por monitor
            </SectionHeading>
            {d.exercisesByCoach.length === 0 ? (
              <Empty>No hay ejercicios en las sesiones del periodo.</Empty>
            ) : (
              <View>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 1 }]}>MONITOR</Text>
                  <Text style={[styles.th, { width: 70, textAlign: "right" }]}>
                    USOS
                  </Text>
                  <Text style={[styles.th, { width: 70, textAlign: "right" }]}>
                    DISTINTOS
                  </Text>
                </View>
                {d.exercisesByCoach.map((c) => (
                  <View key={c.id} style={styles.tableRow} wrap={false}>
                    <Text style={{ flex: 1, fontSize: 9 }}>{c.name}</Text>
                    <Text style={{ width: 70, textAlign: "right", fontSize: 9 }}>
                      {c.uses}
                    </Text>
                    <Text style={{ width: 70, textAlign: "right", fontSize: 9 }}>
                      {c.distinct}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {has("ejercicio_top") && (
          <>
            <SectionHeading color={AMBER}>Ejercicio más repetido</SectionHeading>
            {d.topExercises.length === 0 ? (
              <Empty>No hay ejercicios en las sesiones del periodo.</Empty>
            ) : (
              <>
                <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>
                  {d.topExercises[0].name}
                </Text>
                <Text style={styles.muted}>
                  {d.topExercises[0].times} veces
                </Text>
                {d.topExercises.length > 1 && (
                  <View style={{ marginTop: 6 }}>
                    <HBars
                      rows={bars(
                        d.topExercises.map((e) => ({
                          label: e.name,
                          count: e.times,
                        })),
                        AMBER
                      )}
                    />
                  </View>
                )}
              </>
            )}
          </>
        )}

        {has("aspectos") && (
          <>
            <SectionHeading color={ACCENT}>Aspectos del juego</SectionHeading>
            {d.aspects.every((a) => a.pct === 0) ? (
              <Empty>No hay tiempo clasificado por aspectos.</Empty>
            ) : (
              <HBars
                rows={d.aspects.map((a) => ({
                  label: ASPECT_LABELS[a.key],
                  pct: a.pct,
                  value: `${a.pct} %`,
                  color: ACCENT,
                }))}
              />
            )}
          </>
        )}

        {has("valoracion") && (
          <>
            <SectionHeading color={BRAND}>
              Valoración de las sesiones
            </SectionHeading>
            <View style={styles.row}>
              <StatTile
                label="Valoración media"
                value={
                  d.sessionRating.average === null
                    ? "—"
                    : `${num(d.sessionRating.average)} / 5`
                }
                hint={`${d.sessionRating.rated} de ${d.sessionRating.sessions} sesiones valoradas`}
                color={BRAND}
              />
            </View>
          </>
        )}

        {has("ejercicios_valorados") && (
          <>
            <SectionHeading color={ACCENT}>
              Ejercicios mejor valorados
            </SectionHeading>
            <RatedList rows={d.bestExercises} />
            <SectionHeading color="#EF4444">
              Ejercicios peor valorados
            </SectionHeading>
            <RatedList rows={d.worstExercises} />
          </>
        )}

        {has("canceladas") && (
          <>
            <SectionHeading color="#EF4444">Sesiones canceladas</SectionHeading>
            <View style={styles.row}>
              <StatTile
                label="Canceladas"
                value={String(d.cancelled.count)}
                color="#EF4444"
              />
            </View>
            <Reasons rows={d.cancelled.reasons} />
          </>
        )}

        {has("modificadas") && (
          <>
            <SectionHeading color={AMBER}>Sesiones modificadas</SectionHeading>
            <View style={styles.row}>
              <StatTile
                label="Modificadas"
                value={String(d.modified.count)}
                hint={`${d.modified.answered} sesiones con respuesta de si se dio como estaba planificada`}
                color={AMBER}
              />
            </View>
            <Reasons rows={d.modified.reasons} />
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
