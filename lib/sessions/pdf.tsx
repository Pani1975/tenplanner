import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ExerciseDiagramPdf } from "@/lib/exercise-diagrams/pdf";
import type { Diagram } from "@/lib/exercise-diagrams/types";
import {
  ACCENT,
  BORDER,
  BRAND,
  BRAND_DARK,
  BRAND_LIGHT,
  BRAND_MUTED,
  GRAY,
  LIGHT_GRAY,
  Watermark,
  IntensityDots,
  PlanCharts,
} from "@/lib/pdf/brand";

export { BORDER, BRAND, BRAND_LIGHT, BRAND_MUTED, GRAY, LIGHT_GRAY };

export type PdfExercise = {
  /** "text" = texto libre del monitor. */
  kind?: "exercise" | "text";
  description?: string | null;
  steps?: Array<{ title: string; description: string }>;
  tips?: string | null;
  blockTitle?: string | null;
  name: string;
  category: "technique" | "tactics" | "fitness" | "warm-up";
  difficulty: "beginner" | "intermediate" | "advanced";
  orderIndex: number;
  durationMinutes: number | null;
  notes: string | null;
  phase: "activation" | "main" | "cooldown" | null;
  intensity: number | null;
  materials?: string[] | null;
  /** Esquema de pista del ejercicio (si existe). */
  diagram?: Diagram | null;
};

export type PdfSession = {
  title: string;
  description: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  objective: string | null;
  intensity: number | null;
  tags: string[] | null;
  location: string | null;
  material?: string | null;
  observations?: string | null;
  exercises: PdfExercise[];
  students: { name: string; playerLevel: string | null }[];
  coachName: string;
};


export const styles = StyleSheet.create({
  page: {
    padding: 44,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },

  // Header
  header: {
    marginBottom: 20,
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
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    lineHeight: 1.2,
    marginBottom: 3,
  },
  subtitle: { fontSize: 9.5, color: BRAND_MUTED, marginTop: 1 },
  coachLine: { fontSize: 9, color: BRAND_MUTED, marginTop: 4 },

  // Meta grid
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
    gap: 6,
  },
  metaItem: {
    backgroundColor: BRAND_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    minWidth: 70,
  },
  metaLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: GRAY,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  metaValue: { fontSize: 10, color: "#111827" },

  // Sections
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 8,
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Objective / description text
  bodyText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
    marginBottom: 10,
  },

  // Students
  studentsRow: { fontSize: 9.5, color: "#374151", marginBottom: 12 },

  // Materials summary
  materialsContainer: {
    backgroundColor: BRAND_LIGHT,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    padding: 10,
    marginBottom: 16,
  },
  materialsTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  materialsList: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  materialChip: {
    backgroundColor: "#DBEAFE",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 8.5,
    color: "#1D4ED8",
  },

  // Phase blocks
  phaseBlock: { marginBottom: 12 },
  phaseTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    backgroundColor: BRAND,
    color: "#fff",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Exercise cards
  exercise: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 5,
    padding: 9,
    marginBottom: 5,
    backgroundColor: "#FAFAFA",
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  exerciseNumber: {
    fontSize: 10,
    color: BRAND_MUTED,
    fontFamily: "Helvetica-Bold",
    marginRight: 5,
    lineHeight: 1.4,
  },
  exerciseName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    flex: 1,
    lineHeight: 1.3,
  },
  exerciseDuration: {
    fontSize: 9,
    color: GRAY,
    fontFamily: "Helvetica-Bold",
    marginLeft: 8,
    flexShrink: 0,
  },
  exerciseMeta: { fontSize: 8.5, color: GRAY, marginBottom: 2 },
  exerciseNotes: {
    fontSize: 9,
    color: "#374151",
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    lineHeight: 1.4,
  },
  exerciseMaterials: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginTop: 5,
  },
  exerciseMaterialChip: {
    fontSize: 8,
    color: "#4B5563",
    backgroundColor: LIGHT_GRAY,
    borderRadius: 3,
    paddingVertical: 1,
    paddingHorizontal: 5,
  },

  exerciseDescription: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.45,
    marginTop: 4,
  },
  stepRow: { flexDirection: "row", marginTop: 3 },
  stepNumber: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    width: 12,
  },
  stepText: { fontSize: 8.5, color: "#374151", flex: 1, lineHeight: 1.4 },
  stepTitle: { fontFamily: "Helvetica-Bold", color: "#111827" },
  textItem: {
    borderLeftWidth: 3,
    borderLeftColor: GRAY,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 5,
    padding: 9,
    marginBottom: 5,
  },
  textItemBody: { fontSize: 10, color: "#111827", lineHeight: 1.45, flex: 1 },

  // Footer
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

export const PHASE_LABEL: Record<
  NonNullable<PdfExercise["phase"]> | "none",
  string
