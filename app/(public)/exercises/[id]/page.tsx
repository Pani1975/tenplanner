import { notFound } from "next/navigation";
import { db } from "@/db";
import { exercises, users, exerciseRatings } from "@/db/schema";
import { and, eq, avg, count } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ExerciseDetailClient } from "./exercise-detail-client";
import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import { getBooleanSetting } from "@/lib/app-settings";
import { canAccessExercise } from "@/lib/exercise-access";
import {
  exerciseNavQueryString,
  getFilteredExerciseIds,
} from "@/lib/nav/exercise-nav";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExercisePage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const navParams = await searchParams;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  let exercise;
  let dbUser;
  let ratingData: { avg: number | null; total: number } = {
    avg: null,
    total: 0,
  };
  let userRating: number | null = null;

  try {
    const [exerciseResult, userResult, ratingResult] = await Promise.all([
      db.select().from(exercises).where(eq(exercises.id, id)).limit(1),
      user
        ? db
            .select({ isAdmin: users.isAdmin })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ avg: avg(exerciseRatings.rating), total: count() })
        .from(exerciseRatings)
        .where(eq(exerciseRatings.exerciseId, id)),
    ]);
    exercise = exerciseResult[0];
    dbUser = (userResult as Array<{ isAdmin: boolean | null }>)[0];
    const row = ratingResult[0];
    ratingData = {
      avg: row?.avg != null ? Number(row.avg) : null,
      total: Number(row?.total ?? 0),
    };

    if (user) {
      const userRatingResult = await db
        .select({ rating: exerciseRatings.rating })
        .from(exerciseRatings)
        .where(
          and(
            eq(exerciseRatings.userId, user.id),
            eq(exerciseRatings.exerciseId, id)
          )
        )
        .limit(1);
      userRating = userRatingResult[0]?.rating ?? null;
    }
  } catch {
    notFound();
  }

  if (!exercise) notFound();

  const canAccess = await canAccessExercise(exercise, user?.id);
  if (!canAccess) notFound();

  const isAdmin = !!dbUser?.isAdmin;
  const isOwner = exercise.createdBy === user?.id;
  const canEdit = !!user && (isAdmin || (!exercise.isGlobal && isOwner));

  // Copiar a "Mis ejercicios": un ejercicio de la biblioteca se copia al
  // espacio activo (particular o club); uno que el propio monitor creó en
  // el espacio de un club se puede copiar a su espacio particular.
  const isPublicExercise = exercise.isGlobal || exercise.createdBy === null;
  const copyTargets: Array<"active" | "particular"> = [];
  if (user && isPublicExercise) copyTargets.push("active");
  if (user && isOwner && exercise.clubId) copyTargets.push("particular");

  const publicExercisesEnabled = await getBooleanSetting(
    "feature.public_exercises_enabled"
  );
  const navIds = await getFilteredExerciseIds(navParams, {
    userId: user?.id ?? null,
    publicExercisesEnabled,
  });
  const navIdx = navIds.indexOf(id);
  const navQs = exerciseNavQueryString(navParams);
  const navSuffix = navQs ? `?${navQs}` : "";
  const prevHref =
    navIdx > 0 ? `/exercises/${navIds[navIdx - 1]}${navSuffix}` : null;
  const nextHref =
    navIdx >= 0 && navIdx < navIds.length - 1
      ? `/exercises/${navIds[navIdx + 1]}${navSuffix}`
      : null;
  const backToSearchHref = navQs ? `/exercises?${navQs}` : null;

  return (
    <ExerciseDetailClient
      canEdit={canEdit}
      copyTargets={copyTargets}
      isAdmin={isAdmin}
      userId={user?.id ?? null}
      initialRating={userRating}
      ratingAvg={ratingData.avg}
      ratingTotal={ratingData.total}
      prevHref={prevHref}
      nextHref={nextHref}
      navPosition={navIdx >= 0 ? navIdx + 1 : null}
      navTotal={navIds.length > 0 ? navIds.length : null}
      backToSearchHref={backToSearchHref}
      diagram={getExerciseDiagram(exercise.id)}
      exercise={{
        id: exercise.id,
        name: exercise.name,
        sport: exercise.sport,
        description: exercise.description,
        category: exercise.category,
        difficulty: exercise.difficulty,
        durationMinutes: exercise.durationMinutes,
        objectives: exercise.objectives ?? null,
        steps:
          (exercise.steps as Array<{
            title: string;
            description: string;
          }> | null) ?? null,
        materials: (exercise.materials as string[] | null) ?? null,
        location:
          (exercise.location as "pista" | "pared" | "playa" | "casa" | null) ??
          null,
        videoUrl: exercise.videoUrl ?? null,
        tips: exercise.tips ?? null,
        imageUrl: exercise.imageUrl ?? null,
        imageUrls: (exercise.imageUrls as string[] | null) ?? null,
        variantes: exercise.variantes ?? null,
        observaciones: exercise.observaciones ?? null,
        formato:
          (exercise.formato as
            | "individual"
            | "parejas"
            | "grupal"
            | "multigrupo"
            | null) ?? null,
        numJugadores: exercise.numJugadores ?? null,
        tipoPelota: exercise.tipoPelota ?? null,
        tipoActividad:
          (exercise.tipoActividad as
            | "tecnico_tactico"
            | "fisico"
            | "cognitivo"
            | "competitivo"
            | "ludico"
            | null) ?? null,
        tiposActividad: (exercise.tiposActividad as string[] | null) ?? null,
        caracter: (exercise.caracter as string[] | null) ?? null,
        situacionJuego: (exercise.situacionJuego as string[] | null) ?? null,
        golpes: (exercise.golpes as string[] | null) ?? null,
        efecto: (exercise.efecto as string[] | null) ?? null,
        nivel: exercise.nivel ?? null,
        niveles: (exercise.niveles as string[] | null) ?? null,
        aspectoJuego: exercise.aspectoJuego ?? null,
        aspectosJuego: (exercise.aspectosJuego as string[] | null) ?? null,
        parametro: exercise.parametro ?? null,
        parametros: (exercise.parametros as string[] | null) ?? null,
        tipologia: exercise.tipologia ?? null,
        duracionRango: exercise.duracionRango ?? null,
        phase: exercise.phase ?? null,
        intensity: exercise.intensity ?? null,
        isGlobal: exercise.isGlobal,
        autoria: exercise.autoria ?? null,
        isAiGenerated: exercise.isAiGenerated,
        createdBy: exercise.createdBy,
        createdAt: exercise.createdAt.toISOString(),
        updatedAt: exercise.updatedAt.toISOString(),
      }}
    />
  );
}
