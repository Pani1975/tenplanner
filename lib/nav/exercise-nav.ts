import { db } from "@/db";
import {
  exercises as exercisesTable,
  exerciseListItems,
  exerciseLists,
} from "@/db/schema";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import {
  AUTORIA_VALUES,
  CARACTER_VALUES,
  FASES,
  SITUACION_JUEGO_VALUES,
  TIPO_PELOTA_VALUES,
  type TipoPelota,
} from "@/lib/exercise-taxonomy";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";

type Category = "technique" | "tactics" | "fitness" | "warm-up";
type Difficulty = "beginner" | "intermediate" | "advanced";

export type ExerciseNavParams = Record<string, string | string[] | undefined>;

const CATEGORIES = [
  "all",
  "technique",
  "tactics",
  "fitness",
  "warm-up",
] as const;
const DIFFICULTIES = ["all", "beginner", "intermediate", "advanced"] as const;
const TABS = ["all", "global", "mine", "favorites", "drafts"] as const;

function getString(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}
function getStrings(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}
function getNumbers(v: string | string[] | undefined): number[] {
  return getStrings(v)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}
function uniqueStrings(...groups: string[][]): string[] {
  return Array.from(new Set(groups.flat().filter(Boolean)));
}
function jsonbArrayHasAny(column: AnyColumn, values: string[]) {
  return or(
    ...values.map(
      (value) =>
        sql`coalesce(${column}::jsonb, '[]'::jsonb) @> ${JSON.stringify([value])}::jsonb`
    )
  );
}

export const EXERCISE_SORTS = ["alpha", "popular", "recent", "oldest"] as const;
export type ExerciseSort = (typeof EXERCISE_SORTS)[number];

export function parseExerciseSort(params: ExerciseNavParams): ExerciseSort {
  const v = getString(params.sort);
  return (EXERCISE_SORTS as readonly string[]).includes(v)
    ? (v as ExerciseSort)
    : "alpha";
}

/** Times the exercise has been added to a session — used to rank "más populares". */
const POPULARITY_SQL = sql`(select count(*)::int from session_exercises se where se.exercise_id = ${exercisesTable.id})`;

/**
 * Returns the ORDER BY clauses for a given sort mode. Shared by the list
 * page's display query and the nav-ids query so pagination and Next/Previous
 * always reflect the same order the coach sees on screen.
 */
export function exerciseOrderBy(sort: ExerciseSort) {
  switch (sort) {
    case "popular":
      return [sql`${POPULARITY_SQL} desc`, asc(exercisesTable.name)];
    case "recent":
      // Muchos ejercicios comparten el mismo created_at exacto (altas por
      // lote), así que sin desempate Postgres no da un orden estable entre
      // ellos y el "más recientes/antiguos" parece no hacer nada al paginar
      // o recargar.
      return [desc(exercisesTable.createdAt), asc(exercisesTable.name)];
    case "oldest":
      return [asc(exercisesTable.createdAt), asc(exercisesTable.name)];
    case "alpha":
    default:
      return [asc(exercisesTable.name)];
  }
}

/**
 * Returns the ordered list of exercise ids matching the same filters as the
 * /exercises list page (app/(public)/exercises/page.tsx), used to compute
 * Next/Previous navigation on the exercise detail page.
 *
 * IMPORTANT: keep this in sync with the filter logic in that page — if a
 * filter is added/changed there, mirror it here too.
 */
