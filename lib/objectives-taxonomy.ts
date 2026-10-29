// Objetivos por etapa (tenisXetapas · RFET), por aspecto del juego: bola roja
// (Descubrimiento), naranja (Desarrollo), verde (Consolidación) y, con pelota
// amarilla, Especialización, Precompetición, Competición y Rendimiento. Las
// cuatro etapas amarillas comparten color de pelota, así que cada una es su
// propio catálogo y su id es el de la etapa.

export const BALLS = [
  {
    id: "roja",
    label: "Roja",
    chip: "Roja",
    stage: "Descubrimiento",
    age: "4-6 años",
    color: "#E53935",
  },
  {
    id: "naranja",
    label: "Naranja",
    chip: "Naranja",
    stage: "Desarrollo",
    age: "6-8 años",
    color: "#FB8C00",
  },
  {
    id: "verde",
    label: "Verde",
    chip: "Verde",
    stage: "Consolidación",
    age: "8-10 años",
    color: "#43A047",
  },
  {
    id: "especializacion",
    label: "Amarilla",
    chip: "Especialización",
    stage: "Especialización",
    age: "10-12 años",
    color: "#FFE600",
  },
  {
    id: "precompeticion",
    label: "Amarilla",
    chip: "Precompetición",
    stage: "Precompetición",
    age: "12-14 años",
    color: "#FFE600",
  },
  {
    id: "competicion",
    label: "Amarilla",
    chip: "Competición",
    stage: "Competición",
    age: "14-16 años",
    color: "#FFE600",
  },
  {
    id: "rendimiento",
    label: "Amarilla",
    chip: "Rendimiento",
    stage: "Rendimiento",
    age: "16-18 años",
    color: "#FFE600",
  },
] as const;

export type BallId = (typeof BALLS)[number]["id"];

/**
 * Nombre de un catálogo para textos: "Bola roja", "Bola naranja", "Bola verde"
 * o, en las etapas amarillas, "Bola amarilla · Especialización" (las cuatro
 * comparten pelota y solo se distinguen por la etapa).
 */
export function ballName(id: string): string {
  const b = BALLS.find((x) => x.id === id);
  if (!b) return id;
  const base = `Bola ${b.label.toLowerCase()}`;
  return b.label === "Amarilla" ? `${base} · ${b.stage}` : base;
}

export const ASPECTS = [
  { id: "tecnico", label: "Técnico" },
  { id: "tactico", label: "Táctico" },
  { id: "mental", label: "Mental/cognitivo" },
  { id: "fisico", label: "Físico/movilidad" },
] as const;

export type AspectId = (typeof ASPECTS)[number]["id"];

export type ObjectiveItem = {
  id: string;
  code: string;
  ball: BallId;
  aspect: AspectId;
  block: string;
  title: string;
  criterion: string | null;
  source: string;
  sortOrder: number;
  /** Objetivo de salida de su subcategoría (va el último y destacado). */
  isFinal: boolean;
  achieved: boolean;
  achievedAt: string | null;
  /** De quién es el objetivo: catálogo base o creado por un club, monitor o alumno. */
  scope: ObjectiveScope;
  /** Oculto para este alumno (solo llega al cliente en modo personalizar). */
  hidden: boolean;
  /** Ámbitos en los que hay un ajuste (título, criterio u ocultar) sobre este objetivo. */
  overriddenAt: ObjectiveScope[];
};

/** "base" = catálogo de Ten Planner; el resto, ámbito de quien lo crea o ajusta. */
export type ObjectiveScope = "base" | "club" | "coach" | "student";

const LEVEL_TO_BALL: Record<string, BallId> = {
  descubrimiento: "roja",
  desarrollo: "naranja",
  consolidacion: "verde",
  especializacion: "especializacion",
  precompeticion: "precompeticion",
  competicion: "competicion",
  rendimiento: "rendimiento",
};

