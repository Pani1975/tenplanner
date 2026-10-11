export const DURACION_RANGO_MINUTES = {
  "1-5": 5,
  "5-10": 10,
  "10-15": 15,
  "15-20": 20,
  "+20": 25,
} as const;

export type DuracionRango = keyof typeof DURACION_RANGO_MINUTES;

export function deriveDurationMinutesFromRange(
  range: string | null | undefined
) {
  return range && range in DURACION_RANGO_MINUTES
    ? DURACION_RANGO_MINUTES[range as DuracionRango]
    : null;
}

// Tipos de ejercicio que se ofrecen al crear/editar y al filtrar.
export const TIPOS_EJERCICIO = [
  "calentamiento",
  "tecnico_cerrado",
  "peloteo",
  "situacion_juego",
  "juego_puntos",
  "juego_ludico",
  "preparacion_fisica",
  "trucos_tecnicos",
] as const;

// Valores antiguos: se siguen aceptando para no romper los ejercicios ya
// etiquetados, pero ya no se ofrecen para ejercicios nuevos.
export const TIPOS_EJERCICIO_LEGACY = [
  "juego",
  "reto",
  "cognitivo",
  "otros_deportes",
  "fisico_movilidad",
] as const;

export const NUEVOS_TIPOS_ACTIVIDAD = [
  ...TIPOS_EJERCICIO,
  ...TIPOS_EJERCICIO_LEGACY,
] as const;

export type TipoEjercicio = (typeof NUEVOS_TIPOS_ACTIVIDAD)[number];

export const TIPO_ACTIVIDAD_LABELS: Record<TipoEjercicio, string> = {
  calentamiento: "Calentamiento / activación",
  tecnico_cerrado: "Técnico cerrado",
  peloteo: "Peloteo",
  situacion_juego: "Situación de juego",
  juego_puntos: "Juego de puntos",
  juego_ludico: "Juego lúdico",
  preparacion_fisica: "Preparación física",
  trucos_tecnicos: "Trucos técnicos",
  // Antiguos
  fisico_movilidad: "Físico / movilidad",
  otros_deportes: "Otros deportes",
  juego: "Juego",
  reto: "Reto",
  cognitivo: "Cognitivo",
};

export function isLegacyTipoEjercicio(value: string) {
  return (TIPOS_EJERCICIO_LEGACY as readonly string[]).includes(value);
}

// Etiqueta para formularios y filtros: marca los tipos antiguos para que se
// distingan de los nuevos mientras se re-etiqueta la biblioteca.
export function tipoEjercicioOptionLabel(value: string) {
  const label =
    TIPO_ACTIVIDAD_LABELS[value as TipoEjercicio] ?? value.replace(/_/g, " ");
  return isLegacyTipoEjercicio(value) ? `${label} (antiguo)` : label;
}

export const ASPECTO_JUEGO_LABELS: Record<
  "tecnica" | "tactica" | "mental" | "fisico",
  string
> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  mental: "Mental / cognitivo",
  fisico: "Físico / movilidad",
};

export function normalizeMultiValue<T extends string>(
  values: T[] | null | undefined
) {
  return values && values.length > 0 ? Array.from(new Set(values)) : null;
}

// La columna antigua `tipologia` solo admite juego|reto|otros_deportes.
export function legacyTipologiaFrom(values: string[] | null | undefined) {
  const allowed = ["juego", "reto", "otros_deportes"] as const;
  return (
    (values?.find((value) => (allowed as readonly string[]).includes(value)) as
      | (typeof allowed)[number]
      | undefined) ?? null
  );
}

// Niveles (etapas) con edad y color para que se identifiquen de un vistazo.
export const NIVELES = [
  {
    id: "descubrimiento",
    label: "Descubrimiento",
    edad: "4-6 años",
    color: "#E53935",
  },
  { id: "desarrollo", label: "Desarrollo", edad: "6-8 años", color: "#FB8C00" },
  {
    id: "consolidacion",
    label: "Consolidación",
    edad: "8-10 años",
    color: "#43A047",
  },
  {
    id: "especializacion",
    label: "Especialización",
    edad: "10-12 años",
    color: "#FFE600",
  },
  {
    id: "precompeticion",
    label: "Precompetición",
    edad: "12-14 años",
    color: "#FFC400",
  },
  {
    id: "competicion",
    label: "Competición",
    edad: "14-16 años",
    color: "#FFA000",
  },
  {
    id: "rendimiento",
    label: "Rendimiento",
    edad: "14-18 años",
    color: "#E68A00",
  },
] as const;

export type NivelId = (typeof NIVELES)[number]["id"];

// Pádel usa una escala de nivel distinta (sin tramos de edad): se filtra por
// el deporte activo/etiquetado, nunca se mezcla con la escala de tenis.
export const PADEL_NIVELES = [
  { id: "iniciacion", label: "Iniciación", edad: null, color: "#43A047" },
  { id: "medio", label: "Medio", edad: null, color: "#FB8C00" },
  { id: "avanzado", label: "Avanzado", edad: null, color: "#E53935" },
] as const;

export type PadelNivelId = (typeof PADEL_NIVELES)[number]["id"];

// Niveles heredados de cuando los ejercicios compartían la escala de
// alumnos/grupos (adultos_iniciacion, adultos_medio_alto). Ya no se ofrecen
// al etiquetar ejercicios nuevos, pero se siguen aceptando en el esquema
// para no romper el guardado de ejercicios ya etiquetados con ellos.
export const NIVEL_LEGACY = [
  { id: "adultos_iniciacion", label: "Adultos iniciación" },
  { id: "adultos_medio_alto", label: "Adultos medio-alto" },
] as const;

