// Importar texto con Ten Planner (fase 1): esquema de lo que devuelve la IA y
// validación contra los catálogos de la app. Sin dependencias de la base de
// datos ni del navegador: los niveles (tabla skill_levels) se pasan ya
// cargados, así que todo se puede probar con tests unitarios.
//
// La IA responde con textos libres; aquí se descarta o se deja vacío todo lo
// que no esté en los catálogos (nunca se inventan códigos).

import { z } from "zod";
import {
  GOLPES_VALUES,
  EFECTO_VALUES,
  PARAMETRO_VALUES,
  ASPECTO_JUEGO_VALUES,
} from "@/app/api/exercises/validation";
import {
  CARACTER_VALUES,
  NIVEL_IDS,
  PELOTAS,
  SITUACION_JUEGO_VALUES,
  TIPO_COMPETICION_VALUES,
  TIPOS_EJERCICIO,
} from "@/lib/exercise-taxonomy";
import { scaleSportFor, type SkillLevel } from "@/lib/skill-levels";

/** Límite de caracteres del texto que se envía a la IA. */
export const IMPORT_MAX_CHARS = 20_000;
/** Importaciones por usuario y día. */
export const IMPORT_DAILY_LIMIT = 10;
/** Máximo de elementos que se aceptan de una sola importación. */
export const IMPORT_MAX_EXERCISES = 20;
export const IMPORT_MAX_CLASSES = 10;

export type ImportKind = "exercises" | "classes";

// ── Esquema que se le pide a la IA (permisivo: la validación fina va después)

const text = z.string().nullish();
const list = z.array(z.string()).nullish();

export const aiExerciseSchema = z.object({
  name: z.string().describe("Nombre corto del ejercicio"),
  description: text.describe("Cómo se hace, tal como lo explica el texto"),
  durationMinutes: z.number().nullish().describe("Duración en minutos"),
  objectives: text.describe("Objetivos del ejercicio"),
  steps: z
    .array(z.object({ title: z.string(), description: text }))
    .nullish()
    .describe("Pasos o progresión, solo si el texto los distingue"),
  materials: list.describe("Material necesario"),
  variantes: text.describe("Variantes o progresiones"),
  tips: text.describe("Consejos o aspectos importantes"),
  observaciones: text,
  category: text.describe("technique | tactics | fitness | warm-up"),
  aspectoJuego: text.describe("tecnica | tactica | mental | fisico"),
  golpes: list,
  efecto: list,
  parametros: list,
  tiposActividad: list,
  caracter: list,
  situacionJuego: list,
  tipoCompeticion: list,
  niveles: list.describe("Códigos de nivel permitidos"),
  formato: text.describe("individual | parejas | grupal | multigrupo"),
  numJugadores: z.number().nullish(),
  tipoPelota: text,
  location: text.describe("pista | pared | playa | casa"),
  fases: list.describe("activation | main | cooldown"),
});

export const aiClassSchema = z.object({
  name: z.string().describe("Nombre de la clase"),
  duracionMinutes: z.number().nullish().describe("Duración total en minutos"),
  alumnosTipo: text.describe("individual | grupal"),
  numAlumnos: z.number().nullish(),
  objetivos: text,
  material: text,
  aspectosImportantes: text,
  niveles: list.describe("Códigos de nivel permitidos"),
  aspectosJuego: list.describe("tecnica | tactica | mental | fisico"),
  golpes: list,
  blocks: z
    .array(
      z.object({
        title: text.describe("Título del bloque"),
        notes: text,
        items: z
          .array(
            z.object({
              title: text.describe("Nombre de la actividad"),
              description: text.describe("Cómo se hace"),
              durationMinutes: z.number().nullish(),
              aspectoJuego: text,
              busqueda: text.describe(
                "2-3 palabras clave para buscar este ejercicio en la biblioteca (golpe + situación), p. ej. «peloteo cruzado» o «volea parejas». Vacío si no es un ejercicio (descanso, pausa, hidratación, charla)"
              ),
            })
          )
          .nullish(),
      })
    )
    .nullish()
    .describe("Hasta 3 bloques: inicial, principal y final"),
});

