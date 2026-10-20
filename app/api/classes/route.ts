import { normalizeTags } from "@/lib/tags";
import { NextResponse } from "next/server";
import { eq, or, desc, and, ilike, sql, count } from "drizzle-orm";
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
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import { CLASS_STATUSES } from "@/lib/classes/visibility";
import { exerciseOwnOrClubCondition } from "@/lib/exercise-access";

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

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  duracionMinutes: z.number().int().min(1).max(600),
  alumnosTipo: z.enum(["individual", "grupal"]).optional().nullable(),
  numAlumnos: z.number().int().min(1).max(60).optional().nullable(),
  objetivos: z.string().trim().max(4000).optional().nullable(),
  material: z.string().trim().max(2000).optional().nullable(),
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || isPublicHttpUrl(value), {
      message: "La URL de video debe ser http(s) y no apuntar a una red local.",
    })
    .optional()
    .nullable()
    .or(z.literal("")),
  aspectosImportantes: z.string().trim().max(4000).optional().nullable(),
  nivel: z.string().trim().max(32).optional().nullable(),
  niveles: z.array(z.string().trim().max(32)).optional().nullable(),
  aspectoJuego: z.string().trim().max(16).optional().nullable(),
  aspectosJuego: z.array(z.string().trim().max(16)).optional().nullable(),
  golpes: z.array(z.string().max(32)).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional().nullable(),
  isLibrary: z.boolean().optional().default(false),
  autoria: z.enum(AUTORIA_VALUES).optional().nullable(),
  blocks: z.array(blockSchema).max(3).default([]),
  status: z.enum(CLASS_STATUSES).optional().default("published"),
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

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "all";
  const q = searchParams.get("q")?.trim();
  const nivel = searchParams.get("nivel")?.trim();
  const aspecto = searchParams.get("aspecto")?.trim();
  const duracion = searchParams.get("duracion")?.trim();
  const golpe = searchParams.get("golpe")?.trim();
  // Paginación opcional (selectores con "Mostrar más"). Sin `page` se
  // mantiene el comportamiento anterior: las 60 primeras.
  const pageParam = Number(searchParams.get("page"));
  const paginated = Number.isInteger(pageParam) && pageParam >= 1;
  const limitParam = Number(searchParams.get("limit"));
  const pageSize =
    Number.isInteger(limitParam) && limitParam >= 1
      ? Math.min(limitParam, 100)
      : 60;

  const [activeClubId, activeSport] = user
    ? await Promise.all([getActiveWorkClubId(user.id), getActiveSport(user.id)])
    : [null, null];
  const mineOrClub = user
    ? sharedWithClubCondition(
        classes.createdBy,
        classes.clubId,
        user.id,
        activeClubId
      )
    : null;

  const conds = [];
  if (tab === "drafts") {
    // Borradores: solo las clases propias aún sin publicar.
    if (!user) return NextResponse.json({ data: [] });
    conds.push(eq(classes.createdBy, user.id), eq(classes.status, "draft"));
  } else if (tab === "mine" && user) {
    // "Mis clases" también incluye los borradores propios (ver comentario
    // equivalente en app/(public)/classes/page.tsx): si no, una clase recién
    // creada como borrador desaparece sin dejar rastro.
    conds.push(
      or(
        and(eq(classes.status, "published"), mineOrClub!),
        and(eq(classes.createdBy, user.id), eq(classes.status, "draft"))
      )!
    );
  } else if (tab === "library") {
    conds.push(eq(classes.isLibrary, true), eq(classes.status, "published"));
  } else {
    // all: biblioteca pública + propias del usuario (+ compartidas por club)
    conds.push(
      eq(classes.status, "published"),
      user
        ? or(eq(classes.isLibrary, true), mineOrClub!)!
        : eq(classes.isLibrary, true)
    );
  }
  if (activeSport) conds.push(eq(classes.sport, activeSport));
  if (q) conds.push(ilike(classes.name, `%${q}%`));
  if (nivel) {
    conds.push(
      or(
        sql`${classes.niveles} @> ${JSON.stringify([nivel])}::jsonb`,
        eq(classes.nivel, nivel)
      )!
    );
  }
  if (aspecto) {
    conds.push(
      or(
        sql`${classes.aspectosJuego} @> ${JSON.stringify([aspecto])}::jsonb`,
        eq(classes.aspectoJuego, aspecto)
      )!
    );
  }

  if (duracion === "120") {
    conds.push(sql`${classes.duracionMinutes} > 90`);
  } else if (duracion) {
    const d = Number(duracion);
    if (Number.isFinite(d)) conds.push(eq(classes.duracionMinutes, d));
  }
  if (golpe) {
    conds.push(
      sql`${classes.golpes}::jsonb @> ${JSON.stringify([golpe])}::jsonb`
    );
  }

  const total = paginated
    ? Number(
        (
          await db
            .select({ total: count() })
            .from(classes)
            .where(and(...conds))
        )[0]?.total ?? 0
      )
    : 0;

  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      objetivos: classes.objetivos,
      duracionMinutes: classes.duracionMinutes,
      alumnosTipo: classes.alumnosTipo,
      numAlumnos: classes.numAlumnos,
      nivel: classes.nivel,
      niveles: classes.niveles,
      aspectoJuego: classes.aspectoJuego,
      aspectosJuego: classes.aspectosJuego,
      isLibrary: classes.isLibrary,
      status: classes.status,
      autoria: classes.autoria,
      createdBy: classes.createdBy,
      createdAt: classes.createdAt,
      authorName: users.name,
    })
    .from(classes)
    .leftJoin(users, eq(users.id, classes.createdBy))
    .where(and(...conds))
    .orderBy(desc(classes.createdAt))
    .limit(paginated ? pageSize : 60)
    .offset(paginated ? (pageParam - 1) * pageSize : 0);

  return NextResponse.json({
    data: rows.map((r) => ({
      ...r,
      authorName: user && r.createdBy !== user.id ? r.authorName : null,
    })),
    ...(paginated
      ? { pagination: { page: pageParam, limit: pageSize, total } }
      : {}),
  });
}

