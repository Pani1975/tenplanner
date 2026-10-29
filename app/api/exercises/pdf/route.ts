import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
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
import { db } from "@/db";
import {
  exercises as exercisesTable,
  exerciseListItems,
  exerciseLists,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveSport } from "@/lib/sports";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { spaceLabels } from "@/lib/space-labels";
import { exerciseListSpaceCondition } from "@/lib/exercises/lists";
import { getPublicSportCookie } from "@/lib/public-sport";
import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import { ExerciseListPdf, type PdfExercise } from "@/lib/exercises/pdf";
import {
  AUTORIA_VALUES,
  autoriaLabel,
  CARACTER_VALUES,
  caracterLabel,
  FASES,
  pelotaLabel,
  SITUACION_JUEGO_VALUES,
  TIPO_COMPETICION_VALUES,
  situacionJuegoLabel,
  tipoCompeticionLabel,
  TIPO_PELOTA_VALUES,
  TIPO_ACTIVIDAD_LABELS,
  type TipoPelota,
} from "@/lib/exercise-taxonomy";
import { EXERCISE_SORTS, type ExerciseSort } from "@/lib/nav/exercise-nav";

// Misma lógica de filtrado y visibilidad que app/(public)/exercises/page.tsx
// — si se cambia un filtro ahí, hay que reflejarlo también aquí. Igual que
// ya ocurre entre esa página y lib/nav/exercise-nav.ts.

type Category = "technique" | "tactics" | "fitness" | "warm-up";
type Difficulty = "beginner" | "intermediate" | "advanced";

const CATEGORIES = [
  "all",
  "technique",
  "tactics",
  "fitness",
  "warm-up",
] as const;
const DIFFICULTIES = ["all", "beginner", "intermediate", "advanced"] as const;
const TABS = ["all", "global", "mine", "favorites"] as const;

const CATEGORY_LABEL: Record<Category, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

