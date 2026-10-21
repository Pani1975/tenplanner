import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { exercises, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  exerciseOwnOrClubCondition,
  exerciseVisibleToUserCondition,
} from "@/lib/exercise-access";
import { getActiveWorkClubId } from "@/lib/clubs";
import { embedExercise } from "@/lib/ai/semantic-search";
import { getBooleanSetting } from "@/lib/app-settings";
import {
  deriveDurationMinutesFromRange,
  legacyTipologiaFrom,
  normalizeMultiValue,
} from "@/lib/exercise-taxonomy";
import {
  createExerciseSchema,
  exercisesListQuerySchema,
  zodValidationErrorResponse,
} from "./validation";
import { getActiveSport } from "@/lib/sports";

function internalServerError() {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function getAllParam(params: URLSearchParams, key: string) {
  const values = params.getAll(key).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function jsonbArrayHasAny(column: AnyColumn, values: string[]) {
  return or(
    ...values.map(
      (value) =>
        sql`coalesce(${column}::jsonb, '[]'::jsonb) @> ${JSON.stringify([value])}::jsonb`
    )
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const searchParams = request.nextUrl.searchParams;
  const parsedQuery = exercisesListQuerySchema.safeParse({
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    formato: getAllParam(searchParams, "formato"),
    numJugadores: getAllParam(searchParams, "numJugadores"),
    tipoPelota: getAllParam(searchParams, "tipoPelota"),
    tipoActividad: getAllParam(searchParams, "tipoActividad"),
    golpe: getAllParam(searchParams, "golpe"),
    efecto: getAllParam(searchParams, "efecto"),
    minDuracion: searchParams.get("minDuracion") ?? undefined,
    maxDuracion: searchParams.get("maxDuracion") ?? undefined,
    location: getAllParam(searchParams, "location"),
    phase: searchParams.get("phase") ?? undefined,
    intensity: searchParams.get("intensity") ?? undefined,
    nivel: getAllParam(searchParams, "nivel"),
    aspectoJuego: getAllParam(searchParams, "aspectoJuego"),
    parametro: getAllParam(searchParams, "parametro"),
    tipologia: getAllParam(searchParams, "tipologia"),
    duracionRango: getAllParam(searchParams, "duracionRango"),
    caracter: getAllParam(searchParams, "caracter"),
    situacionJuego: getAllParam(searchParams, "situacionJuego"),
    tipoCompeticion: getAllParam(searchParams, "tipoCompeticion"),
  });

  if (!parsedQuery.success) {
    return zodValidationErrorResponse(parsedQuery.error);
  }

  const {
    category,
    search,
    page,
    limit,
    formato,
    numJugadores,
    tipoPelota,
    tipoActividad,
    golpe,
    efecto,
    minDuracion,
    maxDuracion,
    location,
    phase,
    intensity,
    nivel,
    aspectoJuego,
    parametro,
    tipologia,
    duracionRango,
    caracter,
    situacionJuego,
    tipoCompeticion,
  } = parsedQuery.data;
  const activeTipoActividad = Array.from(
    new Set([...(tipoActividad ?? []), ...(tipologia ?? [])])
  );
  const offset = (page - 1) * limit;
  const publicExercisesEnabled = await getBooleanSetting(
    "feature.public_exercises_enabled"
  );
  const visibilityCondition = publicExercisesEnabled
    ? exerciseVisibleToUserCondition(user?.id)
    : user
      ? exerciseOwnOrClubCondition(user.id)
      : undefined;

  if (!visibilityCondition) {
    return NextResponse.json({
      data: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    });
  }

  const whereConditions: SQL[] = [visibilityCondition];

  if (user) {
    whereConditions.push(eq(exercises.sport, await getActiveSport(user.id)));
  }

  if (category) {
    whereConditions.push(eq(exercises.category, category));
  }

  if (search) {
    whereConditions.push(ilike(exercises.name, `%${search}%`));
  }

  if (formato?.length)
    whereConditions.push(inArray(exercises.formato, formato));
  if (numJugadores?.length) {
    whereConditions.push(inArray(exercises.numJugadores, numJugadores));
  }
  if (tipoPelota?.length) {
    whereConditions.push(inArray(exercises.tipoPelota, tipoPelota));
  }
  if (activeTipoActividad.length > 0) {
    const legacyTipologiaValues = activeTipoActividad.filter(
      (v) => v !== "cognitivo"
    );
    const activityConditions = [
      jsonbArrayHasAny(exercises.tiposActividad, activeTipoActividad),
    ].filter(Boolean) as SQL[];
    if (legacyTipologiaValues.length > 0) {
      activityConditions.push(
        inArray(exercises.tipologia, legacyTipologiaValues)
      );
    }
    if (activeTipoActividad.includes("cognitivo")) {
      activityConditions.push(eq(exercises.tipoActividad, "cognitivo"));
    }
    const activityWhere = or(...activityConditions);
    if (activityWhere) whereConditions.push(activityWhere);
  }
  if (golpe?.length) {
    const golpeWhere = jsonbArrayHasAny(exercises.golpes, golpe);
    if (golpeWhere) whereConditions.push(golpeWhere);
  }
  if (efecto?.length) {
    const efectoWhere = jsonbArrayHasAny(exercises.efecto, efecto);
    if (efectoWhere) whereConditions.push(efectoWhere);
  }
  if (minDuracion != null) {
    whereConditions.push(gte(exercises.durationMinutes, minDuracion));
  }
  if (maxDuracion != null) {
    whereConditions.push(lte(exercises.durationMinutes, maxDuracion));
  }
  if (location?.length)
    whereConditions.push(inArray(exercises.location, location));
  if (phase) {
    const phaseWhere = or(
      eq(exercises.phase, phase),
      jsonbArrayHasAny(exercises.fases, [phase])!
    );
    if (phaseWhere) whereConditions.push(phaseWhere);
  }
  if (intensity != null)
    whereConditions.push(eq(exercises.intensity, intensity));
  if (nivel?.length) {
    const nivelWhere = or(
      jsonbArrayHasAny(exercises.niveles, nivel)!,
      inArray(exercises.nivel, nivel)
    );
    if (nivelWhere) whereConditions.push(nivelWhere);
  }
  if (aspectoJuego?.length) {
    const aspectoWhere = or(
      jsonbArrayHasAny(exercises.aspectosJuego, aspectoJuego)!,
      inArray(exercises.aspectoJuego, aspectoJuego)
    );
    if (aspectoWhere) whereConditions.push(aspectoWhere);
  }
  if (parametro?.length) {
    const parametroWhere = or(
      jsonbArrayHasAny(exercises.parametros, parametro)!,
      inArray(exercises.parametro, parametro)
    );
    if (parametroWhere) whereConditions.push(parametroWhere);
  }
  if (duracionRango?.length) {
    whereConditions.push(inArray(exercises.duracionRango, duracionRango));
  }
  if (caracter?.length) {
    const caracterWhere = jsonbArrayHasAny(exercises.caracter, caracter);
    if (caracterWhere) whereConditions.push(caracterWhere);
  }
  if (situacionJuego?.length) {
    const situacionWhere = jsonbArrayHasAny(
      exercises.situacionJuego,
      situacionJuego
    );
    if (situacionWhere) whereConditions.push(situacionWhere);
  }
  if (tipoCompeticion?.length) {
    const competicionWhere = jsonbArrayHasAny(
      exercises.tipoCompeticion,
      tipoCompeticion
    );
    if (competicionWhere) whereConditions.push(competicionWhere);
  }

  const whereClause =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  try {
    const listBaseQuery = db
      .select({
        id: exercises.id,
        name: exercises.name,
        description: exercises.description,
        category: exercises.category,
        difficulty: exercises.difficulty,
        durationMinutes: exercises.durationMinutes,
        objectives: exercises.objectives,
        imageUrl: exercises.imageUrl,
        steps: exercises.steps,
        materials: exercises.materials,
        location: exercises.location,
        videoUrl: exercises.videoUrl,
        tips: exercises.tips,
        formato: exercises.formato,
        numJugadores: exercises.numJugadores,
        tipoPelota: exercises.tipoPelota,
        tipoActividad: exercises.tipoActividad,
        tiposActividad: exercises.tiposActividad,
        golpes: exercises.golpes,
        efecto: exercises.efecto,
        variantes: exercises.variantes,
        observaciones: exercises.observaciones,
        imageUrls: exercises.imageUrls,
        nivel: exercises.nivel,
        niveles: exercises.niveles,
        phase: exercises.phase,
        fases: exercises.fases,
        aspectoJuego: exercises.aspectoJuego,
        aspectosJuego: exercises.aspectosJuego,
        parametro: exercises.parametro,
        parametros: exercises.parametros,
        duracionRango: exercises.duracionRango,
        caracter: exercises.caracter,
        situacionJuego: exercises.situacionJuego,
        tipoCompeticion: exercises.tipoCompeticion,
        createdBy: exercises.createdBy,
        createdAt: exercises.createdAt,
        updatedAt: exercises.updatedAt,
      })
      .from(exercises);

    const items = await (
      whereClause ? listBaseQuery.where(whereClause) : listBaseQuery
    )
      .orderBy(desc(exercises.createdAt))
      .limit(limit)
      .offset(offset);

    const countBaseQuery = db.select({ total: count() }).from(exercises);
    const totalResult = await (whereClause
      ? countBaseQuery.where(whereClause)
      : countBaseQuery);

    const total = Number(totalResult[0]?.total ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch {
    return internalServerError();
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exerciseCreationEnabled = await getBooleanSetting(
    "feature.exercise_creation_enabled"
  );
  if (!exerciseCreationEnabled) {
    return NextResponse.json(
      { error: "La creación de ejercicios está desactivada." },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = createExerciseSchema.safeParse(body);

  if (!parsedBody.success) {
    return zodValidationErrorResponse(parsedBody.error);
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "User email is required" },
      { status: 403 }
    );
  }

  const totalImages =
    (parsedBody.data.imageUrl ? 1 : 0) +
    (parsedBody.data.imageUrls?.length ?? 0);
  if (totalImages > 4) {
    return NextResponse.json(
      { error: "Solo se permiten 4 imágenes por ejercicio" },
      { status: 400 }
    );
  }

  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email;

  try {
    await db
      .insert(users)
      .values({
        id: user.id,
        name: metadataName,
        email: user.email,
        image:
          typeof user.user_metadata?.avatar_url === "string"
            ? user.user_metadata.avatar_url
            : null,
      })
      .onConflictDoNothing();

    const [dbUser] = await db
      .select({ isAdmin: users.isAdmin, tenPlannerMode: users.tenPlannerMode })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    // Solo un administrador en Modo Ten Planner publica en la Biblioteca.
    const isAdmin = !!dbUser?.isAdmin && !!dbUser?.tenPlannerMode;
    const [sport, activeClubId] = await Promise.all([
      getActiveSport(user.id),
      getActiveWorkClubId(user.id),
    ]);

    const {
      isGlobal: requestedIsGlobal,
      autoria: requestedAutoria,
      ...rest
    } = parsedBody.data;
    const isGlobal = isAdmin && requestedIsGlobal === true;
    const niveles = normalizeMultiValue(
      rest.niveles ?? (rest.nivel ? [rest.nivel] : null)
    );
    const fases = normalizeMultiValue(
      rest.fases ?? (rest.phase ? [rest.phase] : null)
    );
    const aspectosJuego = normalizeMultiValue(
      rest.aspectosJuego ?? (rest.aspectoJuego ? [rest.aspectoJuego] : null)
    );
    const parametros = normalizeMultiValue(
      rest.parametros ?? (rest.parametro ? [rest.parametro] : null)
    );
    const tiposActividad = normalizeMultiValue(
      rest.tiposActividad ??
        (rest.tipologia
          ? [rest.tipologia]
          : rest.tipoActividad === "cognitivo"
            ? ["cognitivo"]
            : null)
    );
    const durationMinutes =
      rest.durationMinutes ??
      deriveDurationMinutesFromRange(rest.duracionRango) ??
      null;

    if (durationMinutes == null) {
      return NextResponse.json(
        { error: "El rango de duración es obligatorio." },
        { status: 400 }
      );
    }

    const legacyTipoActividad = tiposActividad?.includes("cognitivo")
      ? "cognitivo"
      : null;
    const legacyTipologia = legacyTipologiaFrom(tiposActividad);

    const [createdExercise] = await db
      .insert(exercises)
      .values({
        ...rest,
        durationMinutes,
        description: rest.description ?? null,
        objectives: rest.objectives ?? null,
        imageUrl: rest.imageUrl ?? null,
        tips: rest.tips ?? null,
        location: rest.location ?? null,
        videoUrl: rest.videoUrl ?? null,
        phase: fases?.[0] ?? null,
        fases,
        intensity: rest.intensity ?? null,
        formato: rest.formato ?? null,
        numJugadores: rest.numJugadores ?? null,
        tipoPelota: rest.tipoPelota ?? null,
        tipoActividad: legacyTipoActividad,
        golpes: rest.golpes ?? null,
        efecto: rest.efecto ?? null,
        variantes: rest.variantes ?? null,
        observaciones: rest.observaciones ?? null,
        imageUrls: rest.imageUrls ?? null,
        steps: rest.steps ?? null,
        materials: rest.materials ?? null,
        nivel: niveles?.[0] ?? null,
        niveles,
        aspectoJuego: aspectosJuego?.[0] ?? null,
        aspectosJuego,
        parametro: parametros?.[0] ?? null,
        parametros,
        tipologia: legacyTipologia,
        tiposActividad,
        duracionRango: rest.duracionRango ?? null,
        caracter: normalizeMultiValue(rest.caracter),
        situacionJuego: normalizeMultiValue(rest.situacionJuego),
        tipoCompeticion: normalizeMultiValue(rest.tipoCompeticion),
        isGlobal,
        autoria: isAdmin ? (requestedAutoria ?? "ten_planner") : "libre",
        createdBy: user.id,
        // Creado trabajando como un club → compartido en "Mis ejercicios"
        // del espacio de ese club. Los globales (biblioteca) no son de club.
        clubId: isGlobal ? null : activeClubId,
        sport,
      })
      .returning();

    after(() =>
      embedExercise({
        id: createdExercise.id,
        ownerId: createdExercise.isGlobal ? null : user.id,
        name: createdExercise.name,
        category: createdExercise.category,
        difficulty: createdExercise.difficulty,
        durationMinutes,
        description: createdExercise.description,
        objectives: createdExercise.objectives,
        tips: createdExercise.tips,
        materials: createdExercise.materials as string[] | null,
        location: createdExercise.location,
      }).catch(console.error)
    );

    return NextResponse.json({ data: createdExercise }, { status: 201 });
  } catch {
    return internalServerError();
  }
}