export type NivelLegacyId = (typeof NIVEL_LEGACY)[number]["id"];

// Todos los ids de nivel posibles (tenis/pickleball/tenis playa + pádel +
// legacy), usado para validar en el esquema sin importar qué deporte esté
// activo.
export const NIVEL_IDS = [
  ...NIVELES.map((n) => n.id),
  ...PADEL_NIVELES.map((n) => n.id),
  ...NIVEL_LEGACY.map((n) => n.id),
] as unknown as readonly [
  NivelId | PadelNivelId | NivelLegacyId,
  ...(NivelId | PadelNivelId | NivelLegacyId)[],
];

// Devuelve el listado de niveles a mostrar/elegir según el deporte: pádel
// tiene su propia escala (Iniciación/Medio/Avanzado), el resto de deportes
// sigue usando la escala por edades existente.
export function nivelesForSport(sport?: string | null) {
  return sport === "padel" ? PADEL_NIVELES : NIVELES;
}

export function nivelLabel(id: string) {
  return (
    NIVELES.find((n) => n.id === id)?.label ??
    PADEL_NIVELES.find((n) => n.id === id)?.label ??
    NIVEL_LEGACY.find((n) => n.id === id)?.label ??
    id.replace(/_/g, " ")
  );
}

// Fase de la sesión (columna `phase`).
export const FASES = [
  { id: "activation", label: "Calentamiento" },
  { id: "main", label: "Parte principal" },
  { id: "cooldown", label: "Vuelta a la calma" },
] as const;

// Pelota: se ofrecen las de color; las antiguas se siguen aceptando.
export const PELOTAS = [
  { id: "gomaespuma", label: "Gomaespuma", color: "#F5E6C8" },
  { id: "roja", label: "Roja", color: "#E53935" },
  { id: "naranja", label: "Naranja", color: "#FB8C00" },
  { id: "verde", label: "Verde", color: "#43A047" },
  { id: "amarilla", label: "Amarilla", color: "#D4E157" },
] as const;

export const PELOTAS_LEGACY = [
  { id: "normal", label: "Normal" },
  { id: "lenta", label: "Lenta" },
  { id: "rapida", label: "Rápida" },
  { id: "sin_pelota", label: "Sin pelota" },
] as const;

export const TIPO_PELOTA_VALUES = [
  ...PELOTAS.map((p) => p.id),
  ...PELOTAS_LEGACY.map((p) => p.id),
] as unknown as readonly [
  (typeof PELOTAS)[number]["id"] | (typeof PELOTAS_LEGACY)[number]["id"],
  ...((typeof PELOTAS)[number]["id"] | (typeof PELOTAS_LEGACY)[number]["id"])[],
];

export type TipoPelota = (typeof TIPO_PELOTA_VALUES)[number];

export function pelotaLabel(id: string) {
  return (
    PELOTAS.find((p) => p.id === id)?.label ??
    PELOTAS_LEGACY.find((p) => p.id === id)?.label ??
    id
  );
}

export function isLegacyPelota(id: string) {
  return PELOTAS_LEGACY.some((p) => p.id === id);
}

// En pádel no se etiqueta tipo de pelota (no aplica como en tenis).
export function showsTipoPelota(sport?: string | null) {
  return sport !== "padel";
}

// Carácter (varias opciones).
export const CARACTER = [
  { id: "cooperativo", label: "Cooperativo" },
  { id: "competitivo", label: "Competitivo" },
  { id: "reto", label: "Reto" },
] as const;

export const CARACTER_VALUES = ["cooperativo", "competitivo", "reto"] as const;

// Situación del juego (varias opciones).
export const SITUACION_JUEGO = [
  { id: "defensa", label: "Defensa" },
  { id: "ataque", label: "Ataque" },
  { id: "neutra", label: "Neutra" },
] as const;

export const SITUACION_JUEGO_VALUES = ["defensa", "ataque", "neutra"] as const;

export function caracterLabel(id: string) {
  return CARACTER.find((c) => c.id === id)?.label ?? id;
}

export function situacionJuegoLabel(id: string) {
  return SITUACION_JUEGO.find((c) => c.id === id)?.label ?? id;
}

// Autoría del ejercicio/clase: de quién es el contenido.
// "libre" es el valor por defecto (sin autoría asignada / uso libre).
// Según los monitores vayan proponiendo ejercicios públicos, se añaden
// aquí nuevas entradas (id estable + label de presentación).
export const AUTORIAS = [
  { id: "ten_planner", label: "Ten Planner" },
  { id: "academia_christian_larsen", label: "Academia Christian Larsen" },
  { id: "guia_latinoamericana", label: "Guía latinoamericana" },
  { id: "rfet", label: "RFET" },
  { id: "itf", label: "ITF" },
  { id: "begreatattennis", label: "Be Gr8 at Tennis (Rob Cherry)" },
  { id: "libre", label: "Libre" },
] as const;

export const AUTORIA_VALUES = AUTORIAS.map((a) => a.id) as unknown as readonly [
  (typeof AUTORIAS)[number]["id"],
  ...(typeof AUTORIAS)[number]["id"][],
];

export type Autoria = (typeof AUTORIAS)[number]["id"];

export function autoriaLabel(id: string | null | undefined) {
  if (!id) return AUTORIAS.find((a) => a.id === "libre")!.label;
  return AUTORIAS.find((a) => a.id === id)?.label ?? id.replace(/_/g, " ");
}
