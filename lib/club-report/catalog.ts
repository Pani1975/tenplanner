// Catálogo del informe de gestión: los datos que se pueden ver y sacar en
// PDF, agrupados por bloques. Los ids se guardan en las plantillas
// (report_templates.metrics): no cambiarlos sin migrar las plantillas.

export const REPORT_BLOCKS = [
  {
    id: "alumnos",
    label: "Alumnos",
    metrics: [
      { id: "alumnos_resumen", label: "Número de alumnos, altas y bajas" },
      { id: "alumnos_genero", label: "Alumnos por género" },
      { id: "alumnos_edad", label: "Edad media, mediana y por tramos" },
      { id: "alumnos_nivel", label: "Alumnos por nivel" },
      { id: "alumnos_mano", label: "Mano dominante" },
      { id: "alumnos_procedencia", label: "De dónde vienen" },
      { id: "alumnos_frecuencia", label: "Veces por semana que vienen" },
      { id: "alumnos_asistencia", label: "Asistencia" },
      { id: "alumnos_altas", label: "Altas y cómo nos conocieron" },
      { id: "alumnos_bajas", label: "Bajas y sus motivos" },
      { id: "alumnos_objetivos", label: "Objetivos conseguidos" },
      { id: "alumnos_fichas", label: "Fichas completas e incompletas" },
      {
        id: "alumnos_tabla",
        label: "Tabla de alumnos (asistencia y objetivos)",
      },
    ],
  },
  {
    id: "grupos",
    label: "Grupos",
    metrics: [
      { id: "grupos_resumen", label: "Número de grupos y tamaño medio" },
      { id: "grupos_tamano", label: "Alumnos por grupo" },
      {
        id: "grupos_actividad",
        label: "Sesiones, horas y asistencia por grupo",
      },
    ],
  },
  {
    id: "monitores",
    label: "Monitores",
    metrics: [
      { id: "monitores_resumen", label: "Número de monitores" },
      {
        id: "monitores_actividad",
        label: "Clases, horas en pista y alumnos por monitor",
      },
      { id: "monitores_valoracion", label: "Valoración media por monitor" },
      { id: "monitores_ejercicios", label: "Ejercicios usados por monitor" },
      {
        id: "monitores_cambios",
        label: "Canceladas y modificadas por monitor",
      },
    ],
  },
  {
    id: "sesiones",
    label: "Sesiones",
    metrics: [
      {
        id: "sesiones_resumen",
        label: "Sesiones impartidas, horas y duración media",
      },
      { id: "sesiones_dia", label: "Clases por día de la semana" },
      { id: "sesiones_franja", label: "Clases por franja horaria" },
      { id: "sesiones_mes", label: "Clases por mes" },
      { id: "sesiones_lugar", label: "Clases por pista o lugar" },
      { id: "sesiones_alumnos", label: "Alumnos por sesión" },
      { id: "sesiones_fases", label: "Tiempo por fase de la clase" },
      { id: "sesiones_intensidad", label: "Intensidad" },
      { id: "sesiones_valoracion", label: "Valoración media de las sesiones" },
      { id: "sesiones_canceladas", label: "Sesiones canceladas y motivos" },
      { id: "sesiones_modificadas", label: "Sesiones modificadas y motivos" },
    ],
  },
  {
    id: "ejercicios",
    label: "Ejercicios",
    metrics: [
      { id: "ejercicios_resumen", label: "Ejercicios usados y creados" },
      { id: "ejercicios_top", label: "Ejercicios más repetidos" },
      {
        id: "ejercicios_valorados",
        label: "Ejercicios mejor y peor valorados",
      },
      {
        id: "ejercicios_aspectos",
        label: "% por aspectos técnicos, tácticos, mentales y físicos",
      },
      { id: "ejercicios_tipos", label: "% por tipo de actividad" },
      { id: "ejercicios_golpes", label: "% por golpe" },
    ],
  },
  {
    id: "clases",
    label: "Clases",
    metrics: [
      {
        id: "clases_resumen",
        label: "Clases del club y sesiones a partir de una clase",
      },
      { id: "clases_usadas", label: "Clases más usadas" },
      { id: "clases_nivel", label: "Clases del club por nivel" },
      { id: "clases_aspecto", label: "Clases del club por aspecto" },
    ],
  },
  {
    id: "pistas",
    label: "Pistas y reservas",
    metrics: [{ id: "pistas_reservas", label: "Reservas y horas por pista" }],
  },
] as const;

export type ReportBlock = (typeof REPORT_BLOCKS)[number];
export type ReportBlockId = ReportBlock["id"];
export type ReportMetricId = ReportBlock["metrics"][number]["id"];

export const REPORT_METRIC_IDS: ReportMetricId[] = REPORT_BLOCKS.flatMap((b) =>
  b.metrics.map((m) => m.id as ReportMetricId)
);

const METRIC_SET = new Set<string>(REPORT_METRIC_IDS);

export function isReportMetricId(value: unknown): value is ReportMetricId {
  return typeof value === "string" && METRIC_SET.has(value);
}

export function metricLabel(id: ReportMetricId): string {
  for (const block of REPORT_BLOCKS)
    for (const m of block.metrics) if (m.id === id) return m.label;
  return id;
}

/**
 * Datos elegidos, en el orden del catálogo y sin repetir ni ids
 * desconocidos (p. ej. de una plantilla antigua).
 */
export function normalizeMetricIds(
  values: readonly unknown[]
): ReportMetricId[] {
  const wanted = new Set(values.filter(isReportMetricId));
  return REPORT_METRIC_IDS.filter((id) => wanted.has(id));
}

/** Lee `metricas=a,b,c`; sin parámetro (o nada válido) son todos. */
export function parseMetricParam(value: unknown): ReportMetricId[] {
  if (typeof value !== "string" || !value.trim()) return [...REPORT_METRIC_IDS];
  const picked = normalizeMetricIds(value.split(",").map((v) => v.trim()));
  return picked.length ? picked : [...REPORT_METRIC_IDS];
}

/** Bloques con solo los datos elegidos (los vacíos no aparecen). */
export function blocksFor(metrics: readonly ReportMetricId[]) {
  const wanted = new Set(metrics);
  return REPORT_BLOCKS.map((b) => ({
    id: b.id as ReportBlockId,
    label: b.label as string,
    metrics: b.metrics
      .filter((m) => wanted.has(m.id))
      .map((m) => ({ id: m.id as ReportMetricId, label: m.label as string })),
  })).filter((b) => b.metrics.length > 0);
}