export const aiExercisesOutputSchema = z.object({
  exercises: z.array(aiExerciseSchema),
});
export const aiClassesOutputSchema = z.object({
  classes: z.array(aiClassSchema),
});

export type AiExercise = z.infer<typeof aiExerciseSchema>;
export type AiClass = z.infer<typeof aiClassSchema>;

// ── Resultado ya validado (lo que ve y edita el monitor)

export interface ImportedExercise {
  /** Mismo formato que el borrador de ejercicio (ExerciseDraftPayload). */
  name: string;
  description: string;
  objectives: string;
  tips: string;
  variantes: string;
  observaciones: string;
  category: "technique" | "tactics" | "fitness" | "warm-up";
  difficulty: "beginner" | "intermediate" | "advanced";
  durationMinutes: number;
  location: string | null;
  fases: string[];
  formato: string | null;
  numJugadores: number | null;
  tipoPelota: string | null;
  niveles: string[];
  aspectosJuego: string[];
  parametros: string[];
  tiposActividad: string[];
  caracter: string[];
  situacionJuego: string[];
  tipoCompeticion: string[];
  duracionRango: string | null;
  steps: Array<{ id: string; title: string; description: string }>;
  materials: string[];
  images: Array<string | null>;
  golpes: string[];
  efecto: string[];
  autoria: "libre";
  formMode: "full";
}

export interface ExerciseSuggestion {
  id: string;
  name: string;
  durationMinutes: number | null;
}

export interface ImportedClassItem {
  kind: "text";
  title: string | null;
  freeText: string;
  durationMinutes: number | null;
  /** Palabras clave para buscar en la biblioteca; null = no es un ejercicio. */
  searchTerms: string | null;
  /** Ejercicio de la biblioteca elegido; null = se guarda como texto. */
  exerciseId: string | null;
  /** Candidatos de la biblioteca (se rellenan en el servidor). */
  suggestions: ExerciseSuggestion[];
}

/**
 * Búsquedas a probar para una actividad, de más a menos precisa: las
 * palabras clave, sus dos primeras palabras y el título. Sin palabras clave
 * (descanso, pausa…) no se busca nada.
 */
export function searchQueriesFor(item: {
  searchTerms: string | null;
  title: string | null;
}): string[] {
  if (!item.searchTerms) return [];
  const terms = item.searchTerms.trim();
  const words = terms.split(/\s+/);
  const out = [terms];
  if (words.length > 2) out.push(words.slice(0, 2).join(" "));
  if (item.title) out.push(item.title.trim());
  return Array.from(new Set(out.filter(Boolean)));
}

/** Elemento de bloque para POST /api/classes a partir de lo revisado. */
export function toClassBlockItem(item: ImportedClassItem) {
  if (item.exerciseId) {
    return {
      kind: "exercise" as const,
      exerciseId: item.exerciseId,
      durationMinutes: item.durationMinutes,
      // La explicación del texto se conserva como nota del monitor.
      notes: item.freeText !== item.title ? item.freeText : null,
    };
  }
  return {
    kind: "text" as const,
    title: item.title,
    freeText: item.freeText,
    durationMinutes: item.durationMinutes,
  };
}

/** Cuerpo de POST /api/classes (sin los datos auxiliares de la revisión). */
export function toClassBody(c: ImportedClass) {
  return {
    ...c,
    blocks: c.blocks.map((b) => ({
      ...b,
      items: b.items.map(toClassBlockItem),
    })),
  };
}

