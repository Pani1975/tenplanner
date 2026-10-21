import { isTenPlannerMode } from "@/lib/work-mode";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exercises, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { canAccessExercise } from "@/lib/exercise-access";
import { embedExercise } from "@/lib/ai/semantic-search";
import {
  deriveDurationMinutesFromRange,
  legacyTipologiaFrom,
  normalizeMultiValue,
} from "@/lib/exercise-taxonomy";
import {
  exerciseIdParamsSchema,
  updateExerciseSchema,
  zodValidationErrorResponse,
} from "../validation";

function internalServerError() {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

type ExerciseRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: ExerciseRouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = exerciseIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return zodValidationErrorResponse(parsedParams.error);
  }

  try {
    const [exercise] = await db
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
        createdBy: exercises.createdBy,
        isGlobal: exercises.isGlobal,
        clubId: exercises.clubId,
        autoria: exercises.autoria,
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
        aspectoJuego: exercises.aspectoJuego,
        aspectosJuego: exercises.aspectosJuego,
        parametro: exercises.parametro,
        parametros: exercises.parametros,
        tipologia: exercises.tipologia,
        duracionRango: exercises.duracionRango,
        caracter: exercises.caracter,
        situacionJuego: exercises.situacionJuego,
        tipoCompeticion: exercises.tipoCompeticion,
        phase: exercises.phase,
        fases: exercises.fases,
        intensity: exercises.intensity,
        createdAt: exercises.createdAt,
        updatedAt: exercises.updatedAt,
      })
      .from(exercises)
      .where(eq(exercises.id, parsedParams.data.id))
      .limit(1);

    if (!exercise) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    const canAccess = await canAccessExercise(exercise, user.id);

    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: exercise });
  } catch {
    return internalServerError();
  }
}

