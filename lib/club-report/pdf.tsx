import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  ACCENT,
  BORDER,
  BRAND,
  BRAND_DARK,
  BRAND_MUTED,
  HBars,
  SectionHeading,
  StatTile,
  Watermark,
} from "@/lib/pdf/brand";
import type { ReportBlockId, ReportMetricId } from "./catalog";
import type { MetricView, ViewPart } from "./views";

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

const BLOCK_COLORS: Record<ReportBlockId, string> = {
  alumnos: BRAND,
  grupos: "#38BDF8",
  monitores: "#A78BFA",
  sesiones: ACCENT,
  ejercicios: "#F59E0B",
  clases: "#EC4899",
  pistas: "#14B8A6",
};

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
    marginBottom: 10,
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
  block: {
    marginTop: 18,
    paddingBottom: 4,
    borderBottomWidth: 2,
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
  },
  hint: { fontSize: 8.5, color: "#6B7280", marginBottom: 6 },
  muted: { fontSize: 9, color: "#6B7280" },
  partTitle: {
    fontSize: 8,
    color: "#6B7280",
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  th: { fontSize: 7.5, color: "#6B7280", fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8.5 },
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

function shorten(label: string, max = 16) {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label;
}

function Part({ part, color }: { part: ViewPart; color: string }) {
  switch (part.kind) {
    case "stats":
      // De cuatro en cuatro para que las cifras no queden estrechas.
      return (
        <View>
          {Array.from({ length: Math.ceil(part.items.length / 4) }, (_, i) => (
            <View key={i} style={styles.row} wrap={false}>
              {part.items.slice(i * 4, i * 4 + 4).map((item) => (
                <StatTile
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  hint={item.hint}
                  color={color}
                />
              ))}
            </View>
          ))}
        </View>
      );
    case "bars": {
      if (part.rows.length === 0) return null;
      const max = Math.max(...part.rows.map((r) => r.value), 0) || 1;
      return (
        <View style={{ marginBottom: 4 }}>
          {part.title && <Text style={styles.partTitle}>{part.title}</Text>}
          <HBars
            rows={part.rows.map((r) => ({
              label: shorten(r.label),
              pct: (r.value / max) * 100,
              value: r.display,
              color,
            }))}
          />
        </View>
      );
    }
    case "table": {
      const first = 2.2;
      return (
        <View style={{ marginBottom: 4 }}>
          {part.title && <Text style={styles.partTitle}>{part.title}</Text>}
          <View style={styles.tableHead} fixed={false}>
            {part.columns.map((c, i) => (
              <Text
                key={c.label}
                style={[
                  styles.th,
                  { flex: i === 0 ? first : 1, textAlign: c.align ?? "left" },
                ]}
              >
                {c.label.toUpperCase()}
              </Text>
            ))}
          </View>
          {part.rows.map((row, ri) => (
            <View key={ri} style={styles.tableRow} wrap={false}>
              {row.map((cell, ci) => (
                <Text
                  key={ci}
                  style={[
                    styles.td,
                    {
                      flex: ci === 0 ? first : 1,
                      textAlign: part.columns[ci]?.align ?? "left",
                    },
                  ]}
                >
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "note":
      return <Text style={[styles.muted, { marginTop: 2 }]}>{part.text}</Text>;
  }
}

function hasContent(view: MetricView) {
  return view.parts.some(
    (p) =>
      (p.kind === "bars" && p.rows.length > 0) ||
      (p.kind === "table" && p.rows.length > 0) ||
      p.kind === "stats" ||
      p.kind === "note"
  );
}

/** Informe de gestión en PDF: los datos elegidos, agrupados por bloques. */
export function ClubReportPdf({
  clubName,
  reportTitle,
  periodLabel,
  authorName,
  generatedAt,
  blocks,
  views,
}: {
  clubName: string;
  /** Nombre de la plantilla o "Informe de gestión". */
  reportTitle: string;
  periodLabel: string;
  authorName: string;
  generatedAt: Date;
  blocks: {
    id: ReportBlockId;
    label: string;
    metrics: { id: ReportMetricId }[];
  }[];
  views: Map<ReportMetricId, MetricView>;
}) {
  return (
    <Document
      title={`${reportTitle} · ${clubName}`}
      author={authorName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <Page size="A4" style={styles.page}>
        <Watermark />
        <View style={styles.header}>
          <Text style={styles.brandLabel}>TenPlanner · {reportTitle}</Text>
          <Text style={styles.title}>{clubName}</Text>
          <Text style={styles.subtitle}>
            Periodo: {periodLabel} · Generado por {authorName} el{" "}
            {dateFormat.format(generatedAt)}
          </Text>
        </View>

        {blocks.map((block) => {
          const color = BLOCK_COLORS[block.id];
          return (
            <View key={block.id}>
              <Text
                style={[styles.block, { borderBottomColor: color }]}
                minPresenceAhead={80}
              >
                {block.label}
              </Text>
              {block.metrics.map((m) => {
                const view = views.get(m.id);
                if (!view) return null;
                return (
                  <View key={m.id}>
                    <SectionHeading color={color}>{view.title}</SectionHeading>
                    {view.hint && <Text style={styles.hint}>{view.hint}</Text>}
                    {hasContent(view) ? (
                      view.parts.map((part, i) => (
                        <Part key={i} part={part} color={color} />
                      ))
                    ) : (
                      <Text style={styles.muted}>
                        {view.empty ?? "Sin datos."}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

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
