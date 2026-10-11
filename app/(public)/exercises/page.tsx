import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  exercises as exercisesTable,
  exerciseDrafts,
  exerciseListItems,
  exerciseLists,
} from "@/db/schema";
import {
  and,
  count,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { FavoriteToggle } from "@/components/app/favorite-toggle";
import { AddToSessionButton } from "@/components/app/add-to-session-dialog";
import { AddToClassButton } from "@/components/app/add-to-class-dialog";
import { ExerciseFilters } from "@/components/app/exercise-filters";
import { ExerciseListsSection } from "@/components/app/exercise-lists-section";
import { ExerciseDraftsPanel } from "@/components/app/exercise-drafts-panel";
import { FeatureLocked } from "@/components/app/feature-locked";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveSport } from "@/lib/sports";
import { getPublicSportCookie } from "@/lib/public-sport";
import { SportGate } from "@/components/public/sport-gate";
import { SportChangePill } from "@/components/public/sport-change-pill";
import {
  exerciseNavQueryString,
  exerciseOrderBy,
  EXERCISE_SORTS,
  parseExerciseSort,
  type ExerciseSort,
} from "@/lib/nav/exercise-nav";
import {
  AUTORIA_VALUES,
  autoriaLabel,
  CARACTER_VALUES,
  caracterLabel,
  FASES,
  nivelesForSport,
  nivelLabel,
  pelotaLabel,
  showsTipoPelota,
  SITUACION_JUEGO_VALUES,
  situacionJuegoLabel,
  TIPO_PELOTA_VALUES,
  type TipoPelota,
  TIPO_ACTIVIDAD_LABELS,
} from "@/lib/exercise-taxonomy";
import {
  Plus,
  Play,
  ArrowLeft,
  ArrowUpRight,
  Search,
  ListOrdered,
  Package,
  Globe,
  Sparkles,
  User,
  Clock,
  Lock,
  Heart,
  FileDown,
} from "lucide-react";

type Category = "technique" | "tactics" | "fitness" | "warm-up";
type Difficulty = "beginner" | "intermediate" | "advanced";

const CATEGORY_LABEL: Record<Category, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

const CATEGORY_CODE: Record<Category, string> = {
  technique: "TÉC",
  tactics: "TÁC",
  fitness: "FÍS",
  "warm-up": "CAL",
};

const CATEGORIES = [
  "all",
  "technique",
  "tactics",
  "fitness",
  "warm-up",
] as const;
const DIFFICULTIES = ["all", "beginner", "intermediate", "advanced"] as const;
const TABS = ["all", "global", "mine", "favorites", "drafts"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  all: "Ver todos",
  global: "Biblioteca",
  mine: "Mis ejercicios",
  favorites: "Favoritos",
  drafts: "Borradores",
};

const PAGE_SIZE = 30;