export async function POST(request: Request) {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const d = parsed.data;

  const [dbUser] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const isAdmin = !!dbUser?.isAdmin;
  const niveles = normalizeMultiValue(d.niveles, d.nivel);
  const aspectosJuego = normalizeMultiValue(d.aspectosJuego, d.aspectoJuego);

  // El club ya no se elige por elemento: se etiqueta automáticamente con
  // el modo de trabajo activo del usuario (ver /api/account/work-mode).
  const [clubId, sport] = await Promise.all([
    getActiveWorkClubId(user.id),
    getActiveSport(user.id),
  ]);

  // Verify exercises referenced (top-level items and stations) belong to
  // the user or are library exercises.
  const exerciseIds = Array.from(
    new Set(
      d.blocks.flatMap((b) =>
        b.items.flatMap((i) => [
          i.exerciseId,
          ...(i.stations ?? []).map((s) => s.exerciseId),
        ])
      )
    ).values()
  ).filter((id): id is string => !!id);
  const exerciseNameMap = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const accessible = await db
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(
        and(
          sql`${exercises.id} IN (${sql.join(
            exerciseIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )})`,
          or(eq(exercises.isGlobal, true), exerciseOwnOrClubCondition(user.id))!
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

  function buildStations(
    stations: (typeof d.blocks)[number]["items"][number]["stations"]
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
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(classes)
        .values({
          createdBy: user.id,
          name: d.name,
          duracionMinutes: d.duracionMinutes,
          alumnosTipo: d.alumnosTipo ?? null,
          numAlumnos: d.numAlumnos ?? null,
          objetivos: d.objetivos ?? null,
          material: d.material ?? null,
          videoUrl: d.videoUrl || null,
          aspectosImportantes: d.aspectosImportantes ?? null,
          nivel: niveles?.[0] ?? null,
          niveles,
          aspectoJuego: aspectosJuego?.[0] ?? null,
          aspectosJuego,
          golpes: d.golpes ?? null,
          tags: normalizeTags(d.tags),
          isLibrary: isAdmin && d.isLibrary === true,
          autoria: isAdmin && d.autoria ? d.autoria : "libre",
          clubId,
          sport,
          status: d.status,
        })
        .returning();

      for (const block of d.blocks) {
        const [createdBlock] = await tx
          .insert(classBlocks)
          .values({
            classId: created.id,
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
                item.kind === "stations" ? buildStations(item.stations) : null,
            }))
          );
        }
      }

      return created;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error("Error creating class:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
