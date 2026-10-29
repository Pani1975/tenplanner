import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classBlockExercises, classBlocks, classes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  copyTargetSchema,
  omitKeys,
  resolveCopyDestination,
} from "@/lib/copy-to-space";

type RouteContext = { params: Promise<{ id: string }> };

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Copia una clase (con sus bloques y ejercicios) a "Mis clases" (ver
 * lib/copy-to-space.ts). La copia es nueva, propia y editable; los
 * ejercicios de sus bloques siguen apuntando a las mismas fichas.
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
    return NextResponse.json({ error: "Invalid class id" }, { status: 400 });

  const parsedBody = copyTargetSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsedBody.success)
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const [source] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, parsedParams.data.id))
    .limit(1);
  if (!source || (source.status === "draft" && source.createdBy !== user.id))
    return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const destination = await resolveCopyDestination(
    {
      isPublic: source.isLibrary && source.status === "published",
      createdBy: source.createdBy,
      clubId: source.clubId,
    },
    parsedBody.data.target,
    user.id
  );
  if (!destination.ok)
    return NextResponse.json({ error: destination.error }, { status: 403 });

  const blocks = await db
    .select()
    .from(classBlocks)
    .where(eq(classBlocks.classId, source.id))
    .orderBy(asc(classBlocks.orderIndex));
  const items = blocks.length
    ? await db
        .select()
        .from(classBlockExercises)
        .where(
          inArray(
            classBlockExercises.blockId,
            blocks.map((b) => b.id)
          )
        )
        .orderBy(asc(classBlockExercises.orderIndex))
    : [];

  const content = omitKeys(source, ["id", "createdAt", "updatedAt"]);

  const copyId = await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(classes)
      .values({
        ...content,
        isLibrary: false,
        status: "published",
        createdBy: user.id,
        clubId: destination.clubId,
      })
      .returning({ id: classes.id });

    for (const block of blocks) {
      const blockContent = omitKeys(block, ["id", "classId"]);
      const [newBlock] = await tx
        .insert(classBlocks)
        .values({ ...blockContent, classId: copy.id })
        .returning({ id: classBlocks.id });
      const blockItems = items.filter((i) => i.blockId === block.id);
      if (blockItems.length > 0) {
        await tx.insert(classBlockExercises).values(
          blockItems.map((item) => ({
            ...omitKeys(item, ["id", "blockId"]),
            blockId: newBlock.id,
          }))
        );
      }
    }
    return copy.id;
  });

  return NextResponse.json({ data: { id: copyId } }, { status: 201 });
}
