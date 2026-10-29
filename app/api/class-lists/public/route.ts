import { and, asc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { classListItems, classLists, classes } from "@/db/schema";
import { SPORTS, type Sport } from "@/lib/sport-constants";
import { publicListClassCondition } from "@/lib/classes/lists";
import { omitKeys } from "@/lib/copy-to-space";

/**
 * Listas públicas de la Biblioteca (p. ej. "Lista clases bola roja"),
 * publicadas por un admin. Solo muestran clases publicadas de la
 * biblioteca, filtradas por deporte. Cualquiera puede verlas; copiarlas a
 * "Mis listas" requiere sesión (ver ../[listId]/copy).
 */
export async function GET(request: NextRequest) {
  const sportParam = request.nextUrl.searchParams.get("sport");
  const sport = (SPORTS as readonly string[]).includes(sportParam ?? "")
    ? (sportParam as Sport)
    : null;

  const lists = await db
    .select({
      id: classLists.id,
      name: classLists.name,
      emoji: classLists.emoji,
    })
    .from(classLists)
    .where(eq(classLists.isPublic, true))
    .orderBy(asc(classLists.name));

  if (lists.length === 0) return NextResponse.json({ data: [] });

  const items = await db
    .select({
      listId: classListItems.listId,
      id: classes.id,
      name: classes.name,
      duracionMinutes: classes.duracionMinutes,
      nivel: classes.nivel,
    })
    .from(classListItems)
    .innerJoin(classes, eq(classes.id, classListItems.classId))
    .where(
      and(
        inArray(
          classListItems.listId,
          lists.map((l) => l.id)
        ),
        publicListClassCondition(),
        sport ? eq(classes.sport, sport) : undefined
      )
    )
    .orderBy(asc(classes.name));

  items.sort((a, b) =>
    a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" })
  );

  const byList = new Map<string, typeof items>();
  for (const item of items) {
    const current = byList.get(item.listId) ?? [];
    current.push(item);
    byList.set(item.listId, current);
  }

  return NextResponse.json({
    data: lists
      .map((list) => ({
        ...list,
        items: (byList.get(list.id) ?? []).map((item) =>
          omitKeys(item, ["listId"])
        ),
      }))
      .filter((list) => list.items.length > 0),
  });
}
