// Objetivos por etapa (tenisXetapas · RFET): bola roja (Descubrimiento),
// naranja (Desarrollo) y verde (Consolidación), por aspecto del juego.

export const BALLS = [
  {
    id: "roja",
    label: "Roja",
    stage: "Descubrimiento",
    age: "4-6 años",
    color: "#E53935",
  },
  {
    id: "naranja",
    label: "Naranja",
    stage: "Desarrollo",
    age: "6-8 años",
    color: "#FB8C00",
  },
  {
    id: "verde",
    label: "Verde",
    stage: "Consolidación",
    age: "8-10 años",
    color: "#43A047",
  },
] as const;

export type BallId = (typeof BALLS)[number]["id"];

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
};

/**
 * Bola con la que abrir el selector de objetivos de un ejercicio, clase o
 * sesión: su tipo de pelota si es roja, naranja o verde; si no, el primero de
 * sus niveles que sea una de las tres etapas; si no, null.
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
 * tres etapas; si no, la edad (menos de 6 → roja, menos de 8 → naranja, resto
 * → verde); si no hay datos, roja. El monitor siempre puede cambiar de bola.
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
    if (age != null) return age < 6 ? "roja" : age < 8 ? "naranja" : "verde";
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
