import { and, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classListItems, classLists, classes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classId = request.nextUrl.searchParams.get("classId");
  const includeClasses =
    request.nextUrl.searchParams.get("includeClasses") === "true";

  const [lists, counts, memberships, listItems] = await Promise.all([
    db
      .select({
        id: classLists.id,
        name: classLists.name,
        emoji: classLists.emoji,
        isDefault: classLists.isDefault,
        createdAt: classLists.createdAt,
      })
      .from(classLists)
      .where(eq(classLists.userId, user.id)),
    db
      .select({
        listId: classListItems.listId,
        total: count(),
      })
      .from(classListItems)
      .innerJoin(classLists, eq(classLists.id, classListItems.listId))
      .where(eq(classLists.userId, user.id))
      .groupBy(classListItems.listId),
    classId
      ? db
          .select({ listId: classListItems.listId })
          .from(classListItems)
          .innerJoin(classLists, eq(classLists.id, classListItems.listId))
          .where(
            and(
              eq(classLists.userId, user.id),
              eq(classListItems.classId, classId)
            )
          )
      : Promise.resolve([] as Array<{ listId: string }>),
    includeClasses
      ? db
          .select({
            listId: classListItems.listId,
            classId: classes.id,
            name: classes.name,
            duracionMinutes: classes.duracionMinutes,
            alumnosTipo: classes.alumnosTipo,
            nivel: classes.nivel,
            isLibrary: classes.isLibrary,
          })
          .from(classListItems)
          .innerJoin(classLists, eq(classLists.id, classListItems.listId))
          .innerJoin(classes, eq(classes.id, classListItems.classId))
          .where(eq(classLists.userId, user.id))
      : Promise.resolve(
          [] as Array<{
            listId: string;
            classId: string;
            name: string;
            duracionMinutes: number;
            alumnosTipo: string | null;
            nivel: string | null;
            isLibrary: boolean;
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
      duracionMinutes: number;
      alumnosTipo: string | null;
      nivel: string | null;
      isLibrary: boolean;
    }>
  >();

  for (const item of listItems) {
    const current = itemsMap.get(item.listId) ?? [];
    current.push({
      id: item.classId,
      name: item.name,
      duracionMinutes: item.duracionMinutes,
      alumnosTipo: item.alumnosTipo,
      nivel: item.nivel,
      isLibrary: item.isLibrary,
    });
    itemsMap.set(item.listId, current);
  }

  return NextResponse.json({
    data: lists.map((list) => ({
      ...list,
      itemsCount: countMap.get(list.id) ?? 0,
      containsClass: membershipSet.has(list.id),
      items: includeClasses ? (itemsMap.get(list.id) ?? []) : undefined,
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

  const [{ total }] = await db
    .select({ total: count() })
    .from(classLists)
    .where(eq(classLists.userId, user.id));

  const [list] = await db
    .insert(classLists)
    .values({
      userId: user.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji ?? "🎓",
      isDefault: Number(total) === 0,
    })
    .returning();

  return NextResponse.json({ data: list }, { status: 201 });
}