const SORT_LABELS: Record<ExerciseSort, string> = {
  alpha: "Alfabético",
  popular: "Más populares",
  recent: "Más recientes",
  oldest: "Más antiguos",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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

export default async function ExercisesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const [publicExercisesEnabled, exerciseCreationEnabled] = await Promise.all([
    getBooleanSetting("feature.public_exercises_enabled"),
    getBooleanSetting("feature.exercise_creation_enabled"),
  ]);

  if (!publicExercisesEnabled && !user) {
    return (
      <FeatureLocked
        title="Biblioteca global desactivada"
        description="El administrador ha pausado temporalmente la biblioteca pública de ejercicios."
        href="/"
        cta="Volver al inicio"
      />
    );
  }

  const sport = user
    ? await getActiveSport(user.id)
    : await getPublicSportCookie();

  if (!sport) {
    return <SportGate />;
  }

  const params = await searchParams;

  const activeCategory = (
    CATEGORIES.includes(params.category as never) ? params.category : "all"
  ) as "all" | Category;
  const activeDifficulty = (
    DIFFICULTIES.includes(params.difficulty as never)
      ? params.difficulty
      : "all"
  ) as "all" | Difficulty;

  // Tabs `mine`, `favorites`, `drafts` require auth — fall back to "all" if unauthenticated
  const requestedTab = TABS.includes(params.tab as Tab)
    ? (params.tab as Tab)
    : "all";
  const activeTab: Tab =
    !user &&
    (requestedTab === "mine" ||
      requestedTab === "favorites" ||
      requestedTab === "drafts")
      ? "all"
      : !publicExercisesEnabled && requestedTab === "global"
        ? "mine"
        : requestedTab;

  const searchTerm = getString(params.q).trim();
  const activeSort = parseExerciseSort(params);
  const parsedPage = Number(getString(params.page) || "1");
  const currentPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  // Advanced filters
  const activeFormato = getStrings(params.formato);
  const activeNivel = getStrings(params.nivel);
  const activeAspectoJuego = getStrings(params.aspectoJuego);
  const activeParametro = getStrings(params.parametro);
  const activeDuracionRango = getStrings(params.duracionRango);
  const activeNumJugadores = getNumbers(params.numJugadores);
  // En pádel no se etiqueta/filtra por tipo de pelota.
  const activeTipoPelota = showsTipoPelota(sport)
    ? (getStrings(params.tipoPelota).filter((v) =>
        (TIPO_PELOTA_VALUES as readonly string[]).includes(v)
      ) as TipoPelota[])
    : [];
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

  const advancedActive =
    activeFormato.length > 0 ||
    activeNivel.length > 0 ||
    activeAspectoJuego.length > 0 ||
    activeParametro.length > 0 ||
    activeDuracionRango.length > 0 ||
    activeNumJugadores.length > 0 ||
    activeTipoPelota.length > 0 ||
    activeTipoActividad.length > 0 ||
    activeGolpes.length > 0 ||
    activeEfecto.length > 0 ||
    activeLocation.length > 0 ||
    activeFase.length > 0 ||
    activeCaracter.length > 0 ||
    activeSituacionJuego.length > 0 ||
    activeAutoria.length > 0;

  const sportWhere = eq(exercisesTable.sport, sport);

  // Unauthenticated users only see global exercises
  const allVisibleWhere = and(
    sportWhere,
    user
      ? publicExercisesEnabled
        ? (or(
            eq(exercisesTable.isGlobal, true),
            eq(exercisesTable.createdBy, user.id)
          ) ?? eq(exercisesTable.createdBy, user.id))
        : eq(exercisesTable.createdBy, user.id)
      : publicExercisesEnabled
        ? eq(exercisesTable.isGlobal, true)
        : sql`1=0`
  )!;

  const visibilityWhere =
    activeTab === "global"
      ? and(
          sportWhere,
          publicExercisesEnabled ? eq(exercisesTable.isGlobal, true) : sql`1=0`
        )!
      : activeTab === "mine" && user
        ? and(sportWhere, eq(exercisesTable.createdBy, user.id))!
        : allVisibleWhere;

  const listConditions: SQL[] = [];
  // favoritedIds = exercises present in any of the user's lists
  const favRows = user
    ? await db
        .select({ exerciseId: exerciseListItems.exerciseId })
        .from(exerciseListItems)
        .innerJoin(
          exerciseLists,
          eq(exerciseLists.id, exerciseListItems.listId)
        )
        .where(eq(exerciseLists.userId, user.id))
        .catch(() => [] as { exerciseId: string }[])
    : [];
  const favoritedIds = new Set(favRows.map((f) => f.exerciseId));
  const favIdArray = Array.from(favoritedIds);

  {
    if (activeTab === "favorites" && user) {
      listConditions.push(sportWhere);
      listConditions.push(
        favIdArray.length > 0
          ? inArray(exercisesTable.id, favIdArray)
          : sql`1=0`
      );
    } else {
      listConditions.push(visibilityWhere);
    }
    if (activeCategory !== "all")
      listConditions.push(eq(exercisesTable.category, activeCategory));
    if (activeDifficulty !== "all")
      listConditions.push(eq(exercisesTable.difficulty, activeDifficulty));
    if (searchTerm) {
      const searchWhere = or(
        ilike(exercisesTable.name, `%${searchTerm}%`),
        ilike(exercisesTable.description, `%${searchTerm}%`)
      );
      if (searchWhere) listConditions.push(searchWhere);
    }

    if (activeFormato.length > 0)
      listConditions.push(
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
      if (nivelWhere) listConditions.push(nivelWhere);
    }
    if (activeAspectoJuego.length > 0) {
      const aspectoWhere = or(
        jsonbArrayHasAny(exercisesTable.aspectosJuego, activeAspectoJuego)!,
        inArray(exercisesTable.aspectoJuego, activeAspectoJuego)
      );
      if (aspectoWhere) listConditions.push(aspectoWhere);
    }
    if (activeParametro.length > 0) {
      const parametroWhere = or(
        jsonbArrayHasAny(exercisesTable.parametros, activeParametro)!,
        inArray(exercisesTable.parametro, activeParametro)
      );
      if (parametroWhere) listConditions.push(parametroWhere);
    }
    if (activeDuracionRango.length > 0) {
      listConditions.push(
        inArray(exercisesTable.duracionRango, activeDuracionRango)
      );
    }
    if (activeFase.length > 0) {
      listConditions.push(inArray(exercisesTable.phase, activeFase));
    }
    if (activeCaracter.length > 0) {
      const caracterWhere = jsonbArrayHasAny(
        exercisesTable.caracter,
        activeCaracter
      );
      if (caracterWhere) listConditions.push(caracterWhere);
    }
    if (activeSituacionJuego.length > 0) {
      const situacionWhere = jsonbArrayHasAny(
        exercisesTable.situacionJuego,
        activeSituacionJuego
      );
      if (situacionWhere) listConditions.push(situacionWhere);
    }
    if (activeNumJugadores.length > 0)
      listConditions.push(
        inArray(exercisesTable.numJugadores, activeNumJugadores)
      );
    if (activeTipoPelota.length > 0)
      listConditions.push(inArray(exercisesTable.tipoPelota, activeTipoPelota));
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
      if (activityWhere) listConditions.push(activityWhere);
    }
    if (activeGolpes.length > 0) {
      const golpeConds = activeGolpes.map(
        (g) =>
          sql`${exercisesTable.golpes}::jsonb @> ${JSON.stringify([g])}::jsonb`
      );
      const combined = or(...golpeConds);
      if (combined) listConditions.push(combined);
    }
    if (activeEfecto.length > 0) {
      const efectoConds = activeEfecto.map(
        (e) =>
          sql`${exercisesTable.efecto}::jsonb @> ${JSON.stringify([e])}::jsonb`
      );
      const combined = or(...efectoConds);
      if (combined) listConditions.push(combined);
    }
    if (activeLocation.length > 0)
      listConditions.push(inArray(exercisesTable.location, activeLocation));
    if (activeAutoria.length > 0)
      listConditions.push(inArray(exercisesTable.autoria, activeAutoria));
  }

  const listWhere = and(...listConditions);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Total de ejercicios que cumplen los filtros activos (no solo los de la
  // página actual ni el total de la pestaña), para el contador de resultados.
  const resultCountPromise = db
    .select({ total: count() })
    .from(exercisesTable)
    .where(listWhere)
    .then((rows) => Number(rows[0]?.total ?? 0));
  const navQs = exerciseNavQueryString(params);

  const draftCountRows = user
    ? await db
        .select({ total: count() })
        .from(exerciseDrafts)
        .where(eq(exerciseDrafts.userId, user.id))
    : [{ total: 0 }];
  const draftCount = Number(draftCountRows[0]?.total ?? 0);

  const [rowPage, allRows, globalRows, mineRows, categoryRows, fisicoAspectoRows] =
    await Promise.all([
      db
        .select({
          id: exercisesTable.id,
          name: exercisesTable.name,
          description: exercisesTable.description,
          category: exercisesTable.category,
          difficulty: exercisesTable.difficulty,
          durationMinutes: exercisesTable.durationMinutes,
          imageUrl: exercisesTable.imageUrl,
          videoUrl: exercisesTable.videoUrl,
          isAiGenerated: exercisesTable.isAiGenerated,
          isGlobal: exercisesTable.isGlobal,
          autoria: exercisesTable.autoria,
          createdBy: exercisesTable.createdBy,
          formato: exercisesTable.formato,
          numJugadores: exercisesTable.numJugadores,
          tipoActividad: exercisesTable.tipoActividad,
          tiposActividad: exercisesTable.tiposActividad,
          stepsCount: sql<number>`COALESCE(json_array_length(${exercisesTable.steps}), 0)`,
          materialsCount: sql<number>`COALESCE(json_array_length(${exercisesTable.materials}), 0)`,
        })
        .from(exercisesTable)
        .where(listWhere)
        .orderBy(...exerciseOrderBy(activeSort))
        .limit(PAGE_SIZE + 1)
        .offset(offset),
      db.select({ total: count() }).from(exercisesTable).where(allVisibleWhere),
      publicExercisesEnabled
        ? db
            .select({ total: count() })
            .from(exercisesTable)
            .where(and(sportWhere, eq(exercisesTable.isGlobal, true)))
        : Promise.resolve([{ total: 0 }]),
      user
        ? db
            .select({ total: count() })
            .from(exercisesTable)
            .where(and(sportWhere, eq(exercisesTable.createdBy, user.id)))
        : Promise.resolve([{ total: 0 }]),
      db
        .select({ category: exercisesTable.category, total: count() })
        .from(exercisesTable)
        .where(visibilityWhere)
        .groupBy(exercisesTable.category),
      // "Aspectos del juego" es una etiqueta multivalor (jsonb), no la
      // categoría exclusiva de arriba: un ejercicio puede tener varios
      // aspectos a la vez, así que este conteo no tiene por qué cuadrar
      // con el total de ejercicios.
      db
        .select({ total: count() })
        .from(exercisesTable)
        .where(
          and(
            visibilityWhere,
            or(
              jsonbArrayHasAny(exercisesTable.aspectosJuego, ["fisico"])!,
              inArray(exercisesTable.aspectoJuego, ["fisico"])
            )
          )
        ),
    ]);

  const hasNextPage = rowPage.length > PAGE_SIZE;
  const filtered = hasNextPage ? rowPage.slice(0, PAGE_SIZE) : rowPage;
  const resultCount = await resultCountPromise;
  const exerciseListCountRows =
    user && filtered.length > 0
      ? await db
          .select({
            exerciseId: exerciseListItems.exerciseId,
            total: count(),
          })
          .from(exerciseListItems)
          .innerJoin(
            exerciseLists,
            eq(exerciseLists.id, exerciseListItems.listId)
          )
          .where(
            and(
              eq(exerciseLists.userId, user.id),
              inArray(
                exerciseListItems.exerciseId,
                filtered.map((exercise) => exercise.id)
              )
            )
          )
          .groupBy(exerciseListItems.exerciseId)
      : [];
  const exerciseListCountMap = new Map(
    exerciseListCountRows.map((row) => [row.exerciseId, Number(row.total)])
  );

  const byCategoryMap = new Map(
    categoryRows.map((row) => [row.category, Number(row.total)])
  );
  const fisicoAspectoCount = Number(fisicoAspectoRows[0]?.total ?? 0);

  const tabCounts: Record<Tab, number> = {
    all: Number(allRows[0]?.total ?? 0),
    global: Number(globalRows[0]?.total ?? 0),
    mine: Number(mineRows[0]?.total ?? 0),
    favorites: favIdArray.length,
    drafts: draftCount,
  };

  const advancedParams: Record<string, string | string[] | undefined> = {
    formato: activeFormato.length > 0 ? activeFormato : undefined,
    nivel: activeNivel.length > 0 ? activeNivel : undefined,
    aspectoJuego:
      activeAspectoJuego.length > 0 ? activeAspectoJuego : undefined,
    parametro: activeParametro.length > 0 ? activeParametro : undefined,
    duracionRango:
      activeDuracionRango.length > 0 ? activeDuracionRango : undefined,
    numJugadores:
      activeNumJugadores.length > 0
        ? activeNumJugadores.map(String)
        : undefined,
    tipoPelota: activeTipoPelota.length > 0 ? activeTipoPelota : undefined,
    tipoActividad:
      activeTipoActividad.length > 0 ? activeTipoActividad : undefined,
    golpe: activeGolpes.length > 0 ? activeGolpes : undefined,
    efecto: activeEfecto.length > 0 ? activeEfecto : undefined,
    location: activeLocation.length > 0 ? activeLocation : undefined,
    fase: activeFase.length > 0 ? activeFase : undefined,
    caracter: activeCaracter.length > 0 ? activeCaracter : undefined,
    situacionJuego:
      activeSituacionJuego.length > 0 ? activeSituacionJuego : undefined,
    autoria: activeAutoria.length > 0 ? activeAutoria : undefined,
    sort: activeSort !== "alpha" ? activeSort : undefined,
  };

  function buildHref(params: Record<string, string | string[] | undefined>) {
    const p = new URLSearchParams();
    const merged = { ...advancedParams, ...params };
    if (merged.category && merged.category !== "all")
      p.set("category", merged.category as string);
    if (merged.difficulty && merged.difficulty !== "all")
      p.set("difficulty", merged.difficulty as string);
    if (merged.q) p.set("q", merged.q as string);
    if (merged.tab && merged.tab !== "all") p.set("tab", merged.tab as string);
    if (merged.sort && merged.sort !== "alpha")
      p.set("sort", merged.sort as string);
    if (merged.page && merged.page !== "1")
      p.set("page", merged.page as string);
    for (const key of [
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
    ]) {
      const value = merged[key];
      const values = Array.isArray(value) ? value : value ? [value] : [];
      for (const item of values) p.append(key, item);
    }
    const s = p.toString();
    return `/exercises${s ? `?${s}` : ""}`;
  }

  // Tira de 4 tarjetas: Técnica/Táctica/Físico siguen viniendo de la
  // categoría exclusiva del ejercicio; la 4ª tarjeta (antes "Calentamiento")
  // pasa a mostrar los ejercicios etiquetados con el aspecto de juego
  // "Físico/Movilidad" en vez de la categoría "warm-up". Al venir de una
  // etiqueta multivalor (aspectosJuego), esta tarjeta no tiene por qué
  // cuadrar con el total de ejercicios: un ejercicio puede tener varios
  // aspectos a la vez.
  const statStrip: Array<{
    key: string;
    code: string;
    label: string;
    count: number;
    isActive: boolean;
    href: string;
  }> = (["technique", "tactics", "fitness"] as const).map((cat) => {
    const isActive = activeCategory === cat;
    return {
      key: cat,
      code: CATEGORY_CODE[cat],
      label: CATEGORY_LABEL[cat],
      count: byCategoryMap.get(cat) ?? 0,
      isActive,
      href: buildHref({
        category: isActive ? "all" : cat,
        difficulty: activeDifficulty,
        q: searchTerm || undefined,
        tab: activeTab,
      }),
    };
  });
  {
    const isActive = activeAspectoJuego.includes("fisico");
    statStrip.push({
      key: "aspecto-fisico",
      code: "FÍS/MOV",
      label: "Físico/Movilidad",
      count: fisicoAspectoCount,
      isActive,
      href: buildHref({
        aspectoJuego: isActive ? undefined : ["fisico"],
        category: activeCategory,
        difficulty: activeDifficulty,
        q: searchTerm || undefined,
        tab: activeTab,
      }),
    });
  }

  const FORMATO_LABEL: Record<string, string> = {
    individual: "Individual",
    parejas: "Parejas",
    grupal: "Grupal",
    multigrupo: "Multigrupo",
  };

  function getTipoActividadLabel(value: string) {
    return (
      TIPO_ACTIVIDAD_LABELS[value as keyof typeof TIPO_ACTIVIDAD_LABELS] ??
      value.replace(/_/g, " ")
    );
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#F4F4F1] text-[#050505] dark:bg-[#050505] dark:text-[#F4F4F1]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_82%_20%,rgba(214,255,56,0.22),transparent_34%),linear-gradient(180deg,rgba(5,5,5,0.06),transparent)] dark:bg-[radial-gradient(circle_at_82%_20%,rgba(214,255,56,0.18),transparent_34%)]" />
      <div className="relative px-4 py-6 sm:px-6 md:px-10 lg:px-12">
        <header className="overflow-hidden rounded-lg bg-[#050505] text-white shadow-[0_24px_80px_rgba(5,5,5,0.18)]">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-[#D6FF38]">
                  Biblioteca pública
                </p>
                {!user && <SportChangePill sport={sport} />}
              </div>
              <h1 className="mt-3 font-heading text-4xl font-semibold leading-none tracking-normal text-white sm:text-5xl">
                Ejercicios
              </h1>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-white/68">
                Biblioteca de ejercicios sueltos, etiquetados por nivel,
                categoría y duración para entrenadores de deportes de raqueta.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end lg:justify-between">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2">
                  <p className="font-heading text-2xl leading-none text-[#D6FF38]">
                    {tabCounts.all}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/45">
                    Total
                  </p>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2">
                  <p className="font-heading text-2xl leading-none text-white">
                    {tabCounts.global}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/45">
                    Global
                  </p>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2">
                  <p className="font-heading text-2xl leading-none text-white">
                    {tabCounts.favorites}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/45">
                    Listas
                  </p>
                </div>
              </div>
              <div>
                {user && exerciseCreationEnabled ? (
                  <Link
                    href="/exercises/new"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-[13px] font-black text-[#050505] transition hover:bg-white"
                  >
                    <Plus className="size-4" />
                    Nuevo ejercicio
                  </Link>
                ) : user ? (
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/14 bg-white/[0.04] px-5 text-[13px] font-semibold text-white/45">
                    <Lock className="size-4" />
                    Bloqueado
                  </span>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/18 px-5 text-[13px] font-semibold text-white/72 transition hover:border-[#D6FF38] hover:text-[#D6FF38]"
                  >
                    <Lock className="size-3.5" />
                    Inicia sesión para añadir
                  </Link>
                )}
              </div>
            </div>
          </div>
          <div className="h-2 bg-[#D6FF38]" />
        </header>

        <div className="mt-6 space-y-6">
          <>
            {/* Tabs */}
            <nav className="flex gap-2 overflow-x-auto rounded-lg border border-[#050505]/10 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
              {TABS.map((t) => {
                if (t === "global" && !publicExercisesEnabled) return null;
                if (t === "drafts" && !user) return null;

                const isActive = activeTab === t;
                const requiresAuth =
                  !user && (t === "mine" || t === "favorites");

                if (requiresAuth) {
                  return (
                    <Link
                      key={t}
                      href="/login"
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-foreground/35 transition-colors hover:bg-[#050505]/5 hover:text-foreground/55 dark:hover:bg-white/8"
                    >
                      <Lock className="size-3" strokeWidth={1.8} />
                      {TAB_LABELS[t]}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={t}
                    href={buildHref({
                      category: activeCategory,
                      difficulty: activeDifficulty,
                      q: searchTerm || undefined,
                      tab: t,
                    })}
                    className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-[#D6FF38] text-[#050505]"
                        : "text-muted-foreground hover:bg-[#050505]/5 hover:text-foreground dark:hover:bg-white/8"
                    }`}
                  >
                    {TAB_LABELS[t]}
                    {tabCounts[t] > 0 && (
                      <span className="ml-1.5 text-[11px] tabular-nums opacity-60">
                        {tabCounts[t]}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {activeTab === "drafts" && user ? (
              <ExerciseDraftsPanel showEmptyState />
            ) : activeTab === "favorites" && user ? (
              <ExerciseListsSection />
            ) : (
              <>
                {/* ─── Category strip ─── */}
                {tabCounts[activeTab] > 0 && (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {statStrip.map(({ key, code, label, count, isActive, href }) => {
                      return (
                        <Link
                          key={key}
                          href={href}
                          className={`group rounded-lg border px-5 py-5 transition-all ${
                            isActive
                              ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505] shadow-[0_18px_40px_rgba(214,255,56,0.24)]"
                              : "border-[#050505]/10 bg-white/70 hover:border-[#050505]/20 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#D6FF38]/40"
                          }`}
                        >
                          <div className="flex items-baseline justify-between">
                            <p
                              className={`font-sans text-[10px] uppercase tracking-[0.2em] ${isActive ? "text-[#050505]/70" : "text-foreground/45"}`}
                            >
                              {code} · {label}
                            </p>
                            {isActive && (
                              <span className="size-1.5 rounded-full bg-[#050505]" />
                            )}
                          </div>
                          <p className="mt-2 font-heading text-3xl tabular-nums leading-none">
                            {count}
                          </p>
                          <p className="mt-1.5 font-sans text-[10px] italic opacity-60">
                            ejercicios
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* ─── Search + difficulty + filtros avanzados ─── */}
                <div className="space-y-3 rounded-lg border border-[#050505]/10 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <form
                      className="flex-1 relative"
                      action="/exercises"
                      method="get"
                    >
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground/40"
                        strokeWidth={1.6}
                      />
                      <input
                        type="search"
                        name="q"
                        placeholder="Buscar por nombre o descripción…"
                        defaultValue={searchTerm}
                        className="h-11 w-full rounded-full border border-[#050505]/12 bg-[#F4F4F1] pl-9 pr-4 text-[13px] text-foreground transition-colors placeholder:text-foreground/40 focus:border-[#D6FF38] focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/40 dark:border-white/10 dark:bg-[#050505]"
                      />
                      {activeCategory !== "all" && (
                        <input
                          type="hidden"
                          name="category"
                          value={activeCategory}
                        />
                      )}
                      {activeDifficulty !== "all" && (
                        <input
                          type="hidden"
                          name="difficulty"
                          value={activeDifficulty}
                        />
                      )}
                      {activeTab !== "all" && (
                        <input type="hidden" name="tab" value={activeTab} />
                      )}
                      {activeFormato.map((value) => (
                        <input
                          key={`formato-${value}`}
                          type="hidden"
                          name="formato"
                          value={value}
                        />
                      ))}
                      {activeNivel.map((value) => (
                        <input
                          key={`nivel-${value}`}
                          type="hidden"
                          name="nivel"
                          value={value}
                        />
                      ))}
                      {activeAspectoJuego.map((value) => (
                        <input
                          key={`aspecto-${value}`}
                          type="hidden"
                          name="aspectoJuego"
                          value={value}
                        />
                      ))}
                      {activeParametro.map((value) => (
                        <input
                          key={`parametro-${value}`}
                          type="hidden"
                          name="parametro"
                          value={value}
                        />
                      ))}
                      {activeDuracionRango.map((value) => (
                        <input
                          key={`duracion-${value}`}
                          type="hidden"
                          name="duracionRango"
                          value={value}
                        />
                      ))}
                      {activeNumJugadores.map((value) => (
                        <input
                          key={`jugadores-${value}`}
                          type="hidden"
                          name="numJugadores"
                          value={value}
                        />
                      ))}
                      {activeTipoPelota.map((value) => (
                        <input
                          key={`pelota-${value}`}
                          type="hidden"
                          name="tipoPelota"
                          value={value}
                        />
                      ))}
                      {activeTipoActividad.map((value) => (
                        <input
                          key={`actividad-${value}`}
                          type="hidden"
                          name="tipoActividad"
                          value={value}
                        />
                      ))}
                      {activeGolpes.map((g) => (
                        <input key={g} type="hidden" name="golpe" value={g} />
                      ))}
                      {activeEfecto.map((e) => (
                        <input key={e} type="hidden" name="efecto" value={e} />
                      ))}
                      {activeLocation.map((value) => (
                        <input
                          key={`location-${value}`}
                          type="hidden"
                          name="location"
                          value={value}
                        />
                      ))}
                      {activeFase.map((value) => (
                        <input
                          key={`fase-${value}`}
                          type="hidden"
                          name="fase"
                          value={value}
                        />
                      ))}
                      {activeCaracter.map((value) => (
                        <input
                          key={`caracter-${value}`}
                          type="hidden"
                          name="caracter"
                          value={value}
                        />
                      ))}
                      {activeSituacionJuego.map((value) => (
                        <input
                          key={`situacion-${value}`}
                          type="hidden"
                          name="situacionJuego"
                          value={value}
                        />
                      ))}
                      {activeAutoria.map((value) => (
                        <input
                          key={`autoria-${value}`}
                          type="hidden"
                          name="autoria"
                          value={value}
                        />
                      ))}
                    </form>
                  </div>

                  {/* ─── Orden ─── */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="shrink-0 px-1 font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                      Ordenar por:
                    </span>
                    {EXERCISE_SORTS.map((s) => {
                      const isActive = activeSort === s;
                      return (
                        <Link
                          key={s}
                          href={buildHref({
                            sort: s === "alpha" ? undefined : s,
                            category: activeCategory,
                            difficulty: activeDifficulty,
                            q: searchTerm || undefined,
                            tab: activeTab,
                          })}
                          className={`whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-sans font-semibold tracking-[0.08em] transition-colors ${
                            isActive
                              ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                              : "border-foreground/15 text-foreground/55 hover:border-foreground/30 hover:text-foreground"
                          }`}
                        >
                          {SORT_LABELS[s]}
                        </Link>
                      );
                    })}
                  </div>

                  {/* ─── Niveles (etapas) con edad y color ─── */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="shrink-0 px-1 font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                      Nivel:
                    </span>
                    <Link
                      href={buildHref({
                        nivel: undefined,
                        category: activeCategory,
                        difficulty: activeDifficulty,
                        q: searchTerm || undefined,
                        tab: activeTab,
                      })}
                      className={`whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-sans font-semibold tracking-[0.08em] transition-colors ${
                        activeNivel.length === 0
                          ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                          : "border-foreground/15 text-foreground/55 hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      Todos
                    </Link>
                    {nivelesForSport(sport).map((n) => {
                      const isActive = activeNivel.includes(n.id);
                      const nextNivel = isActive
                        ? activeNivel.filter((v) => v !== n.id)
                        : [...activeNivel, n.id];
                      return (
                        <Link
                          key={n.id}
                          href={buildHref({
                            nivel: nextNivel.length > 0 ? nextNivel : undefined,
                            category: activeCategory,
                            difficulty: activeDifficulty,
                            q: searchTerm || undefined,
                            tab: activeTab,
                          })}
                          title={n.edad ?? undefined}
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-sans font-semibold transition-colors ${
                            isActive
                              ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                              : "border-foreground/15 text-foreground/70 hover:border-foreground/30 hover:text-foreground"
                          }`}
                        >
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: n.color }}
                          />
                          {n.label}
                          {n.edad && (
                            <span
                              className={`font-normal ${isActive ? "opacity-70" : "text-foreground/45"}`}
                            >
                              {n.edad}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>

                  {/* ─── Filtros avanzados ─── */}
                  <ExerciseFilters
                    sport={sport}
                    currentFilters={{
                      formato: activeFormato,
                      nivel: activeNivel,
                      aspectoJuego: activeAspectoJuego,
                      parametro: activeParametro,
                      duracionRango: activeDuracionRango,
                      numJugadores: activeNumJugadores,
                      tipoPelota: activeTipoPelota,
                      tipoActividad: activeTipoActividad,
                      golpes: activeGolpes,
                      efecto: activeEfecto,
                      location: activeLocation,
                      fase: activeFase,
                      caracter: activeCaracter,
                      situacionJuego: activeSituacionJuego,
                      autoria: activeAutoria,
                    }}
                    preserved={{
                      nivel: activeNivel,
                      q: searchTerm || undefined,
                      tab: activeTab !== "all" ? activeTab : undefined,
                      category:
                        activeCategory !== "all" ? activeCategory : undefined,
                      difficulty:
                        activeDifficulty !== "all"
                          ? activeDifficulty
                          : undefined,
                    }}
                  />

                  {/* Active filter summary */}
                  {advancedActive && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeFormato.map((value) => (
                        <span
                          key={`formato-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Formato: {FORMATO_LABEL[value] ?? value}
                        </span>
                      ))}
                      {activeNivel.map((value) => (
                        <span
                          key={`nivel-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Nivel: {nivelLabel(value)}
                        </span>
                      ))}
                      {activeAspectoJuego.map((value) => (
                        <span
                          key={`aspecto-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Aspecto: {value}
                        </span>
                      ))}
                      {activeParametro.map((value) => (
                        <span
                          key={`parametro-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Parámetro: {value}
                        </span>
                      ))}
                      {activeDuracionRango.map((value) => (
                        <span
                          key={`duracion-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Rango: {value}
                        </span>
                      ))}
                      {activeNumJugadores.map((value) => (
                        <span
                          key={`jugadores-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          {value} jugador{value !== 1 ? "es" : ""}
                        </span>
                      ))}
                      {activeTipoPelota.map((value) => (
                        <span
                          key={`pelota-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Pelota: {pelotaLabel(value)}
                        </span>
                      ))}
                      {activeTipoActividad.map((value) => (
                        <span
                          key={`actividad-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          {getTipoActividadLabel(value)}
                        </span>
                      ))}
                      {activeGolpes.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          {g.replace(/_/g, " ")}
                        </span>
                      ))}
                      {activeEfecto.map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Efecto: {e.replace(/_/g, " ")}
                        </span>
                      ))}
                      {activeLocation.map((value) => (
                        <span
                          key={`location-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          {value}
                        </span>
                      ))}
                      {activeFase.map((value) => (
                        <span
                          key={`fase-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Fase: {FASES.find((f) => f.id === value)?.label}
                        </span>
                      ))}
                      {activeCaracter.map((value) => (
                        <span
                          key={`caracter-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Carácter: {caracterLabel(value)}
                        </span>
                      ))}
                      {activeSituacionJuego.map((value) => (
                        <span
                          key={`situacion-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Situación: {situacionJuegoLabel(value)}
                        </span>
                      ))}
                      {activeAutoria.map((value) => (
                        <span
                          key={`autoria-${value}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] bg-brand/8 border border-brand/20 text-brand rounded"
                        >
                          Autoría: {autoriaLabel(value)}
                        </span>
                      ))}
                      <Link
                        href={buildHref({
                          category: activeCategory,
                          difficulty: activeDifficulty,
                          q: searchTerm || undefined,
                          tab: activeTab,
                          formato: undefined,
                          nivel: undefined,
                          aspectoJuego: undefined,
                          parametro: undefined,
                          duracionRango: undefined,
                          numJugadores: undefined,
                          tipoPelota: undefined,
                          tipoActividad: undefined,
                          golpe: undefined,
                          efecto: undefined,
                          location: undefined,
                          autoria: undefined,
                        })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans tracking-[0.08em] text-foreground/50 hover:text-foreground border border-foreground/15 rounded transition-colors"
                      >
                        Limpiar filtros
                      </Link>
                    </div>
                  )}
                </div>

                {filtered.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                      {resultCount} resultado
                      {resultCount !== 1 ? "s" : ""}
                    </p>
                    <a
                      href={`/api/exercises/pdf${navQs ? `?${navQs}` : ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#050505]/15 bg-white px-4 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/15 dark:bg-white/[0.04]"
                    >
                      <FileDown className="size-3.5" strokeWidth={1.8} />
                      Generar PDF de los resultados
                    </a>
                  </div>
                )}

                {filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#050505]/18 bg-white/60 px-6 py-16 text-center dark:border-white/15 dark:bg-white/[0.04]">
                    <p className="text-[15px] font-medium text-foreground mb-2">
                      Sin coincidencias
                    </p>
                    <p className="text-[13px] text-foreground/55 max-w-sm mx-auto mb-4">
                      {searchTerm
                        ? `No hay ejercicios para "${searchTerm}".`
                        : "Prueba con otra combinación."}
                    </p>
                    <Link
                      href={buildHref({ tab: activeTab })}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#050505] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#D6FF38] hover:text-[#050505] dark:bg-[#D6FF38] dark:text-[#050505]"
                    >
                      Limpiar filtros
                    </Link>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((exercise) => {
                      const catLabel =
                        CATEGORY_LABEL[exercise.category as Category];
                      const steps = Number(exercise.stepsCount ?? 0);
                      const materials = Number(exercise.materialsCount ?? 0);

                      let owner: {
                        label: string;
                        icon: React.ElementType;
                      } | null = null;
                      if (exercise.isAiGenerated)
                        owner = { label: "IA", icon: Sparkles };
                      else if (exercise.isGlobal)
                        owner = {
                          label: autoriaLabel(exercise.autoria),
                          icon: Globe,
                        };
                      else if (user && exercise.createdBy === user.id)
                        owner = { label: "PRP", icon: User };

                      const isFavorited = favoritedIds.has(exercise.id);
                      const formatoLabel = exercise.formato
                        ? FORMATO_LABEL[exercise.formato]
                        : null;
                      const actividadLabels = (
                        (exercise.tiposActividad as string[] | null) ??
                        (exercise.tipoActividad ? [exercise.tipoActividad] : [])
                      ).map(getTipoActividadLabel);
                      const savedInLists =
                        exerciseListCountMap.get(exercise.id) ?? 0;

                      return (
                        <li
                          key={exercise.id}
                          className="flex flex-col overflow-hidden rounded-lg border border-[#050505]/10 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D6FF38] hover:shadow-[0_24px_50px_rgba(5,5,5,0.12)] dark:border-white/10 dark:bg-white/[0.04]"
                        >
                          <div className="flex items-center justify-between bg-[#050505] px-4 py-3 text-white sm:px-5">
                            <span className="rounded-full bg-[#D6FF38] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#050505]">
                              {exercise.durationMinutes} min
                            </span>
                            <div className="flex items-center gap-2.5">
                              {owner && (
                                <span
                                  className={`inline-flex items-center gap-1 font-sans text-[9px] uppercase tracking-[0.2em] ${
                                    owner.label === "IA"
                                      ? "text-[#D6FF38]"
                                      : "text-white/55"
                                  }`}
                                >
                                  <owner.icon
                                    className="size-2.5"
                                    strokeWidth={1.8}
                                  />
                                  {owner.label}
                                </span>
                              )}
                              {exercise.videoUrl && (
                                <a
                                  href={exercise.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Ver vídeo del ejercicio"
                                  aria-label={`Ver vídeo de ${exercise.name}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-white/80 transition-colors hover:border-[#D6FF38] hover:text-[#D6FF38]"
                                >
                                  <Play className="size-3" strokeWidth={2} />
                                  Vídeo
                                </a>
                              )}
                              {user && (
                                <>
                                  <AddToSessionButton
                                    variant="icon"
                                    exerciseIds={[exercise.id]}
                                    label={exercise.name}
                                  />
                                  <AddToClassButton
                                    variant="icon"
                                    exerciseId={exercise.id}
                                    label={exercise.name}
                                  />
                                </>
                              )}
                              <FavoriteToggle
                                exerciseId={exercise.id}
                                initialFavorited={isFavorited}
                                exerciseName={exercise.name}
                                size="sm"
                                locked={!user}
                              />
                            </div>
                          </div>

                          <Link
                            href={`/exercises/${exercise.id}${navQs ? `?${navQs}` : ""}`}
                            className="group block flex-1 px-4 pb-6 pt-5 transition-colors hover:bg-[#D6FF38]/[0.05] sm:px-6"
                          >
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#6D7F00] dark:text-[#D6FF38]">
                              {catLabel}
                            </p>
                            <h3 className="mb-2 font-heading text-[19px] font-semibold leading-snug text-foreground transition-colors group-hover:text-[#6D7F00] dark:group-hover:text-[#D6FF38]">
                              {exercise.name}
                            </h3>

                            {exercise.description && (
                              <p className="text-[12.5px] text-foreground/60 leading-relaxed line-clamp-2 mb-5">
                                {exercise.description}
                              </p>
                            )}

                            {(formatoLabel ||
                              actividadLabels.length > 0 ||
                              exercise.numJugadores) && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {formatoLabel && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-sans uppercase tracking-[0.12em] bg-muted text-foreground/50 rounded">
                                    {formatoLabel}
                                  </span>
                                )}
                                {exercise.numJugadores && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-sans uppercase tracking-[0.12em] bg-muted text-foreground/50 rounded">
                                    {exercise.numJugadores}P
                                  </span>
                                )}
                                {actividadLabels.map((label) => (
                                  <span
                                    key={label}
                                    className="px-1.5 py-0.5 text-[9px] font-sans uppercase tracking-[0.12em] bg-muted text-foreground/50 rounded"
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}

                            {user && savedInLists > 0 ? (
                              <div className="mb-3 flex flex-wrap gap-1">
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#D6FF38]/40 bg-[#D6FF38]/15 px-2 py-1 text-[10px] font-semibold text-[#5E6F00] dark:text-[#D6FF38]">
                                  <Heart className="size-3" strokeWidth={1.7} />
                                  En {savedInLists} lista
                                  {savedInLists !== 1 ? "s" : ""}
                                </span>
                              </div>
                            ) : null}

                            <div className="flex justify-end border-t border-foreground/10 pt-4">
                              <div className="flex items-center gap-3 font-sans text-[10px] tabular-nums text-foreground/50">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="size-3" strokeWidth={1.6} />{" "}
                                  {exercise.durationMinutes}&prime;
                                </span>
                                {steps > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <ListOrdered
                                      className="size-3"
                                      strokeWidth={1.6}
                                    />{" "}
                                    {steps}
                                  </span>
                                )}
                                {materials > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <Package
                                      className="size-3"
                                      strokeWidth={1.6}
                                    />{" "}
                                    {materials}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* ─── Pagination ─── */}
                {(currentPage > 1 || hasNextPage) && (
                  <footer className="flex flex-col gap-3 rounded-lg border border-[#050505]/10 bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/[0.04]">
                    <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/45 tabular-nums">
                      {filtered.length > 0
                        ? `${offset + 1}–${offset + filtered.length}`
                        : "0"}{" "}
                      · Página {currentPage.toString().padStart(2, "0")}
                    </p>
                    <div className="flex items-center gap-5">
                      {currentPage > 1 ? (
                        <Link
                          href={buildHref({
                            category: activeCategory,
                            difficulty: activeDifficulty,
                            q: searchTerm || undefined,
                            tab: activeTab,
                            page: String(currentPage - 1),
                          })}
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:text-[#6D7F00] dark:hover:text-[#D6FF38]"
                        >
                          <ArrowLeft className="size-3" /> Anterior
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/25">
                          <ArrowLeft className="size-3" /> Anterior
                        </span>
                      )}
                      {hasNextPage ? (
                        <Link
                          href={buildHref({
                            category: activeCategory,
                            difficulty: activeDifficulty,
                            q: searchTerm || undefined,
                            tab: activeTab,
                            page: String(currentPage + 1),
                          })}
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground/70 transition-colors hover:text-[#6D7F00] dark:hover:text-[#D6FF38]"
                        >
                          Siguiente <ArrowUpRight className="size-3" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/25">
                          Siguiente <ArrowUpRight className="size-3" />
                        </span>
                      )}
                    </div>
                  </footer>
                )}
              </>
            )}
          </>
        </div>
      </div>
    </div>
  );
}
