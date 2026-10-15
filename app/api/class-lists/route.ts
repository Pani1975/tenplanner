import { and, count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classListItems, classLists, classes, clubs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultList, getListSpace } from "@/lib/classes/lists";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeClubId, condition: spaceWhere } = await getListSpace(user.id);
  await ensureDefaultList(user.id, activeClubId);
  // En el espacio de un club, el dueño puede gestionar todas sus listas.
  const isClubOwner = activeClubId
    ? (
        await db
          .select({ ownerId: clubs.ownerId })
          .from(clubs)
          .where(eq(clubs.id, activeClubId))
          .limit(1)
      )[0]?.ownerId === user.id
    : false;

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
        isPublic: classLists.isPublic,
        userId: classLists.userId,
      })
      .from(classLists)
      .where(spaceWhere)
      .orderBy(desc(classLists.isDefault), classLists.createdAt),
    db
      .select({
        listId: classListItems.listId,
        total: count(),
      })
      .from(classListItems)
      .innerJoin(classLists, eq(classLists.id, classListItems.listId))
      .where(spaceWhere)
      .groupBy(classListItems.listId),
    classId
      ? db
          .select({ listId: classListItems.listId })
          .from(classListItems)
          .innerJoin(classLists, eq(classLists.id, classListItems.listId))
          .where(and(spaceWhere, eq(classListItems.classId, classId)))
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
          .where(spaceWhere)
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
      isMine: list.userId === user.id,
      canManage: list.userId === user.id || isClubOwner,
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

  const { activeClubId } = await getListSpace(user.id);
  await ensureDefaultList(user.id, activeClubId);

  const [list] = await db
    .insert(classLists)
    .values({
      userId: user.id,
      clubId: activeClubId,
      name: parsed.data.name,
      emoji: parsed.data.emoji ?? "🎓",
    })
    .returning();

  return NextResponse.json({ data: list }, { status: 201 });
}