export interface ImportedClass {
  /** Mismo cuerpo que POST /api/classes, siempre con status "draft". */
  name: string;
  duracionMinutes: number;
  alumnosTipo: "individual" | "grupal" | null;
  numAlumnos: number | null;
  objetivos: string | null;
  material: string | null;
  aspectosImportantes: string | null;
  niveles: string[] | null;
  aspectosJuego: string[] | null;
  golpes: string[] | null;
  autoria: "libre";
  status: "draft";
  blocks: Array<{
    orderIndex: 1 | 2 | 3;
    title: string | null;
    notes: string | null;
    items: ImportedClassItem[];
  }>;
}

// ── Catálogos

/** Golpes que se ofrecen hoy (sin los antiguos que solo se aceptan al leer). */
const GOLPES_CATALOG: readonly string[] = GOLPES_VALUES.slice(0, 8);

const ENUMS = {
  golpes: GOLPES_CATALOG,
  efecto: EFECTO_VALUES as readonly string[],
  parametros: PARAMETRO_VALUES as readonly string[],
  aspectos: ASPECTO_JUEGO_VALUES as readonly string[],
  tipos: TIPOS_EJERCICIO as readonly string[],
  caracter: CARACTER_VALUES as readonly string[],
  situacion: SITUACION_JUEGO_VALUES as readonly string[],
  competicion: TIPO_COMPETICION_VALUES as readonly string[],
  pelotas: PELOTAS.map((p) => p.id) as readonly string[],
  formatos: ["individual", "parejas", "grupal", "multigrupo"],
  lugares: ["pista", "pared", "playa", "casa"],
  fases: ["activation", "main", "cooldown"],
  categorias: ["technique", "tactics", "fitness", "warm-up"],
} as const;

/** Para el prompt: códigos de nivel válidos del deporte. */
export function levelCodesForSport(
  levels: readonly SkillLevel[],
  sport: string | null | undefined,
  forExercises: boolean
): string[] {
  const scale = scaleSportFor(sport);
  const ids = new Set<string>(NIVEL_IDS as readonly string[]);
  return levels
    .filter((l) => l.sport === scale)
    .sort((a, b) => a.track.localeCompare(b.track) || a.position - b.position)
    .map((l) => l.code)
    .filter((code) => !forExercises || ids.has(code));
}

export function catalogsForPrompt() {
  return {
    golpes: ENUMS.golpes,
    efecto: ENUMS.efecto,
    parametros: ENUMS.parametros,
    aspectosJuego: ENUMS.aspectos,
    tiposActividad: ENUMS.tipos,
    caracter: ENUMS.caracter,
    situacionJuego: ENUMS.situacion,
    tipoCompeticion: ENUMS.competicion,
    tipoPelota: ENUMS.pelotas,
    formato: ENUMS.formatos,
    location: ENUMS.lugares,
    fases: ENUMS.fases,
    category: ENUMS.categorias,
  };
}

// ── Utilidades de saneado

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

