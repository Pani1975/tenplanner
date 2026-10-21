import { normalizeTags } from "@/lib/tags";
import { isTenPlannerMode } from "@/lib/work-mode";
import { NextResponse } from "next/server";
import { and, eq, asc, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  classes,
  classBlocks,
  classBlockExercises,
  exercises,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { isPublicHttpUrl } from "@/lib/url-safety";
import {
  BLOCK_ITEM_KINDS,
  STATION_COUNT_MAX,
  STATION_COUNT_MIN,
} from "@/lib/block-items";
import { AUTORIA_VALUES } from "@/lib/exercise-taxonomy";
import { getActiveWorkClubId } from "@/lib/clubs";
import { CLASS_STATUSES, canSeeClassDraft } from "@/lib/classes/visibility";
import { exerciseOwnOrClubCondition } from "@/lib/exercise-access";

type Ctx = { params: Promise<{ id: string }> };

const stationItemSchema = z
  .object({
    kind: z.enum(["exercise", "text"]),
    exerciseId: z.string().uuid().optional().nullable(),
    freeText: z.string().trim().max(2000).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(300).optional().nullable(),
  })
  .refine(
    (v) => (v.kind === "exercise" ? !!v.exerciseId : !!v.freeText?.trim()),
    { message: "Cada estación necesita un ejercicio o un texto." }
  );

const blockExerciseSchema = z
  .object({
    kind: z.enum(BLOCK_ITEM_KINDS).optional(),
    exerciseId: z.string().uuid().optional().nullable(),
    freeText: z.string().trim().max(2000).optional().nullable(),
    title: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(300).optional().nullable(),
    stations: z
      .array(stationItemSchema)
      .min(STATION_COUNT_MIN)
      .max(STATION_COUNT_MAX)
      .optional()
      .nullable(),
  })
  .refine(
    (item) => {
      if (item.kind === "stations") return (item.stations?.length ?? 0) > 0;
      if (item.kind === "warmup") return item.durationMinutes != null;
      return true;
    },
    { message: "Datos de bloque inválidos." }
  );

const blockSchema = z.object({
  orderIndex: z.number().int().min(1).max(3),
  title: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(blockExerciseSchema).default([]),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  duracionMinutes: z.number().int().min(1).max(600).optional(),
  alumnosTipo: z.enum(["individual", "grupal"]).nullable().optional(),
  numAlumnos: z.number().int().min(1).max(60).nullable().optional(),
  objetivos: z.string().trim().max(4000).nullable().optional(),
  material: z.string().trim().max(2000).nullable().optional(),
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || isPublicHttpUrl(value), {
      message: "La URL de video debe ser http(s) y no apuntar a una red local.",
    })
    .nullable()
    .optional()
    .or(z.literal("")),
  aspectosImportantes: z.string().trim().max(4000).nullable().optional(),
  nivel: z.string().trim().max(32).nullable().optional(),
  niveles: z.array(z.string().trim().max(32)).nullable().optional(),
  aspectoJuego: z.string().trim().max(16).nullable().optional(),
  aspectosJuego: z.array(z.string().trim().max(16)).nullable().optional(),
  golpes: z.array(z.string().max(32)).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).nullable().optional(),
  isLibrary: z.boolean().optional(),
  autoria: z.enum(AUTORIA_VALUES).nullable().optional(),
  blocks: z.array(blockSchema).max(3).optional(),
  status: z.enum(CLASS_STATUSES).optional(),
});