/**
 * Bola con la que abrir el selector de objetivos de un ejercicio, clase o
 * sesión: su tipo de pelota si es roja, naranja o verde; si no, el primero de
 * sus niveles que sea una de las etapas (la pelota amarilla no basta para
 * saber cuál de las cuatro etapas amarillas es); si no, null.
 */
export function ballFromLevels(
  levels: Iterable<string> | null | undefined,
  pelota?: string | null
): BallId | null {
  if (pelota === "roja" || pelota === "naranja" || pelota === "verde")
    return pelota;
  for (const l of levels ?? []) if (LEVEL_TO_BALL[l]) return LEVEL_TO_BALL[l];
  return null;
}

function ageFrom(birthDate: string, today: Date) {
  const d = new Date(birthDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

/**
 * Bola con la que se abre el checklist de un alumno: su nivel si es una de las
 * etapas; si no, la edad (menos de 6 → roja, 8 → naranja, 10 → verde,
 * 12 → Especialización, 14 → Precompetición, 16 → Competición, 19 →
 * Rendimiento; los adultos, sin etapa por edad, empiezan en verde); si no hay
 * datos, roja. El monitor siempre puede cambiar de bola.
 */
export function defaultBallForStudent(
  playerLevel: string | null,
  birthDate: string | null,
  today = new Date()
): BallId {
  if (playerLevel && LEVEL_TO_BALL[playerLevel])
    return LEVEL_TO_BALL[playerLevel];
  if (birthDate) {
    const age = ageFrom(birthDate, today);
    if (age != null) {
      if (age < 6) return "roja";
      if (age < 8) return "naranja";
      if (age < 10) return "verde";
      if (age < 12) return "especializacion";
      if (age < 14) return "precompeticion";
      if (age < 16) return "competicion";
      if (age < 19) return "rendimiento";
      return "verde";
    }
  }
  return "roja";
}

export type LevelSummary = {
  ball: BallId;
  stage: string;
  total: number;
  /** "complete": todos conseguidos; "partial": quedan objetivos pendientes. */
  status: "complete" | "partial";
  achieved: ObjectiveItem[];
  pending: ObjectiveItem[];
  /** Objetivos marcados como conseguidos dentro del periodo indicado. */
  newInPeriod: number;
};

/**
 * Resumen por nivel para el informe del alumno.
 * - Nivel con todos los objetivos conseguidos → "complete" (solo se menciona).
 * - Nivel con pendientes → "partial", con conseguidos y pendientes; se incluye
 *   si el alumno ya tiene alguno conseguido o si es el primer nivel sin
 *   completar (el nivel en el que está trabajando).
 * - El resto de niveles (sin ningún objetivo conseguido y posteriores al nivel
 *   actual) no aparecen.
 */
export function summarizeObjectivesByLevel(
  items: ObjectiveItem[],
  period?: { from: Date; to: Date }
): LevelSummary[] {
  const out: LevelSummary[] = [];
  let firstIncompleteSeen = false;

  for (const b of BALLS) {
    const list = items
      .filter((i) => i.ball === b.id)
      .sort((a, c) => a.sortOrder - c.sortOrder);
    if (list.length === 0) continue;

    const achieved = list.filter((i) => i.achieved);
    const pending = list.filter((i) => !i.achieved);
    const newInPeriod = period
      ? achieved.filter((i) => {
          if (!i.achievedAt) return false;
          const t = new Date(i.achievedAt).getTime();
          return t >= period.from.getTime() && t <= period.to.getTime();
        }).length
      : 0;

    if (pending.length === 0) {
      out.push({
        ball: b.id,
        stage: b.stage,
        total: list.length,
        status: "complete",
        achieved,
        pending,
        newInPeriod,
      });
      continue;
    }

    const isCurrent = !firstIncompleteSeen;
    firstIncompleteSeen = true;
    if (achieved.length === 0 && !isCurrent) continue;
    out.push({
      ball: b.id,
      stage: b.stage,
      total: list.length,
      status: "partial",
      achieved,
      pending,
      newInPeriod,
    });
  }
  return out;
}
