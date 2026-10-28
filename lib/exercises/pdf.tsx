import { Document, Page, Text, View } from "@react-pdf/renderer";
import { Watermark } from "@/lib/pdf/brand";
import { styles, TrainingItemsSection, type PdfExercise } from "@/lib/sessions/pdf";

export type { PdfExercise };

export type PdfExerciseList = {
  /** Título de la cabecera, p. ej. "Biblioteca de ejercicios". */
  title: string;
  /** Resumen de los filtros aplicados en la búsqueda (texto libre). */
  filtersSummary: string | null;
  /** Nº total de ejercicios encontrados (puede ser mayor que exercises.length si se truncó). */
  total: number;
  truncated: boolean;
  exercises: PdfExercise[];
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Página con el listado de ejercicios de una búsqueda filtrada. Reutiliza
 * los mismos estilos y la sección de ejercicios que el PDF de sesión/clase
 * (ver lib/sessions/pdf.tsx), pero sin agrupar por fase de entrenamiento:
 * aquí son ejercicios sueltos de la biblioteca, no un plan de sesión. */
export function ExerciseListPdfPage({ list }: { list: PdfExerciseList }) {
  return (
    <Page size="A4" style={styles.page}>
      <Watermark />
      <View style={styles.header}>
        <Text style={styles.brandLabel}>TenPlanner · Biblioteca de ejercicios</Text>
        <Text style={styles.title}>{list.title}</Text>
        {list.filtersSummary && (
          <Text style={styles.coachLine}>{list.filtersSummary}</Text>
        )}
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Ejercicios</Text>
          <Text style={styles.metaValue}>{list.total}</Text>
        </View>
      </View>

      {list.truncated && (
        <Text style={styles.bodyText}>
          Se muestran los primeros {list.exercises.length} de {list.total}{" "}
          resultados. Afina la búsqueda para un PDF más corto.
        </Text>
      )}

      <TrainingItemsSection
        exercises={list.exercises}
        sectionTitle="Ejercicios"
      />

      <Text style={styles.footer} fixed>
        Generado con TenPlanner · {formatDate(new Date())}
      </Text>
    </Page>
  );
}

/** PDF con todos los ejercicios de una búsqueda filtrada en la biblioteca. */
export function ExerciseListPdf({ list }: { list: PdfExerciseList }) {
  return (
    <Document
      title={list.title}
      creator="TenPlanner"
      producer="TenPlanner"
    >
      <ExerciseListPdfPage list={list} />
    </Document>
  );
}
