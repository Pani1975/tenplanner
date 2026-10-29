import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classListItems, classLists, classes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getListSpace, publicListClassCondition } from "@/lib/classes/lists";

type RouteContext = { params: Promise<{ listId: string }> };

const paramsSchema = z.object({ listId: z.string().uuid() });

/**
 * Copia una lista pública de la Biblioteca a "Mis listas" del espacio
 * activo (particular o club). La copia es una lista nueva e independiente
 * que apunta a las mismas clases de biblioteca: el monitor puede
 * renombrarla, quitar o añadir clases sin afectar a la original.
 */
export async function POST(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });

  const [source] = await db
    .select({
      id: classLists.id,
      name: classLists.name,
      emoji: classLists.emoji,
    })
    .from(classLists)
    .where(
      and(
        eq(classLists.id, parsedParams.data.listId),
        eq(classLists.isPublic, true)
      )
    )
    .limit(1);
  if (!source)
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  const sourceItems = await db
    .select({ classId: classListItems.classId })
    .from(classListItems)
    .innerJoin(classes, eq(classes.id, classListItems.classId))
    .where(
      and(eq(classListItems.listId, source.id), publicListClassCondition())
    );

  const { activeClubId } = await getListSpace(user.id);

  const created = await db.transaction(async (tx) => {
    const [list] = await tx
      .insert(classLists)
      .values({
        userId: user.id,
        clubId: activeClubId,
        name: source.name.slice(0, 100),
        emoji: source.emoji ?? "🎓",
      })
      .returning();
    if (sourceItems.length > 0) {
      await tx
        .insert(classListItems)
        .values(
          sourceItems.map((item) => ({
            listId: list.id,
            classId: item.classId,
          }))
        )
        .onConflictDoNothing();
    }
    return list;
  });

  return NextResponse.json(
    { data: { ...created, itemsCount: sourceItems.length } },
    { status: 201 }
  );
}
