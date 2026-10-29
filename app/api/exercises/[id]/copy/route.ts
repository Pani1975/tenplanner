import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { embedExercise } from "@/lib/ai/semantic-search";
import {
  copyTargetSchema,
  omitKeys,
  resolveCopyDestination,
} from "@/lib/copy-to-space";

type RouteContext = { params: Promise<{ id: string }> };

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Copia un ejercicio a "Mis ejercicios" (ver lib/copy-to-space.ts). La
 * copia es una ficha nueva, propia y editable: cambiar el original no la
 * modifica. Mantiene la autoría original como crédito.
 */
export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedParams = paramsSchema.safeParse(await context.params);
  if (!parsedParams.success)
    return NextResponse.json({ error: "Invalid exercise id" }, { status: 400 });

  const parsedBody = copyTargetSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsedBody.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const [source] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, parsedParams.data.id))
    .limit(1);
  if (!source)
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });

  const destination = await resolveCopyDestination(
    {
      isPublic: source.isGlobal || source.createdBy === null,
      createdBy: source.createdBy,
      clubId: source.clubId,
    },
    parsedBody.data.target,
    user.id
  );
  if (!destination.ok)
    return NextResponse.json({ error: destination.error }, { status: 403 });

  const content = omitKeys(source, ["id", "createdAt", "updatedAt"]);

  const [copy] = await db
    .insert(exercises)
    .values({
      ...content,
      isGlobal: false,
      createdBy: user.id,
      clubId: destination.clubId,
    })
    .returning();

  after(() =>
    embedExercise({
      id: copy.id,
      ownerId: user.id,
      name: copy.name,
      category: copy.category,
      difficulty: copy.difficulty,
      durationMinutes: copy.durationMinutes,
      description: copy.description,
      objectives: copy.objectives,
      tips: copy.tips,
      materials: copy.materials as string[] | null,
      location: copy.location,
    }).catch(console.error)
  );

  return NextResponse.json({ data: { id: copy.id } }, { status: 201 });
}
