import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  exercises,
  sessions,
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
  sessionStudents,
  students,
  exerciseListItems,
  exerciseLists,
  places,
  users,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getActiveWorkClubId } from "@/lib/clubs";
import { exerciseListSpaceCondition } from "@/lib/exercises/lists";
import { SessionDetailClient } from "./session-detail-client";
import { getExerciseDiagrams } from "@/lib/exercise-diagrams";
import {
  computeSessionAnalytics,
  resolveIntensity,
  resolvePhase,
  type AnalyticsExerciseInput,
} from "@/lib/sessions/analytics";
import { getFavoritedSessionIds } from "@/lib/sessions/favorites";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import {
  resolveItemKind,
  resolveBlockItemDuration,
  type StationItemJson,
} from "@/lib/block-items";
import {
  getFilteredSessionIds,
  sessionNavQueryString,
} from "@/lib/nav/session-nav";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; q?: string; sort?: string }>;
}

export default async function SessionPage({ params, searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();
  const user = authSession?.user ?? null;

  if (!user) redirect("/login");

  const { id } = await params;
  const navParams = await searchParams;

  const [
    [sessionRow],
    exerciseRows,
    allExercises,
    studentRows,
    favRows,
    blockRows,
  ] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.id, id)).limit(1),
    db
      .select({
        exerciseId: exercises.id,
        name: exercises.name,
        category: exercises.category,
        difficulty: exercises.difficulty,
        orderIndex: sessionExercises.orderIndex,
        durationMinutes: sessionExercises.durationMinutes,
        defaultDurationMinutes: exercises.durationMinutes,
        notes: sessionExercises.notes,
        overridePhase: sessionExercises.phase,
        overrideIntensity: sessionExercises.intensity,
        exercisePhase: exercises.phase,
        exerciseIntensity: exercises.intensity,
        coachRating: sessionExercises.coachRating,
        actualDurationSeconds: sessionExercises.actualDurationSeconds,
        completedAt: sessionExercises.completedAt,
        executionNotes: sessionExercises.executionNotes,
        wasSkipped: sessionExercises.wasSkipped,
        materials: exercises.materials,
        description: exercises.description,
        aspectosJuego: exercises.aspectosJuego,
        aspectoJuego: exercises.aspectoJuego,
      })
      .from(sessionExercises)
      .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
      .where(eq(sessionExercises.sessionId, id))
      .orderBy(asc(sessionExercises.orderIndex)),
    db
      .select({
        id: exercises.id,
        name: exercises.name,
        category: exercises.category,
        difficulty: exercises.difficulty,
        durationMinutes: exercises.durationMinutes,
      })
      .from(exercises)
      .where(exerciseVisibleToUserCondition(user.id))
      .orderBy(exercises.name)
      .limit(200),
    db
      .select({
        id: students.id,
        name: students.name,
        imageUrl: students.imageUrl,
        attended: sessionStudents.attended,
        rating: sessionStudents.rating,
        feedback: sessionStudents.feedback,
      })
      .from(sessionStudents)
      .innerJoin(students, eq(sessionStudents.studentId, students.id))
      .where(eq(sessionStudents.sessionId, id))
      .orderBy(asc(students.name)),
    db
      .select({ exerciseId: exerciseListItems.exerciseId })
      .from(exerciseListItems)
      .innerJoin(exerciseLists, eq(exerciseLists.id, exerciseListItems.listId))
      .where(
        exerciseListSpaceCondition(user.id, await getActiveWorkClubId(user.id))
      ),
    db
      .select({
        blockId: sessionBlocks.id,
        blockOrderIndex: sessionBlocks.orderIndex,
        blockTitle: sessionBlocks.title,
        blockNotes: sessionBlocks.notes,
        itemId: sessionBlockItems.id,
        itemOrderIndex: sessionBlockItems.orderIndex,
        itemExerciseId: sessionBlockItems.exerciseId,
        itemExerciseName: sessionBlockItems.exerciseName,
        itemExerciseDescription: sessionBlockItems.exerciseDescription,
        itemFreeText: sessionBlockItems.freeText,
        itemTitle: sessionBlockItems.title,
        itemDurationMinutes: sessionBlockItems.durationMinutes,
        itemNotes: sessionBlockItems.notes,
        itemKind: sessionBlockItems.kind,
        itemStations: sessionBlockItems.stations,
        itemAspectoJuego: sessionBlockItems.aspectoJuego,
        itemCoachComment: sessionBlockItems.coachComment,
      })
      .from(sessionBlocks)
      .leftJoin(
        sessionBlockItems,
        eq(sessionBlockItems.blockId, sessionBlocks.id)
      )
      .where(eq(sessionBlocks.sessionId, id))
      .orderBy(
        asc(sessionBlocks.orderIndex),
        asc(sessionBlockItems.orderIndex)
      ),
  ]);

  const session = sessionRow;
  if (!session) notFound();
  const isOwner = session.userId === user.id;
  const [placeRow] = session.placeId
    ? await db
        .select({ name: places.name })
        .from(places)
        .where(eq(places.id, session.placeId))
        .limit(1)
    : [];
  if (!isOwner) {
    const activeClubId = session.clubId
      ? await getActiveWorkClubId(user.id)
      : null;
    if (!session.clubId || session.clubId !== activeClubId) notFound();
  }
  const authorName = isOwner
    ? null
    : ((
        await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1)
      )[0]?.name ?? null);

  const favoritedIds = new Set(favRows.map((f) => f.exerciseId));

  const resolvedExercises = exerciseRows.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.name,
    category: e.category,
    difficulty: e.difficulty,
    orderIndex: e.orderIndex,
    durationMinutes: e.durationMinutes ?? e.defaultDurationMinutes,
    notes: e.notes,
    coachRating: e.coachRating,
    actualDurationSeconds: e.actualDurationSeconds,
    completedAt: e.completedAt ? e.completedAt.toISOString() : null,
    executionNotes: e.executionNotes,
    wasSkipped: e.wasSkipped,
    materials: Array.isArray(e.materials) ? e.materials : [],
    description: e.description ?? null,
  }));

  // Ejercicios de biblioteca vinculados directamente a la sesión (no
  // cuentan el tiempo de calentamientos, textos libres ni estaciones:
  // eso se añade más abajo a partir de los bloques, para que la duración
  // total del resumen coincida con la duración real del plan).
  const exerciseAnalyticsInput: AnalyticsExerciseInput[] = exerciseRows.map(
    (e) => ({
      orderIndex: e.orderIndex,
      durationMinutes: e.durationMinutes ?? e.defaultDurationMinutes,
      category: e.category,
      difficulty: e.difficulty,
      resolvedPhase: resolvePhase(e.overridePhase, e.exercisePhase),
      resolvedIntensity: resolveIntensity(
        e.overrideIntensity,
        e.exerciseIntensity
      ),
      name: e.name,
      aspectos:
        Array.isArray(e.aspectosJuego) && e.aspectosJuego.length > 0
          ? e.aspectosJuego
          : e.aspectoJuego
            ? [e.aspectoJuego]
            : null,
    })
  );

  const tags = Array.isArray(session.tags) ? session.tags : [];

  const sessionBlocksData = blockRows.reduce<
    Array<{
      id: string;
      orderIndex: number;
      title: string | null;
      notes: string | null;
      items: Array<{
        id: string;
        orderIndex: number;
        exerciseId: string | null;
        exerciseName: string | null;
        exerciseDescription: string | null;
        freeText: string | null;
        title: string | null;
        durationMinutes: number | null;
        notes: string | null;
        kind: "exercise" | "text" | "warmup" | "stations";
        stations: StationItemJson[];
        aspectoJuego: string | null;
        coachComment: string | null;
      }>;
    }>
  >((blocks, row) => {
    let block = blocks.find((candidate) => candidate.id === row.blockId);
    if (!block) {
      block = {
        id: row.blockId,
        orderIndex: row.blockOrderIndex,
        title: row.blockTitle,
        notes: row.blockNotes,
        items: [],
      };
      blocks.push(block);
    }
    if (row.itemId) {
      block.items.push({
        id: row.itemId,
        orderIndex: row.itemOrderIndex ?? 0,
        exerciseId: row.itemExerciseId,
        exerciseName: row.itemExerciseName,
        exerciseDescription: row.itemExerciseDescription,
        freeText: row.itemFreeText,
        title: row.itemTitle,
        durationMinutes: row.itemDurationMinutes,
        notes: row.itemNotes,
        kind: resolveItemKind({
          kind: row.itemKind,
          exerciseId: row.itemExerciseId,
          freeText: row.itemFreeText,
        }),
        stations: (row.itemStations as StationItemJson[] | null) ?? [],
        aspectoJuego: row.itemAspectoJuego,
        coachComment: row.itemCoachComment,
      });
    }
    return blocks;
  }, []);

  // Duración por defecto de un ejercicio de biblioteca, para resolver la
  // de los items de bloque de tipo "exercise" que no tengan duración
  // propia (p. ej. estaciones que referencian un ejercicio).
  const exerciseDurationById = new Map(
    exerciseRows.map((e) => [e.exerciseId, e.defaultDurationMinutes])
  );

  function blockOrderToPhase(orderIndex: number) {
    if (orderIndex === 1) return "activation" as const;
    if (orderIndex === 3) return "cooldown" as const;
    return "main" as const;
  }

  // Calentamientos, textos libres y estaciones no están en sessionExercises
  // (esa tabla solo guarda los ejercicios de biblioteca de los bloques), así
  // que su duración se añade aquí para que "Duración" en el resumen de la
  // sesión coincida con la duración real del plan (la que se ve en la
  // cabecera y se usó para calcular session.durationMinutes al guardar).
  const blockExtrasAnalyticsInput: AnalyticsExerciseInput[] = [];
  for (const block of sessionBlocksData) {
    const phase = blockOrderToPhase(block.orderIndex);
    for (const item of block.items) {
      if (item.kind === "exercise") continue; // ya contado arriba
      const durationMinutes = resolveBlockItemDuration(
        {
          kind: item.kind,
          exerciseId: item.exerciseId,
          freeText: item.freeText,
          durationMinutes: item.durationMinutes,
        },
        exerciseDurationById
      );
      // El aspecto que el monitor eligió al crear el texto libre (si lo
      // hizo) alimenta tanto el desglose por categoría como el de aspecto
      // del juego, para que cuente en las estadísticas sin necesidad de
      // una ficha de ejercicio completa.
      const aspecto = item.aspectoJuego;
      const categoryFromAspecto: Record<string, string> = {
        tecnica: "technique",
        tactica: "tactics",
        fisico: "fitness",
      };
      blockExtrasAnalyticsInput.push({
        orderIndex: 1000 + block.orderIndex * 100 + item.orderIndex,
        durationMinutes,
        category:
          item.kind === "warmup"
            ? "warm-up"
            : (aspecto && categoryFromAspecto[aspecto]) || "unclassified",
        difficulty: "unclassified",
        resolvedPhase: phase,
        resolvedIntensity: null,
        name:
          item.title?.trim() ||
          (item.kind === "warmup"
            ? "Descanso"
            : item.kind === "stations"
              ? "Estaciones"
              : item.freeText?.trim().slice(0, 60) || "Texto libre"),
        aspectos: aspecto ? [aspecto] : null,
      });
    }
  }

  const analyticsInput = [
    ...exerciseAnalyticsInput,
    ...blockExtrasAnalyticsInput,
  ];

  const analytics = computeSessionAnalytics(
    analyticsInput,
    studentRows.length,
    tags.length
  );

  const favoritedSessionIds = await getFavoritedSessionIds(user.id, [
    session.id,
  ]);

  const navIds = await getFilteredSessionIds(navParams, { userId: user.id });
  const navIdx = navIds.indexOf(id);
  const navQs = sessionNavQueryString(navParams);
  const navSuffix = navQs ? `?${navQs}` : "";
  const prevHref =
    navIdx > 0 ? `/sessions/${navIds[navIdx - 1]}${navSuffix}` : null;
  const nextHref =
    navIdx >= 0 && navIdx < navIds.length - 1
      ? `/sessions/${navIds[navIdx + 1]}${navSuffix}`
      : null;
  const backToSearchHref = navQs ? `/sessions?${navQs}` : null;

  return (
    <SessionDetailClient
      prevHref={prevHref}
      nextHref={nextHref}
      navPosition={navIdx >= 0 ? navIdx + 1 : null}
      navTotal={navIds.length > 0 ? navIds.length : null}
      backToSearchHref={backToSearchHref}
      isOwner={isOwner}
      authorName={authorName}
      session={{
        id: session.id,
        title: session.title,
        description: session.description,
        scheduledAt: session.scheduledAt.toISOString(),
        durationMinutes: session.durationMinutes,
        userId: session.userId,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        objective: session.objective,
        material: session.material,
        observations: session.observations,
        coachComment: session.coachComment,
        sourceClassId: session.sourceClassId,
        intensity: session.intensity,
        tags,
        location: session.location,
        placeName: placeRow?.name ?? null,
        status: session.status,
      }}
      sessionExercises={resolvedExercises}
      diagrams={getExerciseDiagrams(resolvedExercises.map((e) => e.exerciseId))}
      availableExercises={allExercises}
      analytics={analytics}
      students={studentRows}
      favoritedExerciseIds={Array.from(favoritedIds)}
      sessionBlocks={sessionBlocksData}
      isFavorite={favoritedSessionIds.has(session.id)}
    />
  );
}
