import { and, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { exerciseListItems, exerciseLists, exercises } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getExerciseListSpace } from "@/lib/exercises/lists";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Listas del espacio activo: particular, o las comunes del club.
  const { condition: spaceWhere } = await getExerciseListSpace(user.id);

  const exerciseId = request.nextUrl.searchParams.get("exerciseId");
  const includeExercises =
    request.nextUrl.searchParams.get("includeExercises") === "true";

  const [lists, counts, memberships, listItems] = await Promise.all([
    db
      .select({
        id: exerciseLists.id,
        name: exerciseLists.name,
        emoji: exerciseLists.emoji,
        isDefault: exerciseLists.isDefault,
        createdAt: exerciseLists.createdAt,
      })
      .from(exerciseLists)
      .where(spaceWhere),
    db
      .select({
        listId: exerciseListItems.listId,
        total: count(),
      })
      .from(exerciseListItems)
      .innerJoin(exerciseLists, eq(exerciseLists.id, exerciseListItems.listId))
      .where(spaceWhere)
      .groupBy(exerciseListItems.listId),
    exerciseId
      ? db
          .select({
            listId: exerciseListItems.listId,
          })
          .from(exerciseListItems)
          .innerJoin(
            exerciseLists,
            eq(exerciseLists.id, exerciseListItems.listId)
          )
          .where(and(spaceWhere, eq(exerciseListItems.exerciseId, exerciseId)))
      : Promise.resolve([] as Array<{ listId: string }>),
    includeExercises
      ? db
          .select({
            listId: exerciseListItems.listId,
            exerciseId: exercises.id,
            name: exercises.name,
            category: exercises.category,
            difficulty: exercises.difficulty,
            durationMinutes: exercises.durationMinutes,
            imageUrl: exercises.imageUrl,
            description: exercises.description,
            objectives: exercises.objectives,
            videoUrl: exercises.videoUrl,
          })
          .from(exerciseListItems)
          .innerJoin(
            exerciseLists,
            eq(exerciseLists.id, exerciseListItems.listId)
          )
          .innerJoin(exercises, eq(exercises.id, exerciseListItems.exerciseId))
          .where(spaceWhere)
      : Promise.resolve(
          [] as Array<{
            listId: string;
            exerciseId: string;
            name: string;
            category: string;
            difficulty: string;
            durationMinutes: number;
            imageUrl: string | null;
            description: string | null;
            objectives: string | null;
            videoUrl: string | null;
          }>
        ),
  ]);

  const countMap = new Map(
    counts.map((row) => [row.listId, Number(row.total)])
  );
  const membershipSet = new Set(memberships.map((row) => row.listId));
  const itemsMap = new Map<
    string,
    Array<{
      id: string;
      name: string;
      category: string;
      difficulty: string;
      durationMinutes: number;
      imageUrl: string | null;
      description: string | null;
      objectives: string | null;
      videoUrl: string | null;
    }>
  >();

  for (const item of listItems) {
    const current = itemsMap.get(item.listId) ?? [];
    current.push({
      id: item.exerciseId,
      name: item.name,
      category: item.category,
      difficulty: item.difficulty,
      durationMinutes: item.durationMinutes,
      imageUrl: item.imageUrl,
      description: item.description,
      objectives: item.objectives,
      videoUrl: item.videoUrl,
    });
    itemsMap.set(item.listId, current);
  }

  return NextResponse.json({
    data: lists.map((list) => ({
      ...list,
      itemsCount: countMap.get(list.id) ?? 0,
      containsExercise: membershipSet.has(list.id),
      items: includeExercises ? (itemsMap.get(list.id) ?? []) : undefined,
    })),
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

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      emoji: z.string().max(10).optional(),
    })
    .safeParse(body);

  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  // La primera lista del espacio (particular o club) es la principal.
  const { activeClubId, condition: spaceWhere } = await getExerciseListSpace(
    user.id
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(exerciseLists)
    .where(spaceWhere);

  const isFirstList = Number(total) === 0;

  const [list] = await db
    .insert(exerciseLists)
    .values({
      userId: user.id,
      clubId: activeClubId,
      name: parsed.data.name,
      emoji: parsed.data.emoji ?? "📋",
      isDefault: isFirstList,
    })
    .returning();

  return NextResponse.json({ data: list }, { status: 201 });
}
