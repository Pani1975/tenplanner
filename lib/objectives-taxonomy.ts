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
};

const LEVEL_TO_BALL: Record<string, BallId> = {
  descubrimiento: "roja",
  desarrollo: "naranja",
  consolidacion: "verde",
};

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
