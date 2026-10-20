import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { exerciseListItems } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getExerciseListInActiveSpace } from "@/lib/exercises/lists";
import { getAccessibleExerciseDurationMap } from "@/lib/exercise-access";
import { getBooleanSetting } from "@/lib/app-settings";
import { getFilteredExerciseIds } from "@/lib/nav/exercise-nav";
import {
  MAX_SAVE_SEARCH_RESULTS,
  queryStringToParams,
} from "@/lib/nav/query-to-params";

type Context = { params: Promise<{ listId: string }> };

/**
 * Guarda en una colección todos los ejercicios que devuelve una búsqueda
 * filtrada (la query string de /exercises). Es una copia del momento: los
 * ejercicios que se creen después no entran solos.
 */
export async function POST(request: Request, context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listId } = await context.params;
  if (!(await getExerciseListInActiveSpace(listId, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = z.object({ query: z.string().max(4000) }).safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const publicExercisesEnabled = await getBooleanSetting(
    "feature.public_exercises_enabled"
  );
  const ids = await getFilteredExerciseIds(
    queryStringToParams(parsed.data.query),
    { userId: user.id, publicExercisesEnabled }
  );

  if (ids.length === 0)
    return NextResponse.json({ ok: true, total: 0, added: 0 });
  if (ids.length > MAX_SAVE_SEARCH_RESULTS) {
    return NextResponse.json(
      {
        error: `La búsqueda tiene ${ids.length} ejercicios. Afina los filtros hasta un máximo de ${MAX_SAVE_SEARCH_RESULTS}.`,
        total: ids.length,
      },
      { status: 400 }
    );
  }

  const { inaccessibleIds } = await getAccessibleExerciseDurationMap(
    user.id,
    ids
  );
  const blocked = new Set(inaccessibleIds);
  const allowed = ids.filter((id) => !blocked.has(id));

  let added = 0;
  if (allowed.length > 0) {
    const inserted = await db
      .insert(exerciseListItems)
      .values(allowed.map((exerciseId) => ({ listId, exerciseId })))
      .onConflictDoNothing()
      .returning({ id: exerciseListItems.exerciseId });
    added = inserted.length;
  }

  return NextResponse.json({ ok: true, total: allowed.length, added });
}
