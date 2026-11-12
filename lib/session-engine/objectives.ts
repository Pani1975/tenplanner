// Objetivos de la sesión → lo que Ten Planner entiende de ellos.
// Los objetivos son texto (uno por línea): cargados del catálogo del club
// (por defecto, el de Ten Planner) o escritos por el monitor ("Mejorar el
// control de la derecha"). Se reconocen con el mismo vocabulario que usan
// las fichas de los ejercicios: golpes, aspectos, parámetros, situaciones y
// carácter competitivo. Lo que no se reconoce se usa como texto.

import {
  normalizeSearchText,
  stemSearchWord,
} from "@/lib/exercises/search-text";
import type { Golpe } from "./types";

export type ObjectiveTags = {
  golpes: Golpe[];
  /** tecnica | tactica | fisico | mental (como exercises.aspectos_juego). */
  aspectos: string[];
  /** direccion | profundidad | altura | velocidad (exercises.parametros). */
  parametros: string[];
  /** ataque | defensa | neutra (exercises.situacion_juego). */
  situaciones: string[];
  /** Pide puntos o competir (exercises.caracter "competitivo"). */
  competitivo: boolean;
};

export type ObjectiveFocus = ObjectiveTags & {
  /** Raíces de las palabras con contenido, para compararlas con el texto de las fichas. */
  keywords: string[];
};

export type ObjectiveLine = ObjectiveTags & {
  text: string;
  /** Si Ten Planner ha reconocido algo de la línea. */
  recognized: boolean;
};

// Raíces: se buscan como inicio de palabra ("volea" encuentra "voleas").
const GOLPE_KEYS: [Golpe, string[]][] = [
  ["saque", ["saque", "servicio", "servir", "sacar"]],
  ["resto", ["resto", "restar", "devolucion"]],
  ["volea", ["volea"]],
  ["remate", ["remate", "rematar", "smash"]],
  ["globo", ["globo"]],
  ["dejada", ["dejada"]],
  ["derecha", ["derecha", "drive"]],
  ["reves", ["reves"]],
];

const ASPECT_KEYS: [string, string[]][] = [
  [
    "tecnica",
    [
      "tecnica",
      "tecnico",
      "golpeo",
      "golpear",
      "empunadura",
      "peloteo",
      "pelotear",
      "swing",
    ],
  ],
  [
    "tactica",
    [
      "tactica",
      "tactico",
      "situacion",
      "estrategia",
      "patron",
      "decision",
      "decidir",
      "anticipacion",
    ],
  ],
  [
    "fisico",
    [
      "fisico",
      "coordinacion",
      "agilidad",
      "desplazamiento",
      "desplazar",
      "velocidad",
      "resistencia",
      "equilibrio",
      "fuerza",
      "pies",
    ],
  ],
  [
    "mental",
    [
      "mental",
      "concentracion",
      "confianza",
      "seguridad",
      "atencion",
      "emocional",
      "motivacion",
      "actitud",
    ],
  ],
];

const PARAM_KEYS: [string, string[]][] = [
  [
    "direccion",
    [
      "control",
      "controlar",
      "direccion",
      "dirigir",
      "precision",
      "cruzado",
      "paralelo",
      "angulo",
      "diagonal",
    ],
  ],
  [
    "profundidad",
    ["control", "controlar", "profundidad", "profundo", "largo", "fondo"],
  ],
  [
    "altura",
    ["altura", "alto", "alta", "arqueada", "margen", "liftado", "liftada"],
  ],
  [
    "velocidad",
    ["velocidad", "potencia", "potente", "fuerte", "ritmo", "rapido"],
  ],
];

const SITUATION_KEYS: [string, string[]][] = [
  ["ataque", ["ataque", "atac", "agresiv", "defini", "cierre", "ganar"]],
  ["defensa", ["defensa", "defend", "defensiv", "recuper", "neutraliz"]],
  ["neutra", ["intercambio", "mantener", "consistencia", "regularidad"]],
];

const COMPETITIVE_KEYS = [
  "puntos",
  "competir",
  "competicion",
  "partido",
  "jugar",
];

// Palabras que no dicen qué trabajar (no cuentan para comparar textos).
const GENERIC = new Set([
  "mejorar",
  "trabajar",
  "conseguir",
  "dominar",
  "aprender",
  "practicar",
  "realizar",
  "hacer",
  "buscar",
  "mantener",
  "lograr",
  "controlar",
  "control",
  "golpe",
  "golpes",
  "pelota",
  "bola",
  "pista",
  "juego",
  "jugador",
  "jugadores",
  "alumno",
  "alumnos",
  "sesion",
  "clase",
  "ejercicio",
  "objetivo",
  "objetivos",
  "para",
  "como",
  "cada",
  "todo",
  "toda",
  "todos",
  "muy",
  "mas",
  "menos",
  "desde",
  "hasta",
  "entre",
  "sobre",
  "tras",
  "bien",
  "mejor",
  "buen",
  "buena",
]);

