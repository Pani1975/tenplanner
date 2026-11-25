import { and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import type { Diagram } from "@/lib/exercise-diagrams/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

export type ExerciseVisual = { imageUrl: string | null; diagram: Diagram | null };

/**
 * Miniaturas de ejercicios para el asistente de sesión: primera imagen
 * (si tiene) y esquema de pista dibujado (si lo hay). Solo ejercicios que el
 * usuario puede ver; los que no tienen nada no se devuelven.
 * GET /api/exercises/visuals?ids=a,b,c
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = Array.from(
    new Set(raw.split(",").map((s) => s.trim()).filter((s) => UUID_RE.test(s)))
  ).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ data: {} });

  const rows = await db
    .select({
      id: exercises.id,
      imageUrl: exercises.imageUrl,
      imageUrls: exercises.imageUrls,
    })
    .from(exercises)
    .where(
      and(inArray(exercises.id, ids), exerciseVisibleToUserCondition(user.id))
    );

  const data: Record<string, ExerciseVisual> = {};
  for (const r of rows) {
    // Primero la lista de fotos; si no, el campo antiguo de una sola foto.
    const imageUrl =
      [...(Array.isArray(r.imageUrls) ? r.imageUrls : []), r.imageUrl].find(
        (u): u is string => typeof u === "string" && u.startsWith("https://")
      ) ?? null;
    const diagram = getExerciseDiagram(r.id);
    if (imageUrl || diagram) data[r.id] = { imageUrl, diagram };
  }

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