const FORMATO_LABEL: Record<string, string> = {
  individual: "Individual",
  parejas: "Parejas",
  grupal: "Grupal",
  multigrupo: "Multigrupo",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Iniciación",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

/** Tope de ejercicios por PDF, para que no se dispare el tiempo de render
 * ni el tamaño del archivo en una búsqueda sin apenas filtrar. */
const MAX_EXERCISES = 150;

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

function getTipoActividadLabel(value: string) {
  return (
    TIPO_ACTIVIDAD_LABELS[value as keyof typeof TIPO_ACTIVIDAD_LABELS] ??
    value.replace(/_/g, " ")
  );
}

function exerciseOrderBy(sort: ExerciseSort) {
  switch (sort) {
    case "popular":
      return [
        sql`(select count(*)::int from session_exercises se where se.exercise_id = ${exercisesTable.id}) desc`,
        asc(exercisesTable.name),
      ];
    case "recent":
      return [desc(exercisesTable.createdAt)];
    case "oldest":
      return [asc(exercisesTable.createdAt)];
    case "alpha":
    default:
      return [asc(exercisesTable.name)];
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params: Record<string, string | string[] | undefined> = {};
  for (const key of searchParams.keys()) {
    const values = searchParams.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const publicExercisesEnabled = await getBooleanSetting(
    "feature.public_exercises_enabled"
  );
  if (!publicExercisesEnabled && !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sport = user
    ? await getActiveSport(user.id)
    : await getPublicSportCookie();
  if (!sport) {
    return NextResponse.json({ error: "No sport selected" }, { status: 400 });
  }

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
  const activeTab: (typeof TABS)[number] =
    !user && (requestedTab === "mine" || requestedTab === "favorites")
      ? "all"
      : !publicExercisesEnabled && requestedTab === "global"
        ? "mine"
        : requestedTab;

  const searchTerm = getString(params.q).trim();
  const activeSort = (
    (EXERCISE_SORTS as readonly string[]).includes(getString(params.sort))
      ? getString(params.sort)
      : "alpha"
  ) as ExerciseSort;

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
  const activeTipoCompeticion = getStrings(params.tipoCompeticion).filter((v) =>
    (TIPO_COMPETICION_VALUES as readonly string[]).includes(v)
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

  const sportWhere = eq(exercisesTable.sport, sport);

  // Mismo espacio activo que la página /exercises ("Ejercicios club"…).
  const activeWorkClubId = user ? await getActiveWorkClubId(user.id) : null;
  const mineWhere = user
    ? sharedWithClubCondition(
        exercisesTable.createdBy,
        exercisesTable.clubId,
        user.id,
        activeWorkClubId
      )
    : sql`1=0`;

  const favRows = user
    ? await db
        .select({ exerciseId: exerciseListItems.exerciseId })
        .from(exerciseListItems)
        .innerJoin(
          exerciseLists,
          eq(exerciseLists.id, exerciseListItems.listId)
        )
        .where(exerciseListSpaceCondition(user.id, activeWorkClubId))
        .catch(() => [] as { exerciseId: string }[])
    : [];
  const favIdArray = favRows.map((f) => f.exerciseId);

  const allVisibleWhere = and(
    sportWhere,
    user
      ? publicExercisesEnabled
        ? (or(eq(exercisesTable.isGlobal, true), mineWhere) ?? mineWhere)
        : mineWhere
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
        ? and(sportWhere, mineWhere)!
        : allVisibleWhere;

  const conditions: SQL[] = [];
  if (activeTab === "favorites" && user) {
    conditions.push(sportWhere);
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
    const faseWhere = or(
      inArray(exercisesTable.phase, activeFase),
      jsonbArrayHasAny(exercisesTable.fases, activeFase)!
    );
    if (faseWhere) conditions.push(faseWhere);
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
  if (activeTipoCompeticion.length > 0) {
    const competicionWhere = jsonbArrayHasAny(
      exercisesTable.tipoCompeticion,
      activeTipoCompeticion
    );
    if (competicionWhere) conditions.push(competicionWhere);
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

  const [totalRows, rows] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(exercisesTable)
      .where(where),
    db
      .select({
        id: exercisesTable.id,
        name: exercisesTable.name,
        category: exercisesTable.category,
        difficulty: exercisesTable.difficulty,
        durationMinutes: exercisesTable.durationMinutes,
        description: exercisesTable.description,
        steps: exercisesTable.steps,
        materials: exercisesTable.materials,
        tips: exercisesTable.tips,
      })
      .from(exercisesTable)
      .where(where)
      .orderBy(...exerciseOrderBy(activeSort))
      .limit(MAX_EXERCISES),
  ]);

  const total = Number(totalRows[0]?.total ?? rows.length);
  const truncated = total > rows.length;

  const pdfExercises: PdfExercise[] = rows.map((row, orderIndex) => ({
    kind: "exercise",
    name: row.name,
    category: row.category as PdfExercise["category"],
    difficulty: row.difficulty as PdfExercise["difficulty"],
    orderIndex,
    durationMinutes: row.durationMinutes,
    notes: null,
    phase: null,
    intensity: null,
    materials: row.materials as string[] | null,
    description: row.description,
    steps: row.steps as PdfExercise["steps"],
    tips: row.tips,
    blockTitle: "Ejercicios",
    diagram: getExerciseDiagram(row.id),
  }));

  const summaryParts: string[] = [];
  if (activeCategory !== "all")
    summaryParts.push(CATEGORY_LABEL[activeCategory]);
  if (activeDifficulty !== "all")
    summaryParts.push(DIFFICULTY_LABEL[activeDifficulty]);
  if (searchTerm) summaryParts.push(`"${searchTerm}"`);
  if (activeTab !== "all")
    summaryParts.push(
      activeTab === "global"
        ? "Biblioteca"
        : activeTab === "mine"
          ? spaceLabels(!!activeWorkClubId).exercises
          : spaceLabels(!!activeWorkClubId).favorites
    );
  for (const value of activeFormato)
    summaryParts.push(FORMATO_LABEL[value] ?? value);
  for (const value of activeNivel) summaryParts.push(value.replace(/_/g, " "));
  for (const value of activeTipoPelota) summaryParts.push(pelotaLabel(value));
  for (const value of activeTipoActividad)
    summaryParts.push(getTipoActividadLabel(value));
  for (const value of activeCaracter) summaryParts.push(caracterLabel(value));
  for (const value of activeSituacionJuego)
    summaryParts.push(situacionJuegoLabel(value));
  for (const value of activeTipoCompeticion)
    summaryParts.push(tipoCompeticionLabel(value));
  for (const value of activeAutoria) summaryParts.push(autoriaLabel(value));

  const filtersSummary =
    summaryParts.length > 0 ? `Filtros: ${summaryParts.join(" · ")}` : null;

  try {
    const element = createElement(ExerciseListPdf, {
      list: {
        title: "Resultados de la búsqueda",
        filtersSummary,
        total,
        truncated,
        exercises: pdfExercises,
      },
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await renderToStream(element);
    const buffer = await streamToBuffer(
      stream as unknown as NodeJS.ReadableStream
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ejercicios-filtrados.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[exercises/pdf] render failed", { err });
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