function normalizeMultiValue(
  values: string[] | null | undefined,
  legacyValue: string | null | undefined
) {
  const normalized = Array.from(
    new Set(
      (values ?? (legacyValue ? [legacyValue] : []))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  return normalized.length > 0 ? normalized : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const [cls] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Visibilidad: biblioteca pública, creador, o compartida vía club
  const isOwner = !!user && cls.createdBy === user.id;
  let sharedViaClub = false;
  if (!cls.isLibrary && !isOwner && user && cls.clubId) {
    const activeClubId = await getActiveWorkClubId(user.id);
    sharedViaClub = cls.clubId === activeClubId;
  }
  if (!cls.isLibrary && !isOwner && !sharedViaClub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSeeClassDraft(cls, user?.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const blocks = await db
    .select()
    .from(classBlocks)
    .where(eq(classBlocks.classId, id))
    .orderBy(asc(classBlocks.orderIndex));

  const items = blocks.length
    ? await db
        .select({
          blockId: classBlockExercises.blockId,
          exerciseId: classBlockExercises.exerciseId,
          freeText: classBlockExercises.freeText,
          title: classBlockExercises.title,
          notes: classBlockExercises.notes,
          orderIndex: classBlockExercises.orderIndex,
          durationMinutes: classBlockExercises.durationMinutes,
          kind: classBlockExercises.kind,
          stations: classBlockExercises.stations,
          exerciseName: exercises.name,
          exerciseCategory: exercises.category,
          exerciseDescription: exercises.description,
          exerciseObjectives: exercises.objectives,
          animationScene: exercises.animationScene,
        })
        .from(classBlockExercises)
        .leftJoin(exercises, eq(exercises.id, classBlockExercises.exerciseId))
        .where(or(...blocks.map((b) => eq(classBlockExercises.blockId, b.id)))!)
        .orderBy(
          asc(classBlockExercises.blockId),
          asc(classBlockExercises.orderIndex)
        )
    : [];

  return NextResponse.json({
    data: {
      ...cls,
      blocks: blocks.map((b) => ({
        ...b,
        items: items.filter((i) => i.blockId === b.id),
      })),
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const [existing] = await db
    .select({ createdBy: classes.createdBy, isLibrary: classes.isLibrary })
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // La Biblioteca pública solo se edita en Modo Ten Planner.
  if (existing.isLibrary && !(await isTenPlannerMode(user.id)))
    return NextResponse.json(
      { error: "La Biblioteca pública solo se edita en Modo Ten Planner" },
      { status: 403 }
    );

  const [dbUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  // Publicar o retirar de la Biblioteca solo en Modo Ten Planner.
  const isAdmin = !!dbUser?.isAdmin && (await isTenPlannerMode(user.id));

  const d = parsed.data;

  // Verify exercises referenced (top-level items and stations) belong to
  // the user or are library exercises.
  const exerciseNameMap = new Map<string, string>();
  if (d.blocks) {
    const exerciseIds = Array.from(
      new Set(
        d.blocks.flatMap((b) =>
          b.items.flatMap((i) => [
            i.exerciseId,
            ...(i.stations ?? []).map((s) => s.exerciseId),
          ])
        )
      ).values()
    ).filter((eid): eid is string => !!eid);
    if (exerciseIds.length > 0) {
      const accessible = await db
        .select({ id: exercises.id, name: exercises.name })
        .from(exercises)
        .where(
          and(
            sql`${exercises.id} IN (${sql.join(
              exerciseIds.map((eid) => sql`${eid}::uuid`),
              sql`, `
            )})`,
            or(
              eq(exercises.isGlobal, true),
              exerciseOwnOrClubCondition(user.id)
            )!
          )
        );
      if (accessible.length !== exerciseIds.length) {
        return NextResponse.json(
          { error: "Algunos ejercicios no son accesibles" },
          { status: 400 }
        );
      }
      for (const ex of accessible) exerciseNameMap.set(ex.id, ex.name);
    }
  }

  function buildStations(
    stations: NonNullable<typeof d.blocks>[number]["items"][number]["stations"]
  ) {
    return (stations ?? []).map((s) => ({
      kind: s.kind,
      exerciseId: s.exerciseId ?? null,
      exerciseName: s.exerciseId
        ? (exerciseNameMap.get(s.exerciseId) ?? null)
        : null,
      freeText: s.freeText ?? null,
      durationMinutes: s.durationMinutes ?? null,
    }));
  }

  try {
    await db.transaction(async (tx) => {
      const updateValues: Record<string, unknown> = {};
      if (d.name !== undefined) updateValues.name = d.name;
      if (d.duracionMinutes !== undefined)
        updateValues.duracionMinutes = d.duracionMinutes;
      if (d.alumnosTipo !== undefined) updateValues.alumnosTipo = d.alumnosTipo;
      if (d.numAlumnos !== undefined) updateValues.numAlumnos = d.numAlumnos;
      if (d.objetivos !== undefined) updateValues.objetivos = d.objetivos;
      if (d.material !== undefined) updateValues.material = d.material;
      if (d.videoUrl !== undefined) updateValues.videoUrl = d.videoUrl || null;
      if (d.aspectosImportantes !== undefined)
        updateValues.aspectosImportantes = d.aspectosImportantes;
      if (d.niveles !== undefined || d.nivel !== undefined) {
        const niveles = normalizeMultiValue(d.niveles, d.nivel);
        updateValues.niveles = niveles;
        updateValues.nivel = niveles?.[0] ?? null;
      }
      if (d.aspectosJuego !== undefined || d.aspectoJuego !== undefined) {
        const aspectosJuego = normalizeMultiValue(
          d.aspectosJuego,
          d.aspectoJuego
        );
        updateValues.aspectosJuego = aspectosJuego;
        updateValues.aspectoJuego = aspectosJuego?.[0] ?? null;
      }
      if (d.golpes !== undefined) updateValues.golpes = d.golpes;
      if (d.tags !== undefined) updateValues.tags = normalizeTags(d.tags);
      if (d.isLibrary !== undefined)
        updateValues.isLibrary = isAdmin && d.isLibrary === true;
      if (isAdmin && d.autoria !== undefined)
        updateValues.autoria = d.autoria ?? "libre";
      if (d.status !== undefined) updateValues.status = d.status;

      if (Object.keys(updateValues).length > 0) {
        await tx.update(classes).set(updateValues).where(eq(classes.id, id));
      }

      if (d.blocks !== undefined) {
        // Replace all blocks (cascade deletes existing block items)
        await tx.delete(classBlocks).where(eq(classBlocks.classId, id));
        for (const block of d.blocks) {
          const [createdBlock] = await tx
            .insert(classBlocks)
            .values({
              classId: id,
              orderIndex: block.orderIndex,
              title: block.title ?? null,
              notes: block.notes ?? null,
            })
            .returning({ id: classBlocks.id });
          if (block.items.length > 0) {
            await tx.insert(classBlockExercises).values(
              block.items.map((item, idx) => ({
                blockId: createdBlock.id,
                exerciseId: item.exerciseId ?? null,
                freeText: item.freeText ?? null,
                title: item.title ?? null,
                notes: item.notes ?? null,
                orderIndex: idx,
                durationMinutes: item.durationMinutes ?? null,
                kind: item.kind ?? null,
                stations:
                  item.kind === "stations"
                    ? buildStations(item.stations)
                    : null,
              }))
            );
          }
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error updating class:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [target] = await db
    .select({ isLibrary: classes.isLibrary })
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.createdBy, user.id)))
    .limit(1);
  if (target?.isLibrary && !(await isTenPlannerMode(user.id)))
    return NextResponse.json(
      { error: "La Biblioteca pública solo se borra en Modo Ten Planner" },
      { status: 403 }
    );

  const [deleted] = await db
    .delete(classes)
    .where(and(eq(classes.id, id), eq(classes.createdBy, user.id)))
    .returning({ id: classes.id });
  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
