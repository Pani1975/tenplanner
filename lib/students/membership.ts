/**
 * Alta y baja de un alumno en la escuela: cómo nos conoció y, si se va, cuándo
 * y por qué. Las claves se guardan en students.how_found y
 * students.left_reason; el detalle es texto libre opcional.
 */

export const HOW_FOUND_OPTIONS = [
  { id: "recomendacion", label: "Recomendación de un amigo o familiar" },
  { id: "redes_sociales", label: "Redes sociales" },
  { id: "web", label: "Búsqueda en internet o web del club" },
  { id: "pasaba_por_club", label: "Pasaba por el club o las pistas" },
  { id: "colegio", label: "Colegio o actividad extraescolar" },
  { id: "evento", label: "Evento, torneo o jornada de puertas abiertas" },
  { id: "antiguo_alumno", label: "Ya había sido alumno" },
  { id: "otro", label: "Otro" },
] as const;

export type HowFound = (typeof HOW_FOUND_OPTIONS)[number]["id"];

export const HOW_FOUND_IDS = HOW_FOUND_OPTIONS.map((o) => o.id) as [
  HowFound,
  ...HowFound[],
];

export const LEFT_REASON_OPTIONS = [
  { id: "horario", label: "Horario o disponibilidad" },
  { id: "economico", label: "Motivos económicos" },
  { id: "cambio_domicilio", label: "Cambio de domicilio" },
  { id: "lesion", label: "Lesión o salud" },
  { id: "pierde_interes", label: "Pierde el interés" },
  { id: "otro_club", label: "Se va a otro club o academia" },
  { id: "fin_etapa", label: "Fin de etapa (estudios, edad…)" },
  { id: "otro", label: "Otro" },
] as const;

export type LeftReason = (typeof LEFT_REASON_OPTIONS)[number]["id"];

export const LEFT_REASON_IDS = LEFT_REASON_OPTIONS.map((o) => o.id) as [
  LeftReason,
  ...LeftReason[],
];

export function howFoundLabel(id: string | null | undefined) {
  if (!id) return null;
  return HOW_FOUND_OPTIONS.find((o) => o.id === id)?.label ?? null;
}

export function leftReasonLabel(id: string | null | undefined) {
  if (!id) return null;
  return LEFT_REASON_OPTIONS.find((o) => o.id === id)?.label ?? null;
}
