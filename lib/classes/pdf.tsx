import { Document, Page, Text, View } from "@react-pdf/renderer";
import { Watermark, PlanCharts } from "@/lib/pdf/brand";
import {
  styles,
  TrainingItemsSection,
  type PdfExercise,
} from "@/lib/sessions/pdf";

export type { PdfExercise };

export type PdfClass = {
  name: string;
  durationMinutes: number;
  objetivos: string | null;
  material: string | null;
  aspectosImportantes: string | null;
  alumnosTipo: "individual" | "grupal" | null;
  numAlumnos: number | null;
  niveles: string[] | null;
  aspectosJuego: string[] | null;
  golpes: string[] | null;
  /** Etiqueta legible de autoría (p. ej. "Academia Christian Larsen"), o
   * null si es una clase propia sin autoría especial. */
  autoriaLabel: string | null;
  coachName: string;
  exercises: PdfExercise[];
};

const NIVEL_LABEL: Record<string, string> = {
  iniciacion: "Iniciación",
  desarrollo: "Desarrollo",
  consolidacion: "Consolidación",
  perfeccionamiento: "Perfeccionamiento",
  competicion: "Competición",
};

const ASPECTO_LABEL: Record<string, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisico: "Físico",
  mental: "Mental",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Contenido de una clase (plantilla de biblioteca) como página A4. Misma
 * estructura visual que el PDF de sesión (ver lib/sessions/pdf.tsx), con
 * una cabecera y metadatos propios de clase en vez de fecha/alumnos. */
export function ClassPdfPage({ cls }: { cls: PdfClass }) {
  const totalMinutes =
    cls.exercises.reduce((s, e) => s + (e.durationMinutes ?? 0), 0) ||
    cls.durationMinutes;

  const allMaterials = Array.from(
    new Set(
      cls.exercises.flatMap((e) =>
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
          TenPlanner · Plantilla de clase
          {cls.autoriaLabel ? ` · ${cls.autoriaLabel}` : ""}
        </Text>
        <Text style={styles.title}>{cls.name}</Text>
        <Text style={styles.coachLine}>Entrenador: {cls.coachName}</Text>
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
            {cls.exercises.filter((e) => e.kind !== "text").length}
          </Text>
        </View>
        {cls.alumnosTipo && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Alumnos</Text>
            <Text style={styles.metaValue}>
              {cls.alumnosTipo === "grupal" ? "Grupal" : "Individual"}
              {cls.numAlumnos ? ` · ${cls.numAlumnos}` : ""}
            </Text>
          </View>
        )}
        {cls.niveles && cls.niveles.length > 0 && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Nivel</Text>
            <Text style={styles.metaValue}>
              {cls.niveles.map((n) => NIVEL_LABEL[n] ?? n).join(", ")}
            </Text>
          </View>
        )}
        {cls.aspectosJuego && cls.aspectosJuego.length > 0 && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Aspecto</Text>
            <Text style={styles.metaValue}>
              {cls.aspectosJuego.map((a) => ASPECTO_LABEL[a] ?? a).join(", ")}
            </Text>
          </View>
        )}
        {cls.golpes && cls.golpes.length > 0 && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Golpes</Text>
            <Text style={styles.metaValue}>{cls.golpes.join(", ")}</Text>
          </View>
        )}
      </View>

      <PlanCharts exercises={cls.exercises} />

      {/* Objective */}
      {cls.objetivos && (
        <>
          <Text style={styles.sectionTitle}>Objetivos</Text>
          <Text style={styles.bodyText}>{cls.objetivos}</Text>
        </>
      )}

      {cls.material && (
        <>
          <Text style={styles.sectionTitle}>Material</Text>
          <Text style={styles.bodyText}>{cls.material}</Text>
        </>
      )}

      {cls.aspectosImportantes && (
        <>
          <Text style={styles.sectionTitle}>Aspectos importantes</Text>
          <Text style={styles.bodyText}>{cls.aspectosImportantes}</Text>
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
      <TrainingItemsSection
        exercises={cls.exercises}
        sectionTitle="Estructura de la clase"
      />

      {/* Footer */}
      <Text style={styles.footer} fixed>
        Generado con TenPlanner · {formatDate(new Date())}
      </Text>
    </Page>
  );
}

/** PDF de una única clase (plantilla de biblioteca). */
export function ClassPdf({ cls }: { cls: PdfClass }) {
  return (
    <Document
      title={cls.name}
      author={cls.coachName}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <ClassPdfPage cls={cls} />
    </Document>
  );
}

/** PDF con varias clases (p. ej. las de un filtrado o una selección):
 * cada clase empieza en una página nueva, en el orden recibido. */
export function MultiClassPdf({
  classes,
  title,
}: {
  classes: PdfClass[];
  title: string;
}) {
  return (
    <Document
      title={title}
      author={classes[0]?.coachName ?? "TenPlanner"}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      {classes.map((cls, idx) => (
        <ClassPdfPage key={`${idx}-${cls.name}`} cls={cls} />
      ))}
    </Document>
  );
}
