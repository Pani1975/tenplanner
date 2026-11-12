import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { managementTasks, users } from "@/db/schema";
import { getManagementClubId } from "@/lib/work-mode";

/** Tarea del Modo gestión tal como la ven el servidor y el navegador. */
export interface ManagementTaskData {
  id: string;
  title: string;
  description: string | null;
  /** AAAA-MM-DD, o null si no tiene fecha de finalización. */
  dueDate: string | null;
  notifyEmail: boolean;
  responsibleKind: "coach" | "club" | "other";
  responsibleUserId: string | null;
  responsibleText: string | null;
  /** Nombre que se muestra del responsable (monitor, club o texto libre). */
  responsibleLabel: string;
  done: boolean;
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
    message: "Fecha no válida",
  });

export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1, "Título obligatorio").max(255),
    description: z.string().trim().max(4000).nullable().optional(),
    dueDate: dateOnly.nullable().optional(),
    notifyEmail: z.boolean().optional(),
    responsibleKind: z.enum(["coach", "club", "other"]).optional(),
    responsibleUserId: z.string().uuid().nullable().optional(),
    responsibleText: z.string().trim().max(255).nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((v) => !v.notifyEmail || !!v.dueDate, {
    message: "Para el aviso por correo hace falta una fecha de finalización",
    path: ["notifyEmail"],
  })
  .refine((v) => v.responsibleKind !== "other" || !!v.responsibleText?.trim(), {
    message: "Escribe quién es el responsable",
    path: ["responsibleText"],
  });

export type TaskInput = z.infer<typeof taskInputSchema>;

/** Id del club cuyo Modo gestión está activo, o null si no lo está. */
export async function requireManagementClub(userId: string) {
  return getManagementClubId(userId);
}

export function responsibleLabel(
  row: {
    responsibleKind: "coach" | "club" | "other";
    responsibleText: string | null;
  },
  coachName: string | null,
  clubName: string
) {
  if (row.responsibleKind === "club") return clubName;
  if (row.responsibleKind === "coach") return coachName ?? "Monitor";
  return row.responsibleText ?? "Otro";
}

/** Fila de la base → datos para el navegador. */
export function serializeTask(
  row: typeof managementTasks.$inferSelect,
  coachName: string | null,
  clubName: string
): ManagementTaskData {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    notifyEmail: row.notifyEmail,
    responsibleKind: row.responsibleKind,
    responsibleUserId: row.responsibleUserId,
    responsibleText: row.responsibleText,
    responsibleLabel: responsibleLabel(row, coachName, clubName),
    done: !!row.doneAt,
  };
}

/** Nombre de un usuario (para el responsable monitor). */
export async function userName(userId: string | null) {
  if (!userId) return null;
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.name ?? null;
}

/** Columnas de la tabla a partir de la entrada validada. */
export function taskValues(input: TaskInput) {
  const kind = input.responsibleKind ?? "club";
  return {
    title: input.title,
    description: input.description?.trim() || null,
    dueDate: input.dueDate ?? null,
    notifyEmail: !!input.notifyEmail && !!input.dueDate,
    responsibleKind: kind,
    responsibleUserId: kind === "coach" ? (input.responsibleUserId ?? null) : null,
    responsibleText: kind === "other" ? (input.responsibleText?.trim() ?? null) : null,
  };
}

export function taskOwnedBy(clubId: string, id: string) {
  return and(eq(managementTasks.id, id), eq(managementTasks.clubId, clubId));
}
