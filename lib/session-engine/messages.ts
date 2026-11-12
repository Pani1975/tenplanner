// Textos del motor y de "Hoy toca", en castellano. Separados del código
// para poder traducirlos más adelante.

import type { Focus, Golpe, Intensity, LevelSource, SlotKind } from "./types";

export const GOLPE_LABELS: Record<Golpe, string> = {
  derecha: "Derecha",
  reves: "Revés",
  saque: "Saque",
  resto: "Resto",
  volea: "Volea",
  remate: "Remate",
  globo: "Globo",
  dejada: "Dejada",
};

export const FOCUS_LABELS: Record<Focus, string> = {
  auto: "Automático",
  ...GOLPE_LABELS,
  tactica: "Táctica",
  fisico: "Físico",
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
  suave: "Suave",
  media: "Media",
  alta: "Alta",
};

export const SLOT_LABELS: Record<SlotKind, string> = {
  activation: "Calentamiento",
  tecnica: "Técnica",
  tactica: "Táctica",
  puntos: "Puntos",
  cooldown: "Vuelta a la calma",
};

export const BLOCK_TITLES = {
  activation: "Bloque inicial",
  main: "Bloque principal",
  cooldown: "Bloque final",
} as const;

const RELAX_TEXT: Record<number, string> = {
  1: "un nivel por encima o por debajo",
  2: "sin exigir el golpe",
  3: "con más margen de duración",
  4: "hasta dos niveles de distancia",
  5: "cualquier ejercicio de esa fase",
};

export function explainLevel(levelLabel: string, source: LevelSource): string {
  if (source === "asistentes")
    return `Nivel ${levelLabel}: el de la mayoría de los que vienen.`;
  if (source === "grupo")
    return `Nivel ${levelLabel}: el nivel por defecto del grupo (los que vienen no tienen nivel en su ficha).`;
  return `Nivel ${levelLabel}: nadie tiene nivel en su ficha y el grupo no tiene nivel por defecto.`;
}

export function explainAutoFocus(
  focusLabel: string,
  reason: "menos" | "turno"
): string {
  return reason === "menos"
    ? `Automático: ${focusLabel}, el golpe que menos ha trabajado el grupo en las últimas sesiones.`
    : `Automático: ${focusLabel}, por turno (aún no hay sesiones completadas del grupo).`;
}

export function explainIntensity(intensity: Intensity): string {
  if (intensity === "suave")
    return "Intensidad suave: menos minutos de puntos y ejercicios cooperativos.";
  if (intensity === "alta")
    return "Intensidad alta: más minutos de puntos y ejercicios competitivos.";
  return "Intensidad media: preferencia por ejercicios de reto.";
}

export function explainRelax(slotLabel: string, step: number): string {
  return `${slotLabel}: no había bastantes ejercicios exactos; se ha buscado ${RELAX_TEXT[step] ?? "con menos filtros"}.`;
}

/** Textos de la tarjeta "Hoy toca" del panel. */
export const HOY_TOCA = {
  kicker: "Hoy toca",
  title: "Monta la clase en un minuto",
  comingToday: "Hoy vienen",
  duration: "Duración",
  intensity: "Intensidad",
  focus: "Foco",
  another: "Otra propuesta",
  save: "Guardar sesión",
  saving: "Guardando…",
  loading: "Montando la clase…",
  easier: "Más fácil",
  harder: "Más difícil",
  change: "Cambiar",
  pin: "Fijar",
  unpin: "Quitar fijado",
  up: "Subir",
  down: "Bajar",
  remove: "Quitar",
  lessMin: "Un minuto menos",
  moreMin: "Un minuto más",
  minutesOf: (sum: number, total: number) =>
    sum === total ? `${sum} min` : `${sum} de ${total} min`,
  students: (n: number, total: number) => `${n} de ${total}`,
  noGroups:
    "Para que el panel te monte la clase, pon los días de clase a tus grupos (en la ficha de cada grupo).",
  goGroups: "Ir a grupos",
  alreadyHave: (group: string) =>
    `Ya tienes la sesión de ${group} para este entreno.`,
  openSession: "Abrir sesión",
  noExercises: "No hay ejercicios de este deporte para montar la clase.",
  error: "No se pudo montar la clase. Inténtalo de nuevo.",
  saveError: "No se pudo guardar la sesión.",
  noStudents: "Este grupo aún no tiene alumnos.",
} as const;

export const REPEATED_WARNING =
  "Aviso: algún ejercicio se repite de las 3 últimas sesiones porque no había otro que encajara.";