export async function getFilteredExerciseIds(
  params: ExerciseNavParams,
  opts: { userId: string | null; publicExercisesEnabled: boolean }
): Promise<string[]> {
  const { userId, publicExercisesEnabled } = opts;

  const activeCategory = (
    CATEGORIES.includes(params.category as never) ? params.category : "all"
  ) as "all" | Category;
  const activeDifficulty = (
    DIFFICULTIES.includes(params.difficulty as never)
      ? params.difficulty
      : "all"
  ) as "all" | Difficulty;

  const requestedTab = TABS.includes(params.tab as never)
    ? (params.tab as (typeof TABS)[number])
    : "all";
  const activeTab =
    !userId &&
    (requestedTab === "mine" ||
      requestedTab === "favorites" ||
      requestedTab === "drafts")
      ? "all"
      : !publicExercisesEnabled && requestedTab === "global"
        ? "mine"
        : requestedTab;

  const searchTerm = getString(params.q).trim();

  const activeFormato = getStrings(params.formato);
  const activeNivel = getStrings(params.nivel);
  const activeAspectoJuego = getStrings(params.aspectoJuego);
  const activeParametro = getStrings(params.parametro);
  const activeDuracionRango = getStrings(params.duracionRango);
  const activeNumJugadores = getNumbers(params.numJugadores);
  const activeTipoPelota = getStrings(params.tipoPelota).filter((v) =>
    (TIPO_PELOTA_VALUES as readonly string[]).includes(v)
  ) as TipoPelota[];
  const activeCaracter = getStrings(params.caracter).filter((v) =>
    (CARACTER_VALUES as readonly string[]).includes(v)
  );
  const activeSituacionJuego = getStrings(params.situacionJuego).filter((v) =>
    (SITUACION_JUEGO_VALUES as readonly string[]).includes(v)
  );
  const activeTipoActividad = uniqueStrings(
    getStrings(params.tipoActividad),
    getStrings(params.tipologia)
  );
  const activeGolpes = getStrings(params.golpe);
  const activeEfecto = getStrings(params.efecto);
  const activeLocation = getStrings(params.location);
  const activeFase = getStrings(params.fase).filter((v) =>
    FASES.some((f) => f.id === v)
  ) as Array<(typeof FASES)[number]["id"]>;
  const activeAutoria = getStrings(params.autoria).filter((v) =>
    (AUTORIA_VALUES as readonly string[]).includes(v)
  );

  const favRows = userId
    ? await db
        .select({ exerciseId: exerciseListItems.exerciseId })
        .from(exerciseListItems)
        .innerJoin(
          exerciseLists,
          eq(exerciseLists.id, exerciseListItems.listId)
        )
        .where(eq(exerciseLists.userId, userId))
        .catch(() => [] as { exerciseId: string }[])
    : [];
  const favIdArray = favRows.map((f) => f.exerciseId);

  // "Mis ejercicios" según el espacio activo — mantener igual que en
  // app/(public)/exercises/page.tsx.
  const activeWorkClubId = userId ? await getActiveWorkClubId(userId) : null;
  const mineWhere = userId
    ? sharedWithClubCondition(
        exercisesTable.createdBy,
        exercisesTable.clubId,
        userId,
        activeWorkClubId
      )
    : sql`1=0`;

  const allVisibleWhere = userId
    ? publicExercisesEnabled
      ? (or(eq(exercisesTable.isGlobal, true), mineWhere) ?? mineWhere)
      : mineWhere
    : publicExercisesEnabled
      ? eq(exercisesTable.isGlobal, true)
      : sql`1=0`;

  const visibilityWhere =
    activeTab === "global"
      ? publicExercisesEnabled
        ? eq(exercisesTable.isGlobal, true)
        : sql`1=0`
      : activeTab === "mine" && userId
        ? mineWhere
        : allVisibleWhere;

  const conditions: SQL[] = [];
  if (activeTab === "favorites" && userId) {
    conditions.push(
      favIdArray.length > 0 ? inArray(exercisesTable.id, favIdArray) : sql`1=0`
    );
  } else {
    conditions.push(visibilityWhere);
  }
  if (activeCategory !== "all")
    conditions.push(eq(exercisesTable.category, activeCategory));
  if (activeDifficulty !== "all")
    conditions.push(eq(exercisesTable.difficulty, activeDifficulty));
  if (searchTerm) {
    const searchWhere = or(
      ilike(exercisesTable.name, `%${searchTerm}%`),
      ilike(exercisesTable.description, `%${searchTerm}%`)
    );
    if (searchWhere) conditions.push(searchWhere);
  }
  if (activeFormato.length > 0)
    conditions.push(
      inArray(
        exercisesTable.formato,
        activeFormato as Array<
          "individual" | "parejas" | "grupal" | "multigrupo"
        >
      )
    );
  if (activeNivel.length > 0) {
    const nivelWhere = or(
      jsonbArrayHasAny(exercisesTable.niveles, activeNivel)!,
      inArray(exercisesTable.nivel, activeNivel)
    );
    if (nivelWhere) conditions.push(nivelWhere);
  }
  if (activeAspectoJuego.length > 0) {
    const aspectoWhere = or(
      jsonbArrayHasAny(exercisesTable.aspectosJuego, activeAspectoJuego)!,
      inArray(exercisesTable.aspectoJuego, activeAspectoJuego)
    );
    if (aspectoWhere) conditions.push(aspectoWhere);
  }
  if (activeParametro.length > 0) {
    const parametroWhere = or(
      jsonbArrayHasAny(exercisesTable.parametros, activeParametro)!,
      inArray(exercisesTable.parametro, activeParametro)
    );
    if (parametroWhere) conditions.push(parametroWhere);
  }
  if (activeDuracionRango.length > 0) {
    conditions.push(inArray(exercisesTable.duracionRango, activeDuracionRango));
  }
  if (activeFase.length > 0) {
    conditions.push(inArray(exercisesTable.phase, activeFase));
  }
  if (activeCaracter.length > 0) {
    const caracterWhere = jsonbArrayHasAny(
      exercisesTable.caracter,
      activeCaracter
    );
    if (caracterWhere) conditions.push(caracterWhere);
  }
  if (activeSituacionJuego.length > 0) {
    const situacionWhere = jsonbArrayHasAny(
      exercisesTable.situacionJuego,
      activeSituacionJuego
    );
    if (situacionWhere) conditions.push(situacionWhere);
  }
  if (activeNumJugadores.length > 0)
    conditions.push(inArray(exercisesTable.numJugadores, activeNumJugadores));
  if (activeTipoPelota.length > 0)
    conditions.push(inArray(exercisesTable.tipoPelota, activeTipoPelota));
  if (activeTipoActividad.length > 0) {
    const legacyTipologiaValues = activeTipoActividad.filter(
      (value) => value !== "cognitivo"
    );
    const activityConditions: SQL[] = [
      jsonbArrayHasAny(exercisesTable.tiposActividad, activeTipoActividad)!,
    ];
    if (legacyTipologiaValues.length > 0) {
      activityConditions.push(
        inArray(exercisesTable.tipologia, legacyTipologiaValues)
      );
    }
    if (activeTipoActividad.includes("cognitivo")) {
      activityConditions.push(eq(exercisesTable.tipoActividad, "cognitivo"));
    }
    const activityWhere = or(...activityConditions);
    if (activityWhere) conditions.push(activityWhere);
  }
  if (activeGolpes.length > 0) {
    const golpeConds = activeGolpes.map(
      (g) =>
        sql`${exercisesTable.golpes}::jsonb @> ${JSON.stringify([g])}::jsonb`
    );
    const combined = or(...golpeConds);
    if (combined) conditions.push(combined);
  }
  if (activeEfecto.length > 0) {
    const efectoConds = activeEfecto.map(
      (e) =>
        sql`${exercisesTable.efecto}::jsonb @> ${JSON.stringify([e])}::jsonb`
    );
    const combined = or(...efectoConds);
    if (combined) conditions.push(combined);
  }
  if (activeLocation.length > 0)
    conditions.push(inArray(exercisesTable.location, activeLocation));
  if (activeAutoria.length > 0)
    conditions.push(inArray(exercisesTable.autoria, activeAutoria));

  const where = and(...conditions);
  const sort = parseExerciseSort(params);

  const rows = await db
    .select({ id: exercisesTable.id })
    .from(exercisesTable)
    .where(where)
    .orderBy(...exerciseOrderBy(sort))
    .limit(2000);

  return rows.map((r) => r.id);
}

/** Query-string keys the /exercises list uses for filtering (excludes "page"). */
const NAV_QUERY_KEYS = [
  "category",
  "difficulty",
  "q",
  "tab",
  "sort",
  "formato",
  "nivel",
  "aspectoJuego",
  "parametro",
  "duracionRango",
  "numJugadores",
  "tipoPelota",
  "tipoActividad",
  "golpe",
  "efecto",
  "location",
  "fase",
  "caracter",
  "situacionJuego",
  "autoria",
];

/** Serializes the active exercise filters so they can be carried from the list into the detail route. */
export function exerciseNavQueryString(params: ExerciseNavParams): string {
  const p = new URLSearchParams();
  for (const key of NAV_QUERY_KEYS) {
    const value = params[key];
    if (value === undefined) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) if (item) p.append(key, item);
  }
  return p.toString();
}
