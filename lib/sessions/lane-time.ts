// Minutos por alumno en un bloque de dos pistas con turnos.
//
// Ambas pistas duran lo que el bloque (la más larga). Un elemento puede
// hacerse «por turnos»: los alumnos pasan de turnSize en turnSize (por
// defecto de uno en uno) y cada uno hace turnMinutes. El resto está en la
// otra pista, haciendo lo que no es por turnos.
//
// Ejemplo: bloque de 20 min y 4 alumnos. Pista 1: peloteo por turnos de
// 5 min (4 × 5 = 20). Pista 2: saque 20 min seguidos. Cada alumno hace
// 5 min de peloteo y 20 − 5 = 15 de saque.

export type LaneTimeItem = {
  label: string;
  court: 1 | 2;
  minutes: number;
  /** Por turnos: minutos de cada alumno (null = todos a la vez). */
  turnMinutes?: number | null;
  /** De cuántos en cuántos pasan (por defecto 1). */
  turnSize?: number | null;
};

export type StudentMinutes = {
  label: string;
  minutes: number;
  /** "turno": lo hace cada alumno en su turno; "resto": el tiempo que queda. */
  kind: "turno" | "resto";
};

export type BlockStudentMinutes = {
  /** Duración del bloque: la de la pista más larga. */
  blockMinutes: number;
  perStudent: StudentMinutes[];
  warnings: string[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function blockStudentMinutes(
  items: LaneTimeItem[],
  students: number
): BlockStudentMinutes {
  const laneTotal = (court: 1 | 2) =>
    items
      .filter((it) => it.court === court)
      .reduce((sum, it) => sum + it.minutes, 0);
  const blockMinutes = Math.max(laneTotal(1), laneTotal(2));

  const turnItems = items.filter((it) => (it.turnMinutes ?? 0) > 0);
  if (turnItems.length === 0) {
    return { blockMinutes, perStudent: [], warnings: [] };
  }

  const warnings: string[] = [];
  const perStudent: StudentMinutes[] = [];

  let turnSum = 0;
  for (const it of turnItems) {
    const turn = it.turnMinutes as number;
    const size = Math.max(1, it.turnSize ?? 1);
    turnSum += turn;
    perStudent.push({ label: it.label, minutes: turn, kind: "turno" });

    if (students > 0) {
      const needed = Math.ceil(students / size) * turn;
      if (needed > it.minutes) {
        warnings.push(
          `«${it.label}»: ${students} alumnos de ${size} en ${size}, ${turn} min cada uno, son ${needed} min y la actividad dura ${it.minutes}.`
        );
      } else if (needed < it.minutes) {
        warnings.push(
          `«${it.label}»: ${students} alumnos de ${size} en ${size}, ${turn} min cada uno, son ${needed} min y la actividad dura ${it.minutes}: sobran ${it.minutes - needed} min.`
        );
      }
    }
  }

  const rest = blockMinutes - turnSum;
  if (rest < 0) {
    warnings.push(
      `Cada alumno pasa ${turnSum} min en turnos y el bloque dura ${blockMinutes}.`
    );
  } else {
    const others = items.filter((it) => !((it.turnMinutes ?? 0) > 0));
    const othersTotal = others.reduce((sum, it) => sum + it.minutes, 0);
    if (others.length > 0 && othersTotal > 0) {
      for (const it of others) {
        perStudent.push({
          label: it.label,
          minutes: round1((it.minutes / othersTotal) * rest),
          kind: "resto",
        });
      }
    }
  }

  return { blockMinutes, perStudent, warnings };
}