> = {
  activation: "Bloque inicial",
  main: "Bloque principal",
  cooldown: "Bloque final",
  none: "Sin bloque asignado",
};

export const CATEGORY_LABEL: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

export const INTENSITY_LABEL = [
  "",
  "Muy suave",
  "Suave",
  "Moderada",
  "Alta",
  "Máxima",
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function groupByPhase(exercises: PdfExercise[]) {
  const order: Array<"activation" | "main" | "cooldown" | "none"> = [
    "activation",
    "main",
    "cooldown",
    "none",
  ];
  const groups = new Map<
    "activation" | "main" | "cooldown" | "none",
    PdfExercise[]
  >();
  for (const ex of [...exercises].sort((a, b) => a.orderIndex - b.orderIndex)) {
    const key = (ex.phase ?? "none") as
      | "activation"
      | "main"
      | "cooldown"
      | "none";
    const list = groups.get(key) ?? [];
    list.push(ex);
    groups.set(key, list);
  }
  return order
    .filter((k) => groups.has(k))
    .map((k) => ({ phase: k, items: groups.get(k)! }));
}

/** Lista de ejercicios/textos agrupada por bloque, con su título de sección
 * ("Plan de entrenamiento"). Compartida por el PDF de sesión y el de clase
 * (plantilla de biblioteca), que tienen idéntico contenido de bloques. */
export function TrainingItemsSection({
  exercises,
  sectionTitle = "Plan de entrenamiento",
}: {
  exercises: PdfExercise[];
  sectionTitle?: string;
}) {
  const phases = groupByPhase(exercises);
  return (
    <>
      {phases.map(({ phase, items }, phaseIdx) => (
        <View key={phase} style={styles.phaseBlock}>
          {/* El título va dentro del primer bloque para no quedarse
                solo al final de una página. */}
          {phaseIdx === 0 && (
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          )}
          <Text style={styles.phaseTitle} minPresenceAhead={80}>
            {items[0]?.blockTitle || PHASE_LABEL[phase]}
          </Text>
          {items.map((ex) =>
            ex.kind === "text" ? (
              <View
                key={`${phase}-${ex.orderIndex}`}
                style={styles.textItem}
                wrap={false}
              >
                <View style={styles.exerciseHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      flex: 1,
                      alignItems: "flex-start",
                    }}
                  >
                    <Text style={styles.exerciseNumber}>
                      {ex.orderIndex + 1}.
                    </Text>
                    <Text style={styles.textItemBody}>{ex.name}</Text>
                  </View>
                  {ex.durationMinutes ? (
                    <Text style={styles.exerciseDuration}>
                      {ex.durationMinutes} min
                    </Text>
                  ) : null}
                </View>
                {ex.description ? (
                  <Text style={styles.exerciseDescription}>
                    {ex.description}
                  </Text>
                ) : null}
                {ex.notes ? (
                  <Text style={styles.exerciseNotes}>Notas: {ex.notes}</Text>
                ) : null}
              </View>
            ) : (
              <View
                key={`${phase}-${ex.orderIndex}-${ex.name}`}
                style={styles.exercise}
              >
                <View style={styles.exerciseHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      flex: 1,
                      alignItems: "flex-start",
                    }}
                  >
                    <Text style={styles.exerciseNumber}>
                      {ex.orderIndex + 1}.
                    </Text>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                  </View>
                  {ex.durationMinutes ? (
                    <Text style={styles.exerciseDuration}>
                      {ex.durationMinutes} min
                    </Text>
                  ) : null}
                </View>

                <Text style={styles.exerciseMeta}>
                  {CATEGORY_LABEL[ex.category] ?? ex.category}
                  {ex.intensity != null
                    ? ` · Intensidad ${ex.intensity}/5 (${INTENSITY_LABEL[ex.intensity]})`
                    : ""}
                </Text>

                {ex.description ? (
                  <Text style={styles.exerciseDescription}>
                    {ex.description}
                  </Text>
                ) : null}

                {ex.diagram ? (
                  <View style={{ marginTop: 6, alignItems: "center" }}>
                    <ExerciseDiagramPdf diagram={ex.diagram} width={150} />
                    <Text style={{ fontSize: 7, color: GRAY, marginTop: 2 }}>
                      {ex.diagram.caption ? `${ex.diagram.caption} · ` : ""}
                      Esquema orientativo
                    </Text>
                  </View>
                ) : null}

                {ex.steps && ex.steps.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    {ex.steps.map((step, i) => (
                      <View key={i} style={styles.stepRow}>
                        <Text style={styles.stepNumber}>{i + 1}.</Text>
                        <Text style={styles.stepText}>
                          <Text style={styles.stepTitle}>{step.title}</Text>
                          {step.description ? ` — ${step.description}` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {ex.tips ? (
                  <Text style={styles.exerciseDescription}>
                    Consejos: {ex.tips}
                  </Text>
                ) : null}

                {ex.notes && (
                  <Text style={styles.exerciseNotes}>Notas: {ex.notes}</Text>
                )}

                {ex.materials && ex.materials.length > 0 && (
                  <View style={styles.exerciseMaterials}>
                    {ex.materials.map((m) => (
                      <View key={m} style={styles.exerciseMaterialChip}>
                        <Text>{m}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )
          )}
        </View>
      ))}
    </>
  );
}

/** Contenido de una sesión como página A4. Reutilizable para combinar
 * varias sesiones en un único PDF (ver `MultiSessionPdf`). */
export function SessionPdfPage({ session }: { session: PdfSession }) {
  const totalMinutes =
    session.exercises.reduce((s, e) => s + (e.durationMinutes ?? 0), 0) ||
    session.durationMinutes;

  const allMaterials = Array.from(
    new Set(
      session.exercises.flatMap((e) =>
        Array.isArray(e.materials) ? e.materials : []
      )
    )
  );

  return (
    <Page size="A4" style={styles.page}>
      <Watermark />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandLabel}>
          TenPlanner · Sesión de entrenamiento
        </Text>
        <Text style={styles.title}>{session.title}</Text>
        <Text style={styles.subtitle}>{formatDate(session.scheduledAt)}</Text>
        <Text style={styles.coachLine}>Entrenador: {session.coachName}</Text>
      </View>

      {/* Meta chips */}
      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Duración</Text>
          <Text style={styles.metaValue}>{totalMinutes} min</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Ejercicios</Text>
          <Text style={styles.metaValue}>
            {session.exercises.filter((e) => e.kind !== "text").length}
          </Text>
        </View>
        {session.intensity != null && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Intensidad</Text>
            <Text style={styles.metaValue}>
              {session.intensity}/5 — {INTENSITY_LABEL[session.intensity]}
            </Text>
            <IntensityDots value={session.intensity} />
          </View>
        )}
        {session.location && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Ubicación</Text>
            <Text style={styles.metaValue}>{session.location}</Text>
          </View>
        )}
        {session.tags && session.tags.length > 0 && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Etiquetas</Text>
            <Text style={styles.metaValue}>{session.tags.join(", ")}</Text>
          </View>
        )}
      </View>

      <PlanCharts exercises={session.exercises} />

      {/* Objective */}
      {session.objective && (
        <>
          <Text style={styles.sectionTitle}>Objetivo</Text>
          <Text style={styles.bodyText}>{session.objective}</Text>
        </>
      )}

      {/* Description */}
      {session.description && (
        <>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.bodyText}>{session.description}</Text>
        </>
      )}

      {session.material && (
        <>
          <Text style={styles.sectionTitle}>Material</Text>
          <Text style={styles.bodyText}>{session.material}</Text>
        </>
      )}

      {session.observations && (
        <>
          <Text style={styles.sectionTitle}>Observaciones</Text>
          <Text style={styles.bodyText}>{session.observations}</Text>
        </>
      )}

      {/* Students */}
      {session.students.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Alumnos ({session.students.length})
          </Text>
          <Text style={styles.studentsRow}>
            {session.students
              .map((s) =>
                s.playerLevel ? `${s.name} (${s.playerLevel})` : s.name
              )
              .join("  ·  ")}
          </Text>
        </>
      )}

      {/* Materials summary */}
      {allMaterials.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Material necesario</Text>
          <View style={styles.materialsContainer}>
            <Text style={styles.materialsTitle}>
              Prepara antes de comenzar — {allMaterials.length} elemento
              {allMaterials.length !== 1 ? "s" : ""}
            </Text>
            <View style={styles.materialsList}>
              {allMaterials.map((m) => (
                <View key={m} style={styles.materialChip}>
                  <Text>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Exercises */}
      <TrainingItemsSection exercises={session.exercises} />

      {/* Footer */}
      <Text style={styles.footer} fixed>
        Generado con TenPlanner · {formatDate(new Date())} · Entrenador:{" "}
        {session.coachName}
      </Text>
    </Page>
  );
}

/** PDF de una única sesión. */
export function SessionPdf({ session }: { session: PdfSession }) {
  return (
    <Document
      title={session.title}
      author={session.coachName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <SessionPdfPage session={session} />
    </Document>
  );
}

/** PDF combinado: una página (o más, si la sesión no cabe en una) por
 * cada sesión, en el orden recibido. Pensado para "todas las sesiones
 * de un día" o una selección de varias. */
export function MultiSessionPdf({
  sessions,
  title,
}: {
  sessions: PdfSession[];
  title?: string;
}) {
  const coachName = sessions[0]?.coachName ?? "Entrenador";
  return (
    <Document
      title={title ?? "Sesiones de entrenamiento"}
      author={coachName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      {sessions.map((session, idx) => (
        <SessionPdfPage key={`${session.title}-${idx}`} session={session} />
      ))}
    </Document>
  );
}