/** Texto recortado y acotado; "" si viene vacío. */
export function cleanText(value: string | null | undefined, max: number) {
  return (value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

/**
 * Se queda solo con los valores que existen en el catálogo (sin repetir, en
 * el orden en que vienen). Tolera mayúsculas, tildes y espacios.
 */
export function keepCatalog(
  values: readonly string[] | null | undefined,
  catalog: readonly string[],
  max = 12
): string[] {
  const out: string[] = [];
  for (const raw of values ?? []) {
    if (typeof raw !== "string") continue;
    const code = norm(raw);
    if (catalog.includes(code) && !out.includes(code)) out.push(code);
    if (out.length >= max) break;
  }
  return out;
}

function keepOne(value: string | null | undefined, catalog: readonly string[]) {
  return keepCatalog(value ? [value] : [], catalog, 1)[0] ?? null;
}

function intIn(
  value: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n >= min && n <= max ? n : null;
}

export function duracionRangoFor(minutes: number): string {
  if (minutes <= 5) return "1-5";
  if (minutes <= 10) return "5-10";
  if (minutes <= 15) return "10-15";
  if (minutes <= 20) return "15-20";
  return "+20";
}

const CATEGORY_BY_ASPECT: Record<string, ImportedExercise["category"]> = {
  tecnica: "technique",
  tactica: "tactics",
  mental: "tactics",
  fisico: "fitness",
};

export type SanitizeContext = {
  /** Niveles ya filtrados para el deporte y válidos para guardar. */
  levelCodes: readonly string[];
  /** Genera ids de pasos; se inyecta para poder fijarlo en los tests. */
  newId?: () => string;
};

// ── Ejercicios

export function sanitizeExercise(
  raw: AiExercise,
  ctx: SanitizeContext
): ImportedExercise | null {
  const name = cleanText(raw.name, 255);
  if (!name) return null;
  const newId = ctx.newId ?? (() => crypto.randomUUID());

  const aspectosJuego = keepCatalog(
    raw.aspectoJuego ? [raw.aspectoJuego] : [],
    ENUMS.aspectos,
    4
  );
  const tiposActividad = keepCatalog(raw.tiposActividad, ENUMS.tipos, 4);
  const category =
    (keepOne(raw.category, ENUMS.categorias) as ImportedExercise["category"] | null) ??
    (tiposActividad.includes("calentamiento")
      ? "warm-up"
      : CATEGORY_BY_ASPECT[aspectosJuego[0] ?? ""]) ??
    "technique";

  const durationMinutes = intIn(raw.durationMinutes, 1, 300) ?? 10;
  const niveles = keepCatalog(raw.niveles, ctx.levelCodes, 12);
  const nPlayers = intIn(raw.numJugadores, 1, 6);

  const steps = (raw.steps ?? [])
    .map((s) => ({
      id: newId(),
      title: cleanText(s.title, 200),
      description: cleanText(s.description, 1000),
    }))
    .filter((s) => s.title)
    .slice(0, 25);

  const materials = (raw.materials ?? [])
    .map((m) => cleanText(m, 100))
    .filter(Boolean)
    .slice(0, 30);

  const fases = keepCatalog(raw.fases, ENUMS.fases, 3);

  return {
    name,
    description: cleanText(raw.description, 2000),
    objectives: cleanText(raw.objectives, 2000),
    tips: cleanText(raw.tips, 2000),
    variantes: cleanText(raw.variantes, 2000),
    observaciones: cleanText(raw.observaciones, 2000),
    category,
    // La dificultad antigua no se saca del texto: valor neutro que exige el
    // esquema; la clasificación real va en niveles.
    difficulty: "intermediate",
    durationMinutes,
    location: keepOne(raw.location, ENUMS.lugares),
    fases,
    formato: keepOne(raw.formato, ENUMS.formatos),
    numJugadores: nPlayers,
    tipoPelota: keepOne(raw.tipoPelota, ENUMS.pelotas),
    niveles,
    aspectosJuego,
    parametros: keepCatalog(raw.parametros, ENUMS.parametros, 5),
    tiposActividad,
    caracter: keepCatalog(raw.caracter, ENUMS.caracter, 3),
    situacionJuego: keepCatalog(raw.situacionJuego, ENUMS.situacion, 3),
    tipoCompeticion: keepCatalog(raw.tipoCompeticion, ENUMS.competicion, 2),
    duracionRango: duracionRangoFor(durationMinutes),
    steps,
    materials,
    images: [],
    golpes: keepCatalog(raw.golpes, ENUMS.golpes, 15),
    efecto: keepCatalog(raw.efecto, ENUMS.efecto, 4),
    autoria: "libre",
    formMode: "full",
  };
}

// ── Clases

export function sanitizeClass(
  raw: AiClass,
  ctx: SanitizeContext
): ImportedClass | null {
  const name = cleanText(raw.name, 255);
  if (!name) return null;

  const blocks: ImportedClass["blocks"] = [];
  (raw.blocks ?? []).forEach((b, i) => {
    // Más de 3 bloques: lo que sobra se junta con el último.
    const orderIndex = Math.min(i + 1, 3) as 1 | 2 | 3;
    const items: ImportedClassItem[] = [];
    for (const it of b.items ?? []) {
      const title = cleanText(it.title, 120);
      const freeText = cleanText(it.description, 2000) || title;
      if (!freeText) continue;
      items.push({
        kind: "text",
        title: title || null,
        freeText,
        durationMinutes: intIn(it.durationMinutes, 1, 300),
        searchTerms: cleanText(it.busqueda, 80) || null,
        exerciseId: null,
        suggestions: [],
      });
    }
    const title = cleanText(b.title, 120) || null;
    const notes = cleanText(b.notes, 2000) || null;
    const existing = blocks.find((x) => x.orderIndex === orderIndex);
    if (existing) {
      existing.items.push(...items);
      if (notes) existing.notes = [existing.notes, notes].filter(Boolean).join("\n");
    } else {
      blocks.push({ orderIndex, title, notes, items });
    }
  });

  const itemsTotal = blocks.reduce(
    (sum, b) => sum + b.items.reduce((s, it) => s + (it.durationMinutes ?? 0), 0),
    0
  );
  const duracionMinutes =
    intIn(raw.duracionMinutes, 1, 600) ?? (itemsTotal >= 1 ? itemsTotal : 60);

  const alumnosTipo = keepOne(raw.alumnosTipo, ["individual", "grupal"]) as
    | "individual"
    | "grupal"
    | null;
  const niveles = keepCatalog(raw.niveles, ctx.levelCodes, 12);
  const aspectosJuego = keepCatalog(raw.aspectosJuego, ENUMS.aspectos, 4);
  const golpes = keepCatalog(raw.golpes, ENUMS.golpes, 15);

  return {
    name,
    duracionMinutes,
    alumnosTipo,
    numAlumnos: intIn(raw.numAlumnos, 1, 60),
    objetivos: cleanText(raw.objetivos, 4000) || null,
    material: cleanText(raw.material, 2000) || null,
    aspectosImportantes: cleanText(raw.aspectosImportantes, 4000) || null,
    niveles: niveles.length ? niveles : null,
    aspectosJuego: aspectosJuego.length ? aspectosJuego : null,
    golpes: golpes.length ? golpes : null,
    autoria: "libre",
    status: "draft",
    blocks,
  };
}

export const IMPORT_MAX_INSTRUCTIONS = 2000;

/**
 * Entrada de una importación: texto O archivo. Con archivo el texto es
 * opcional y se usa como indicaciones extra (p. ej. «solo las clases de
 * la 2.ª hoja»); sin archivo se exige el texto a importar.
 */
export function validateImportInput(
  hasFile: boolean,
  input: unknown
):
  | { ok: true; text: string | null }
  | { ok: false; error: string } {
  if (!hasFile) return validateImportText(input);
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return { ok: true, text: null };
  if (text.length > IMPORT_MAX_INSTRUCTIONS) {
    return {
      ok: false,
      error: `Las indicaciones son demasiado largas. El máximo es ${IMPORT_MAX_INSTRUCTIONS.toLocaleString("es-ES")} caracteres.`,
    };
  }
  return { ok: true, text };
}

/** Texto de entrada válido: recortado y dentro del límite. */
export function validateImportText(
  input: unknown
): { ok: true; text: string } | { ok: false; error: string } {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "Escribe o pega el texto que quieres importar." };
  }
  const text = input.trim();
  if (text.length > IMPORT_MAX_CHARS) {
    return {
      ok: false,
      error: `El texto es demasiado largo (${text.length.toLocaleString("es-ES")} caracteres). El máximo es ${IMPORT_MAX_CHARS.toLocaleString("es-ES")}: divídelo en varias importaciones.`,
    };
  }
  if (text.length < 20) {
    return { ok: false, error: "El texto es demasiado corto para importarlo." };
  }
  return { ok: true, text };
}
