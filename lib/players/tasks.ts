import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playerTasks } from "@/db/schema";

export interface PlayerTaskData {
  id: string;
  title: string;
  description: string | null;
  /** AAAA-MM-DD o null. */
  dueDate: string | null;
  done: boolean;
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
    message: "Fecha no válida",
  });

export const playerTaskSchema = z.object({
  title: z.string().trim().min(1, "Escribe un título").max(255),
  description: z.string().trim().max(2000).nullable().optional(),
  dueDate: dateOnly.nullable().optional(),
  done: z.boolean().optional(),
});

const toData = (r: typeof playerTasks.$inferSelect): PlayerTaskData => ({
  id: r.id,
  title: r.title,
  description: r.description,
  dueDate: r.dueDate,
  done: r.doneAt !== null,
});

/** Solo las tareas del propio usuario. */
export async function listPlayerTasks(userId: string): Promise<PlayerTaskData[]> {
  const rows = await db
    .select()
    .from(playerTasks)
    .where(eq(playerTasks.userId, userId))
    .orderBy(asc(playerTasks.dueDate), asc(playerTasks.createdAt));
  return rows.map(toData);
}

export async function createPlayerTask(
  userId: string,
  input: z.infer<typeof playerTaskSchema>
) {
  const [row] = await db
    .insert(playerTasks)
    .values({
      userId,
      title: input.title,
      description: input.description || null,
      dueDate: input.dueDate ?? null,
    })
    .returning();
  return toData(row);
}

export async function updatePlayerTask(
  userId: string,
  id: string,
  input: Partial<z.infer<typeof playerTaskSchema>>
) {
  const set: Partial<typeof playerTasks.$inferInsert> = {};
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) set.description = input.description || null;
  if (input.dueDate !== undefined) set.dueDate = input.dueDate;
  if (input.done !== undefined) set.doneAt = input.done ? new Date() : null;
  if (Object.keys(set).length === 0) return null;
  const [row] = await db
    .update(playerTasks)
    .set(set)
    .where(and(eq(playerTasks.id, id), eq(playerTasks.userId, userId)))
    .returning();
  return row ? toData(row) : null;
}

export async function deletePlayerTask(userId: string, id: string) {
  const rows = await db
    .delete(playerTasks)
    .where(and(eq(playerTasks.id, id), eq(playerTasks.userId, userId)))
    .returning({ id: playerTasks.id });
  return rows.length > 0;
}