// Administradores y la cuenta de la plataforma (la Biblioteca pública solo la
// edita esta última: ver isTenPlannerMode más abajo).
async function getCurrentUserIsAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({
      isAdmin: users.isAdmin,
      isPlatformAccount: users.isPlatformAccount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!row?.isAdmin || !!row?.isPlatformAccount;
}

export async function PUT(request: Request, context: ExerciseRouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = exerciseIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return zodValidationErrorResponse(parsedParams.error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = updateExerciseSchema.safeParse(body);

  if (!parsedBody.success) {
    return zodValidationErrorResponse(parsedBody.error);
  }

  try {
    const [existing] = await db
      .select({
        id: exercises.id,
        isGlobal: exercises.isGlobal,
        createdBy: exercises.createdBy,
        imageUrl: exercises.imageUrl,
        imageUrls: exercises.imageUrls,
      })
      .from(exercises)
      .where(eq(exercises.id, parsedParams.data.id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    const isAdmin = await getCurrentUserIsAdmin(user.id);

    if (existing.isGlobal && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // La Biblioteca pública solo se edita en Modo Ten Planner.
    if (existing.isGlobal && !(await isTenPlannerMode(user.id))) {
      return NextResponse.json(
        {
          error: "La Biblioteca pública solo se edita en Modo Ten Planner",
        },
        { status: 403 }
      );
    }
    if (
      !existing.isGlobal &&
      existing.createdBy &&
      existing.createdBy !== user.id &&
      !isAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const d = parsedBody.data;
    const finalImageUrl =
      d.imageUrl !== undefined ? (d.imageUrl ?? null) : existing.imageUrl;
    const finalImageUrls =
      d.imageUrls !== undefined
        ? (d.imageUrls ?? null)
        : ((existing.imageUrls as string[] | null) ?? null);
    const totalImages = (finalImageUrl ? 1 : 0) + (finalImageUrls?.length ?? 0);

    if (totalImages > 4) {
      return NextResponse.json(
        { error: "Solo se permiten 4 imágenes por ejercicio" },
        { status: 400 }
      );
    }

    const updateValues: Record<string, unknown> = {};

    const fields = [
      "name",
      "description",
      "category",
      "difficulty",
      "objectives",
      "imageUrl",
      "tips",
      "location",
      "videoUrl",
      "steps",
      "materials",
      "intensity",
      "formato",
      "numJugadores",
      "tipoPelota",
      "golpes",
      "efecto",
      "variantes",
      "observaciones",
      "imageUrls",
      "duracionRango",
    ] as const;

    for (const field of fields) {
      if (d[field] !== undefined) {
        updateValues[field] = d[field];
      }
    }

    if (d.caracter !== undefined) {
      updateValues.caracter = normalizeMultiValue(d.caracter);
    }
    if (d.situacionJuego !== undefined) {
      updateValues.situacionJuego = normalizeMultiValue(d.situacionJuego);
    }
    if (d.tipoCompeticion !== undefined) {
      updateValues.tipoCompeticion = normalizeMultiValue(d.tipoCompeticion);
    }

    if (d.durationMinutes !== undefined && d.durationMinutes !== null) {
      updateValues.durationMinutes = d.durationMinutes;
    } else if (d.duracionRango !== undefined && d.duracionRango !== null) {
      const derivedDuration = deriveDurationMinutesFromRange(d.duracionRango);
      if (derivedDuration == null) {
        return NextResponse.json(
          { error: "El rango de duración es inválido." },
          { status: 400 }
        );
      }
      updateValues.durationMinutes = derivedDuration;
    }

    if (d.fases !== undefined || d.phase !== undefined) {
      const fases = normalizeMultiValue(
        d.fases ?? (d.phase ? [d.phase] : null)
      );
      updateValues.fases = fases;
      updateValues.phase = fases?.[0] ?? null;
    }

    if (d.niveles !== undefined || d.nivel !== undefined) {
      const niveles = normalizeMultiValue(
        d.niveles ?? (d.nivel ? [d.nivel] : null)
      );
      updateValues.niveles = niveles;
      updateValues.nivel = niveles?.[0] ?? null;
    }

    if (d.aspectosJuego !== undefined || d.aspectoJuego !== undefined) {
      const aspectosJuego = normalizeMultiValue(
        d.aspectosJuego ?? (d.aspectoJuego ? [d.aspectoJuego] : null)
      );
      updateValues.aspectosJuego = aspectosJuego;
      updateValues.aspectoJuego = aspectosJuego?.[0] ?? null;
    }

    if (d.parametros !== undefined || d.parametro !== undefined) {
      const parametros = normalizeMultiValue(
        d.parametros ?? (d.parametro ? [d.parametro] : null)
      );
      updateValues.parametros = parametros;
      updateValues.parametro = parametros?.[0] ?? null;
    }

    if (
      d.tiposActividad !== undefined ||
      d.tipologia !== undefined ||
      d.tipoActividad !== undefined
    ) {
      const tiposActividad = normalizeMultiValue(
        d.tiposActividad ??
          (d.tipologia
            ? [d.tipologia]
            : d.tipoActividad === "cognitivo"
              ? ["cognitivo"]
              : null)
      );
      updateValues.tiposActividad = tiposActividad;
      updateValues.tipoActividad = tiposActividad?.includes("cognitivo")
        ? "cognitivo"
        : null;
      updateValues.tipologia = legacyTipologiaFrom(tiposActividad);
    }

    // Publicar o retirar de la Biblioteca solo en Modo Ten Planner.
    const canPublish = isAdmin && (await isTenPlannerMode(user.id));
    if (canPublish && d.isGlobal !== undefined) {
      updateValues.isGlobal = d.isGlobal;
    }

    if (canPublish && d.autoria !== undefined) {
      updateValues.autoria = d.autoria ?? "libre";
    }

    const [updatedExercise] = await db
      .update(exercises)
      .set(updateValues)
      .where(eq(exercises.id, parsedParams.data.id))
      .returning();

    if (!updatedExercise) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    after(() =>
      embedExercise({
        id: updatedExercise.id,
        ownerId: updatedExercise.isGlobal
          ? null
          : (updatedExercise.createdBy ?? user.id),
        name: updatedExercise.name,
        category: updatedExercise.category,
        difficulty: updatedExercise.difficulty,
        durationMinutes: updatedExercise.durationMinutes,
        description: updatedExercise.description,
        objectives: updatedExercise.objectives,
        tips: updatedExercise.tips,
        materials: updatedExercise.materials as string[] | null,
        location: updatedExercise.location,
      }).catch(console.error)
    );

    return NextResponse.json({ data: updatedExercise });
  } catch {
    return internalServerError();
  }
}

export async function DELETE(_request: Request, context: ExerciseRouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const parsedParams = exerciseIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return zodValidationErrorResponse(parsedParams.error);
  }

  try {
    const [existing] = await db
      .select({
        id: exercises.id,
        isGlobal: exercises.isGlobal,
        createdBy: exercises.createdBy,
      })
      .from(exercises)
      .where(eq(exercises.id, parsedParams.data.id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    const isAdmin = await getCurrentUserIsAdmin(user.id);

    if (existing.isGlobal && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // La Biblioteca pública solo se edita en Modo Ten Planner.
    if (existing.isGlobal && !(await isTenPlannerMode(user.id))) {
      return NextResponse.json(
        {
          error: "La Biblioteca pública solo se edita en Modo Ten Planner",
        },
        { status: 403 }
      );
    }
    if (
      !existing.isGlobal &&
      existing.createdBy &&
      existing.createdBy !== user.id &&
      !isAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [deletedExercise] = await db
      .delete(exercises)
      .where(eq(exercises.id, parsedParams.data.id))
      .returning({ id: exercises.id });

    if (!deletedExercise) {
      return NextResponse.json(
        { error: "Exercise not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return internalServerError();
  }
}
