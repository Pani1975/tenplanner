import { NIVELES } from "@/lib/exercise-taxonomy";

/**
 * Estadísticas de la cartera de alumnos de un club (o de un monitor). Función
 * pura: recibe filas ya cargadas y devuelve las cifras listas para pintar,
 * tanto en la página como en el PDF.
 */

export interface StatsStudent {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  birthDate: string | null;
  playerLevel: string | null;
  locality: string | null;
  localityLat: number | null;
  localityLng: number | null;
}

export interface StatsGroup {
  id: string;
  name: string;
}

export interface StatsMembership {
  groupId: string;
  studentId: string;
}

export interface LevelStat {
  id: string;
  label: string;
  /** Tramo de edad de la etapa, p. ej. "4-6 años". */
  edad: string | null;
  color: string;
  count: number;
}

export interface AgeBand {
  label: string;
  count: number;
}

export interface OriginPoint {
  name: string;
  lat: number;
  lng: number;
  count: number;
}

export interface StudentsStats {
  totalStudents: number;
  groupCount: number;
  /** Grupos con más alumnos primero. */
  groupSizes: { id: string; name: string; count: number }[];
  levels: LevelStat[];
  /** Alumnos que pertenecen a algún grupo (base de las estadísticas de edad). */
  groupedStudents: number;
  oldest: { name: string; age: number; groupName: string | null } | null;
  ageBands: AgeBand[];
  /** Alumnos en grupos sin fecha de nacimiento (no entran en las edades). */
  groupedWithoutBirthDate: number;
  /** Localidades con coordenadas, para el mapa. */
  origins: OriginPoint[];
  /** Alumnos con localidad pero sin poder situarla en el mapa. */
  unlocatedStudents: number;
  withoutLocality: number;
}

const OTHER_COLOR = "#9CA3AF";

const AGE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Menos de 7", min: 0, max: 6 },
  { label: "7-8", min: 7, max: 8 },
  { label: "9-10", min: 9, max: 10 },
  { label: "11-12", min: 11, max: 12 },
  { label: "13-14", min: 13, max: 14 },
  { label: "15-16", min: 15, max: 16 },
  { label: "17-18", min: 17, max: 18 },
  { label: "19 o más", min: 19, max: 120 },
];

/** Edad en años cumplidos a `now`; null si la fecha no es válida o es absurda. */
export function ageOn(birthDate: string | null, now: Date): number | null {
  if (!birthDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < m ||
    (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

/** "1 alumno" / "3 alumnos". */
export function studentsLabel(count: number) {
  return `${count} alumno${count === 1 ? "" : "s"}`;
}

function normalizeLocality(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function buildStudentsStats({
  students,
  groups,
  memberships,
  now = new Date(),
}: {
  students: StatsStudent[];
  groups: StatsGroup[];
  memberships: StatsMembership[];
  now?: Date;
}): StudentsStats {
  const studentById = new Map(students.map((s) => [s.id, s]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  // Solo cuentan las pertenencias entre alumnos y grupos visibles.
  const valid = memberships.filter(
    (m) => studentById.has(m.studentId) && groupById.has(m.groupId)
  );

  const groupSizes = groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      count: valid.filter((m) => m.groupId === g.id).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // Niveles: las etapas de la etiqueta de nivel, más "Otros" (escalas
  // antiguas) y "Sin nivel" solo si hay alumnos en ellos.
  const knownIds = new Set<string>(NIVELES.map((n) => n.id));
  const levels: LevelStat[] = NIVELES.map((n) => ({
    id: n.id,
    label: n.label,
    edad: n.edad,
    color: n.color,
    count: students.filter((s) => s.playerLevel === n.id).length,
  }));
  const others = students.filter(
    (s) => s.playerLevel !== null && !knownIds.has(s.playerLevel)
  ).length;
  const noLevel = students.filter((s) => s.playerLevel === null).length;
  if (others > 0) {
    levels.push({
      id: "otros",
      label: "Otros niveles",
      edad: null,
      color: OTHER_COLOR,
      count: others,
    });
  }
  if (noLevel > 0) {
    levels.push({
      id: "sin_nivel",
      label: "Sin nivel",
      edad: null,
      color: OTHER_COLOR,
      count: noLevel,
    });
  }
  // "Rendimiento" no es un nivel que se pueda asignar a un alumno: solo se
  // muestra si algún dato antiguo lo tuviera.
  const visibleLevels = levels.filter(
    (l) => l.id !== "rendimiento" || l.count > 0
  );

  // Edades: solo alumnos que están en algún grupo.
  const groupedIds = [...new Set(valid.map((m) => m.studentId))];
  const bands: AgeBand[] = AGE_BANDS.map((b) => ({ label: b.label, count: 0 }));
  let oldest: StudentsStats["oldest"] = null;
  let groupedWithoutBirthDate = 0;
  for (const id of groupedIds) {
    const student = studentById.get(id)!;
    const age = ageOn(student.birthDate, now);
    if (age === null) {
      groupedWithoutBirthDate += 1;
      continue;
    }
    const idx = AGE_BANDS.findIndex((b) => age >= b.min && age <= b.max);
    if (idx >= 0) bands[idx].count += 1;
    if (!oldest || age > oldest.age) {
      const firstGroup = valid.find((m) => m.studentId === id);
      oldest = {
        name: student.name,
        age,
        groupName: firstGroup
          ? (groupById.get(firstGroup.groupId)?.name ?? null)
          : null,
      };
    }
  }

  // Procedencia: un punto por localidad (sin distinguir mayúsculas ni tildes).
  const byLocality = new Map<
    string,
    { name: string; count: number; lats: number[]; lngs: number[] }
  >();
  let withoutLocality = 0;
  for (const s of students) {
    const name = s.locality?.trim();
    if (!name) {
      withoutLocality += 1;
      continue;
    }
    const key = normalizeLocality(name);
    const entry = byLocality.get(key) ?? { name, count: 0, lats: [], lngs: [] };
    entry.count += 1;
    if (s.localityLat !== null && s.localityLng !== null) {
      entry.lats.push(s.localityLat);
      entry.lngs.push(s.localityLng);
    }
    byLocality.set(key, entry);
  }
  const origins: OriginPoint[] = [];
  let unlocatedStudents = 0;
  for (const entry of byLocality.values()) {
    if (entry.lats.length === 0) {
      unlocatedStudents += entry.count;
      continue;
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    origins.push({
      name: entry.name,
      lat: avg(entry.lats),
      lng: avg(entry.lngs),
      count: entry.count,
    });
  }
  origins.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    totalStudents: students.length,
    groupCount: groups.length,
    groupSizes,
    levels: visibleLevels,
    groupedStudents: groupedIds.length,
    oldest,
    ageBands: bands,
    groupedWithoutBirthDate,
    origins,
    unlocatedStudents,
    withoutLocality,
  };
}