function hasKey(words: string[], keys: string[]): boolean {
  return words.some((w) => keys.some((k) => w === k || w.startsWith(k)));
}

function tagsOf(words: string[]): ObjectiveTags {
  const tags: ObjectiveTags = {
    golpes: [],
    aspectos: [],
    parametros: [],
    situaciones: [],
    competitivo: false,
  };
  for (const [g, keys] of GOLPE_KEYS)
    if (hasKey(words, keys)) tags.golpes.push(g);
  // "red" es volea solo si no se nombra otro golpe ("remate cerca de la red").
  if (tags.golpes.length === 0 && words.includes("red"))
    tags.golpes.push("volea");
  for (const [a, keys] of ASPECT_KEYS)
    if (hasKey(words, keys)) tags.aspectos.push(a);
  for (const [p, keys] of PARAM_KEYS)
    if (hasKey(words, keys)) tags.parametros.push(p);
  for (const [s, keys] of SITUATION_KEYS)
    if (hasKey(words, keys)) tags.situaciones.push(s);
  tags.competitivo = hasKey(words, COMPETITIVE_KEYS);
  // Un golpe o un parámetro sin aspecto nombrado es trabajo técnico.
  if (
    tags.aspectos.length === 0 &&
    (tags.golpes.length > 0 || tags.parametros.length > 0)
  ) {
    tags.aspectos.push("tecnica");
  }
  return tags;
}

/** Cada línea con lo que Ten Planner ha entendido (para enseñarlo). */
export function parseObjectiveLines(
  text: string | null | undefined
): ObjectiveLine[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((raw) => raw.replace(/^[\s•·\-*]+/, "").trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const words = normalizeSearchText(line).split(" ").filter(Boolean);
      const tags = tagsOf(words);
      const recognized =
        tags.golpes.length > 0 ||
        tags.aspectos.length > 0 ||
        tags.parametros.length > 0 ||
        tags.situaciones.length > 0 ||
        tags.competitivo;
      return { text: line, ...tags, recognized };
    });
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/** Todo lo reconocido en los objetivos, en orden de aparición. */
export function parseObjectives(
  text: string | null | undefined
): ObjectiveFocus {
  const lines = parseObjectiveLines(text);
  const keywords = uniq(
    lines.flatMap((l) =>
      normalizeSearchText(l.text)
        .split(" ")
        .filter((w) => w.length >= 4 && !GENERIC.has(w))
        .map((w) => stemSearchWord(w))
    )
  );
  return {
    golpes: uniq(lines.flatMap((l) => l.golpes)),
    aspectos: uniq(lines.flatMap((l) => l.aspectos)),
    parametros: uniq(lines.flatMap((l) => l.parametros)),
    situaciones: uniq(lines.flatMap((l) => l.situaciones)),
    competitivo: lines.some((l) => l.competitivo),
    keywords,
  };
}

/** Cuántas raíces de los objetivos aparecen en un texto (ya normalizado). */
export function keywordHits(
  keywords: string[],
  normalizedText: string
): number {
  if (keywords.length === 0 || !normalizedText) return 0;
  const words = normalizedText.split(" ");
  return keywords.filter((k) => words.some((w) => w.startsWith(k))).length;
}

const PARAM_LABELS: Record<string, string> = {
  direccion: "Dirección",
  profundidad: "Profundidad",
  altura: "Altura",
  velocidad: "Velocidad",
};
const ASPECT_LABELS: Record<string, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisico: "Físico",
  mental: "Mental",
};
const SITUATION_LABELS: Record<string, string> = {
  ataque: "Ataque",
  defensa: "Defensa",
  neutra: "Intercambio",
};
const GOLPE_LABELS: Record<Golpe, string> = {
  derecha: "Derecha",
  reves: "Revés",
  saque: "Saque",
  resto: "Resto",
  volea: "Volea",
  remate: "Remate",
  globo: "Globo",
  dejada: "Dejada",
};

/** Etiquetas legibles de lo reconocido, para enseñarlas debajo de cada línea. */
export function objectiveLabels(tags: ObjectiveTags): string[] {
  return [
    ...tags.golpes.map((g) => GOLPE_LABELS[g]),
    ...tags.aspectos.map((a) => ASPECT_LABELS[a] ?? a),
    ...tags.parametros.map((p) => PARAM_LABELS[p] ?? p),
    ...tags.situaciones.map((s) => SITUATION_LABELS[s] ?? s),
    ...(tags.competitivo ? ["Puntos"] : []),
  ];
}
