import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classListItems } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getListInActiveSpace } from "@/lib/classes/lists";
import { getFilteredClassIds } from "@/lib/nav/class-nav";
import {
  MAX_SAVE_SEARCH_RESULTS,
  queryStringToParams,
} from "@/lib/nav/query-to-params";

type Context = { params: Promise<{ listId: string }> };

/**
 * Guarda en una lista todas las clases que devuelve una búsqueda filtrada
 * (la query string de /classes). Es una copia del momento: las clases que se
 * creen después no entran solas.
 */
export async function POST(request: Request, context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = z
    .object({ listId: z.string().uuid() })
    .safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json({ error: "Invalid list id" }, { status: 400 });
  const { listId } = parsedParams.data;

  if (!(await getListInActiveSpace(listId, user.id)))
    return NextResponse.json({ error: "List not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = z.object({ query: z.string().max(4000) }).safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  // getFilteredClassIds ya limita a clases publicadas y visibles para el
  // usuario (biblioteca, suyas o de su club).
  const ids = await getFilteredClassIds(
    queryStringToParams(parsed.data.query),
    { userId: user.id }
  );

  if (ids.length === 0)
    return NextResponse.json({ ok: true, total: 0, added: 0 });
  if (ids.length > MAX_SAVE_SEARCH_RESULTS) {
    return NextResponse.json(
      {
        error: `La búsqueda tiene ${ids.length} clases. Afina los filtros hasta un máximo de ${MAX_SAVE_SEARCH_RESULTS}.`,
        total: ids.length,
      },
      { status: 400 }
    );
  }

  const inserted = await db
    .insert(classListItems)
    .values(ids.map((classId) => ({ listId, classId })))
    .onConflictDoNothing()
    .returning({ id: classListItems.classId });

  return NextResponse.json({
    ok: true,
    total: ids.length,
    added: inserted.length,
  });
}
