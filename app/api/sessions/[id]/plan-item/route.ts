import { and, asc, eq, ilike, inArray, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  exercises,
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
  sessions,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { getActiveSport } from "@/lib/sports";
import { phaseFromBlockOrder, blockOrderFromIndex } from "@/lib/sessions/plan";
import { canEditSession } from "@/lib/sessions/permissions";

type Ctx = { params: Promise<{ id: string }> };

async function ownSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 401 as const };
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return { error: 404 as const };
  const [session] = await db
    .select({
      userId: sessions.userId,
      coachId: sessions.coachId,
      clubId: sessions.clubId,
      status: sessions.status,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) return { error: 404 as const };
  if (!(await canEditSession(user.id, session))) return { error: 403 as const };
  return { user, session };
}

/** Buscar ejercicios para sustituir uno durante la clase. */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const own = await ownSession(id);
  if ("error" in own)
    return NextResponse.json({ error: "No disponible" }, { status: own.error });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const sport = await getActiveSport(own.user.id);
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      category: exercises.category,
      durationMinutes: exercises.durationMinutes,
      description: exercises.description,
    })
    .from(exercises)
    .where(
      and(
        exerciseVisibleToUserCondition(own.user.id),
        eq(exercises.sport, sport),
        q ? ilike(exercises.name, `%${q.replace(/[%_]/g, "")}%`) : undefined
      )
    )
    .orderBy(asc(exercises.name))
    .limit(25);
  return NextResponse.json({ data: rows });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("replace"),
    itemKey: z.string().uuid(),
    exerciseId: z.string().uuid(),
  }),
  z.object({ action: z.literal("remove"), itemKey: z.string().uuid() }),
]);

/**
 * Cambiar el plan durante la clase: sustituir un elemento por otro ejercicio
 * o quitarlo. Se guarda en la sesión (bloques y session_exercises) para que
 * el registro refleje lo que se hizo de verdad.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id: sessionId } = await ctx.params;
  const own = await ownSession(sessionId);
  if ("error" in own)
    return NextResponse.json({ error: "No disponible" }, { status: own.error });
  if (own.session.status === "cancelled")
    return NextResponse.json(
      { error: "La sesión está cancelada." },
      { status: 409 }
    );

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Datos no válidos" }, { status: 422 });
  const input = parsed.data;

  let newExercise: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
  } | null = null;
  if (input.action === "replace") {
    const [ex] = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        description: exercises.description,
        durationMinutes: exercises.durationMinutes,
      })
      .from(exercises)
      .where(
        and(
          eq(exercises.id, input.exerciseId),
          exerciseVisibleToUserCondition(own.user.id)
        )
      )
      .limit(1);
    if (!ex)
      return NextResponse.json(
        { error: "Ejercicio no disponible." },
        { status: 404 }
      );
    newExercise = ex;
  }

  const result = await db.transaction(async (tx) => {
    // ¿Es un elemento de bloque de esta sesión?
    const [item] = await tx
      .select({
        id: sessionBlockItems.id,
        exerciseId: sessionBlockItems.exerciseId,
        durationMinutes: sessionBlockItems.durationMinutes,
        blockOrder: sessionBlocks.orderIndex,
      })
      .from(sessionBlockItems)
      .innerJoin(sessionBlocks, eq(sessionBlocks.id, sessionBlockItems.blockId))
      .where(
        and(
          eq(sessionBlockItems.id, input.itemKey),
          eq(sessionBlocks.sessionId, sessionId)
        )
      )
      .limit(1);

    if (item) {
      const oldExerciseId = item.exerciseId;
      if (input.action === "remove") {
        await tx
          .delete(sessionBlockItems)
          .where(eq(sessionBlockItems.id, item.id));
      } else if (newExercise) {
        await tx
          .update(sessionBlockItems)
          .set({
            kind: "exercise",
            exerciseId: newExercise.id,
            exerciseName: newExercise.name,
            exerciseDescription: newExercise.description,
            freeText: null,
            title: null,
            stations: null,
            aspectoJuego: null,
          })
          .where(eq(sessionBlockItems.id, item.id));
      }
      await syncSessionExercises(tx, sessionId, {
        removed: oldExerciseId,
        added: newExercise
          ? {
              id: newExercise.id,
              durationMinutes: item.durationMinutes,
              phase: phaseFromBlockOrder(blockOrderFromIndex(item.blockOrder)),
            }
          : null,
      });
      return { ok: true as const };
    }

    // Sesiones antiguas: el elemento es una fila de session_exercises.
    const [legacy] = await tx
      .select({ id: sessionExercises.id })
      .from(sessionExercises)
      .where(
        and(
          eq(sessionExercises.id, input.itemKey),
          eq(sessionExercises.sessionId, sessionId)
        )
      )
      .limit(1);
    if (!legacy) return { ok: false as const };
    if (input.action === "remove") {
      await tx
        .delete(sessionExercises)
        .where(eq(sessionExercises.id, legacy.id));
    } else if (newExercise) {
      await tx
        .update(sessionExercises)
        .set({ exerciseId: newExercise.id })
        .where(eq(sessionExercises.id, legacy.id));
    }
    return { ok: true as const };
  });

  if (!result.ok)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: { ok: true } });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Mantiene session_exercises (donde se guarda lo ejecutado y lo que usan las
 * estadísticas) de acuerdo con los ejercicios que quedan en los bloques.
 */
async function syncSessionExercises(
  tx: Tx,
  sessionId: string,
  change: {
    removed: string | null;
    added: {
      id: string;
      durationMinutes: number | null;
      phase: "activation" | "main" | "cooldown";
    } | null;
  }
) {
  const blockIds = (
    await tx
      .select({ id: sessionBlocks.id })
      .from(sessionBlocks)
      .where(eq(sessionBlocks.sessionId, sessionId))
  ).map((b) => b.id);
  const stillUsed = new Set(
    blockIds.length
      ? (
          await tx
            .select({ exerciseId: sessionBlockItems.exerciseId })
            .from(sessionBlockItems)
            .where(inArray(sessionBlockItems.blockId, blockIds))
        )
          .map((r) => r.exerciseId)
          .filter((x): x is string => !!x)
      : []
  );

  if (change.removed && !stillUsed.has(change.removed)) {
    await tx
      .delete(sessionExercises)
      .where(
        and(
          eq(sessionExercises.sessionId, sessionId),
          eq(sessionExercises.exerciseId, change.removed)
        )
      );
  }

  if (change.added) {
    const [existing] = await tx
      .select({ id: sessionExercises.id })
      .from(sessionExercises)
      .where(
        and(
          eq(sessionExercises.sessionId, sessionId),
          eq(sessionExercises.exerciseId, change.added.id)
        )
      )
      .limit(1);
    if (!existing) {
      const [{ value: maxOrder } = { value: null }] = await tx
        .select({ value: max(sessionExercises.orderIndex) })
        .from(sessionExercises)
        .where(eq(sessionExercises.sessionId, sessionId));
      await tx.insert(sessionExercises).values({
        sessionId,
        exerciseId: change.added.id,
        orderIndex: (maxOrder ?? -1) + 1,
        durationMinutes: change.added.durationMinutes,
        phase: change.added.phase,
      });
    }
  }
}
