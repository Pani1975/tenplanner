import { NIVEL_LEGACY, NIVELES } from "@/lib/exercise-taxonomy";
import { HOW_FOUND_OPTIONS, type HowFound } from "@/lib/students/membership";

// Importación de alumnos desde un Excel o CSV (Modo gestión del club). Este
// módulo no usa IA: reconoce las columnas por su cabecera y normaliza cada
// valor ("M", "Chico" → masculino; "15/03/2014" → 2014-03-15…). Lo usan el
// navegador (vista previa) y el servidor (que vuelve a validarlo todo).

export const IMPORT_MAX_ROWS = 2000;

export const IMPORT_FIELDS = [
  {
    key: "name",
    label: "Nombre",
    required: true,
    aliases: [
      "nombre",
      "nombre y apellidos",
      "nombre completo",
      "alumno",
      "alumna",
      "jugador",
      "jugadora",
      "nombre alumno",
      "name",
    ],
    example: "Lucía Pérez García",
  },
  {
    key: "email",
    label: "Email",
    aliases: ["email", "e-mail", "correo", "correo electronico", "mail"],
    example: "lucia@ejemplo.com",
  },
  {
    key: "phone",
    label: "Teléfono",
    aliases: ["telefono", "tlf", "tel", "movil", "celular", "phone"],
    example: "600123456",
  },
  {
    key: "birthDate",
    label: "Fecha de nacimiento",
    aliases: [
      "fecha de nacimiento",
      "fecha nacimiento",
      "f nacimiento",
      "f nac",
      "nacimiento",
      "fecha nac",
      "birthdate",
      "cumpleanos",
    ],
    example: "15/03/2014",
  },
  {
    key: "gender",
    label: "Género",
    aliases: ["genero", "sexo", "gender"],
    example: "Femenino",
  },
  {
    key: "dominantHand",
    label: "Mano dominante",
    aliases: ["mano", "mano dominante", "lateralidad", "diestro zurdo"],
    example: "Diestro",
  },
  {
    key: "playerLevel",
    label: "Nivel",
    aliases: ["nivel", "etapa", "categoria", "level"],
    example: "Consolidación",
  },
  {
    key: "locality",
    label: "Localidad",
    aliases: [
      "localidad",
      "municipio",
      "ciudad",
      "poblacion",
      "procedencia",
      "pueblo",
    ],
    example: "Telde",
  },
  {
    key: "preferredSchedule",
    label: "Horario preferente",
    aliases: ["horario", "horario preferente", "disponibilidad"],
    example: "Martes y jueves por la tarde",
  },
  {
    key: "joinedAt",
    label: "Fecha de alta",
    aliases: [
      "fecha de alta",
      "fecha alta",
      "alta",
      "fecha inscripcion",
      "inscripcion",
      "fecha de inscripcion",
    ],
    example: "01/09/2025",
  },
  {
    key: "howFound",
    label: "Cómo nos conoció",
    aliases: [
      "como nos conocio",
      "como nos conocieron",
      "como nos conoce",
      "origen",
      "canal",
      "fuente",
    ],
    example: "Redes sociales",
  },
  {
    key: "group",
    label: "Grupo",
    aliases: ["grupo", "grupo de clase", "clase", "equipo", "group"],
    example: "Verde martes",
  },
  {
    key: "heightCm",
    label: "Altura (cm)",
    aliases: ["altura", "altura cm", "estatura", "talla"],
    example: "140",
  },
  {
    key: "weightKg",
    label: "Peso (kg)",
    aliases: ["peso", "peso kg"],
    example: "35",
  },
  {
    key: "notes",
    label: "Notas",
    aliases: ["notas", "observaciones", "comentarios", "nota"],
    example: "Alergia al polen",
  },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

/** Valores ya normalizados de una fila, listos para la API. */
export interface ImportStudent {
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: "male" | "female" | "other" | null;
  dominantHand: "left" | "right" | null;
  playerLevel: string | null;
  locality: string | null;
  preferredSchedule: string | null;
  joinedAt: string | null;
  howFound: HowFound | null;
  howFoundDetail: string | null;
  group: string | null;
  heightCm: number | null;
  weightKg: number | null;
  notes: string | null;
}

export interface ImportRow {
  /** Número de fila en la hoja (1 = cabecera). */
  line: number;
  student: ImportStudent;
  /** Impiden importar la fila. */
  errors: string[];
  /** Datos que no se entendieron y se han dejado vacíos. */
  warnings: string[];
}

export type CellValue = string | number | boolean | Date | null | undefined;

// ─── cabeceras ─────────────────────────────────────────────────────────────

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Relaciona cada columna de la hoja con un campo de la ficha por el texto de
 * su cabecera. Cada campo se asigna a una sola columna (la primera).
 */
export function guessMapping(headers: CellValue[]): (ImportFieldKey | null)[] {
  const used = new Set<ImportFieldKey>();
  return headers.map((h) => {
    const text = normalizeText(cellText(h));
    if (!text) return null;
    const field =
      IMPORT_FIELDS.find(
        (f) =>
          !used.has(f.key) && (f.aliases as readonly string[]).includes(text)
      ) ??
      IMPORT_FIELDS.find(
        (f) =>
          !used.has(f.key) &&
          (f.aliases as readonly string[]).some(
            (a) => a.length >= 4 && text.startsWith(a)
          )
      );
    if (!field) return null;
    used.add(field.key);
    return field.key;
  });
}

// ─── valores ───────────────────────────────────────────────────────────────

export function cellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return isoFromDate(value) ?? "";
  return String(value).trim().replace(/\s+/g, " ");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function isoFromDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  // Las fechas de Excel llegan a medianoche UTC.
  return validYmd(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

/**
 * Fecha en YYYY-MM-DD a partir de una celda: fecha de Excel, número de
 * serie de Excel, "15/03/2014", "15-3-14", "15.03.2014" o "2014-03-15".
 * Siempre día/mes/año (formato español). `now` decide el siglo de los años
 * de dos cifras.
 */
export function parseDateCell(
  value: CellValue,
  now = new Date()
): string | null {
  if (value instanceof Date) return isoFromDate(value);
  if (typeof value === "number") {
    if (value < 1 || value > 80000) return null;
    // Serie de Excel: días desde el 30/12/1899.
    return isoFromDate(
      new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000)
    );
  }
  const text = cellText(value);
  if (!text) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (m) {
    let year = Number(m[3]);
    if (m[3].length === 2) {
      const yy = now.getUTCFullYear() % 100;
      year += year <= yy ? 2000 : 1900;
    }
    return validYmd(year, Number(m[2]), Number(m[1]));
  }
  if (/^\d{5}$/.test(text)) return parseDateCell(Number(text), now);
  return null;
}

const GENDER_WORDS: Record<string, "male" | "female" | "other"> = {
  m: "male",
  h: "male",
  v: "male",
  masculino: "male",
  hombre: "male",
  chico: "male",
  nino: "male",
  varon: "male",
  male: "male",
  masc: "male",
  f: "female",
  femenino: "female",
  mujer: "female",
  chica: "female",
  nina: "female",
  female: "female",
  fem: "female",
  otro: "other",
  otra: "other",
  other: "other",
  x: "other",
};

export function parseGender(value: CellValue) {
  const t = normalizeText(cellText(value));
  return t ? (GENDER_WORDS[t] ?? null) : null;
}

const HAND_WORDS: Record<string, "left" | "right"> = {
  d: "right",
  diestro: "right",
  diestra: "right",
  derecha: "right",
  derecho: "right",
  right: "right",
  r: "right",
  i: "left",
  z: "left",
  zurdo: "left",
  zurda: "left",
  izquierda: "left",
  izquierdo: "left",
  left: "left",
  l: "left",
};

export function parseHand(value: CellValue) {
  const t = normalizeText(cellText(value));
  return t ? (HAND_WORDS[t] ?? null) : null;
}

/** Niveles que se pueden asignar a un alumno (ids de la ficha). */
const STUDENT_LEVELS: { id: string; label: string }[] = [
  ...NIVELES.filter((n) => n.id !== "rendimiento").map((n) => ({
    id: n.id as string,
    label: n.label as string,
  })),
  ...NIVEL_LEGACY.map((n) => ({
    id: n.id as string,
    label: n.label as string,
  })),
];

export function parseLevel(value: CellValue): string | null {
  const t = normalizeText(cellText(value));
  if (!t) return null;
  const found = STUDENT_LEVELS.find(
    (l) =>
      normalizeText(l.id.replace(/_/g, " ")) === t ||
      normalizeText(l.label) === t
  );
  return found?.id ?? null;
}

const HOW_FOUND_KEYWORDS: [RegExp, HowFound][] = [
  [/recomend|amig|familia|conocid|boca/, "recomendacion"],
  [/redes|instagram|facebook|tiktok|twitter|whatsapp|social/, "redes_sociales"],
  [/web|google|internet|busqueda|pagina/, "web"],
  [/pasaba|paso por|club|pista|cartel|vecin/, "pasaba_por_club"],
  [/colegio|escuela|extraescolar|instituto|ampa/, "colegio"],
  [/evento|torneo|jornada|puertas abiertas|campus|campamento/, "evento"],
  [/antiguo|ya era|volvio|vuelve|repite/, "antiguo_alumno"],
];

/** "Instagram" → redes sociales (y el texto original queda como detalle). */
export function parseHowFound(value: CellValue): {
  howFound: HowFound | null;
  detail: string | null;
} {
  const raw = cellText(value);
  const t = normalizeText(raw);
  if (!t) return { howFound: null, detail: null };
  const exact = HOW_FOUND_OPTIONS.find(
    (o) =>
      normalizeText(o.label) === t ||
      normalizeText(o.id.replace(/_/g, " ")) === t
  );
  if (exact) return { howFound: exact.id, detail: null };
  const byKeyword = HOW_FOUND_KEYWORDS.find(([re]) => re.test(t));
  return {
    howFound: byKeyword ? byKeyword[1] : "otro",
    detail: raw.slice(0, 255),
  };
}

function parseInteger(
  value: CellValue,
  min: number,
  max: number
): number | null {
  const text = cellText(value).replace(",", ".");
  if (!text) return null;
  const n = Number(text.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Clave para detectar alumnos repetidos: nombre + fecha de nacimiento. */
export function duplicateKey(name: string, birthDate: string | null): string {
  return `${normalizeText(name)}|${birthDate ?? ""}`;
}

/**
 * Convierte las filas de la hoja (la primera es la cabecera) en alumnos
 * normalizados con sus errores y avisos. Ignora las filas vacías y marca
 * como error las repetidas dentro del propio archivo.
 */
export function buildImportRows(
  sheet: CellValue[][],
  mapping: (ImportFieldKey | null)[],
  now = new Date()
): ImportRow[] {
  const col = (key: ImportFieldKey) => mapping.indexOf(key);
  const get = (row: CellValue[], key: ImportFieldKey): CellValue => {
    const i = col(key);
    return i >= 0 ? row[i] : null;
  };
  const today = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;

  const out: ImportRow[] = [];
  const seen = new Map<string, number>();
  const seenEmail = new Map<string, number>();

  sheet.slice(1).forEach((row, i) => {
    if (row.every((c) => cellText(c) === "")) return;
    const line = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const text = (key: ImportFieldKey, max: number) => {
      const t = cellText(get(row, key));
      if (t.length > max)
        warnings.push(`${fieldLabel(key)} recortado a ${max} caracteres`);
      return t ? t.slice(0, max) : null;
    };
    const understood = <T>(key: ImportFieldKey, parsed: T | null): T | null => {
      if (parsed === null && cellText(get(row, key)) !== "") {
        warnings.push(
          `${fieldLabel(key)} «${cellText(get(row, key))}» no se entiende: se deja vacío`
        );
      }
      return parsed;
    };

    const name = cellText(get(row, "name")).slice(0, 255);
    if (!name) errors.push("Falta el nombre");

    let email = cellText(get(row, "email")).toLowerCase() || null;
    if (email && (!EMAIL.test(email) || email.length > 255)) {
      warnings.push(`Email «${email}» no válido: se deja vacío`);
      email = null;
    }

    let birthDate = understood(
      "birthDate",
      parseDateCell(get(row, "birthDate"), now)
    );
    if (birthDate) {
      const age = now.getUTCFullYear() - Number(birthDate.slice(0, 4));
      if (birthDate > today || age < 2 || age > 100) {
        warnings.push(
          "La fecha de nacimiento parece incorrecta: se deja vacía"
        );
        birthDate = null;
      }
    }

    let joinedAt = understood(
      "joinedAt",
      parseDateCell(get(row, "joinedAt"), now)
    );
    if (joinedAt && joinedAt > today) {
      warnings.push("La fecha de alta es futura: se usa la de hoy");
      joinedAt = null;
    }

    const how = parseHowFound(get(row, "howFound"));

    const student: ImportStudent = {
      name,
      email,
      phone: text("phone", 32),
      birthDate,
      gender: understood("gender", parseGender(get(row, "gender"))),
      dominantHand: understood(
        "dominantHand",
        parseHand(get(row, "dominantHand"))
      ),
      playerLevel: understood(
        "playerLevel",
        parseLevel(get(row, "playerLevel"))
      ),
      locality: text("locality", 120),
      preferredSchedule: text("preferredSchedule", 500),
      joinedAt,
      howFound: how.howFound,
      howFoundDetail: how.detail,
      group: text("group", 255),
      heightCm: understood(
        "heightCm",
        parseInteger(get(row, "heightCm"), 80, 230)
      ),
      weightKg: understood(
        "weightKg",
        parseInteger(get(row, "weightKg"), 12, 200)
      ),
      notes: text("notes", 2000),
    };

    if (name) {
      const key = duplicateKey(name, birthDate);
      const prev = seen.get(key);
      if (prev)
        errors.push(`Repetido en el archivo (igual que la fila ${prev})`);
      else seen.set(key, line);
      if (email) {
        const prevEmail = seenEmail.get(email);
        if (prevEmail && !prev)
          errors.push(
            `Email repetido en el archivo (igual que la fila ${prevEmail})`
          );
        else if (!prevEmail) seenEmail.set(email, line);
      }
    }

    out.push({ line, student, errors, warnings });
  });

  return out;
}

export function fieldLabel(key: ImportFieldKey): string {
  return IMPORT_FIELDS.find((f) => f.key === key)?.label ?? key;
}

/**
 * Lee un CSV (separado por punto y coma, coma o tabulador, el que más
 * aparezca en la primera línea), con comillas y saltos de línea dentro de
 * las celdas. Quita el BOM que añade Excel.
 */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = [";", ",", "\t"]
    .map((d) => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
