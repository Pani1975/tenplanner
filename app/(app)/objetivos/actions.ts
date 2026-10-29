"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  BALLS,
  loadBaseObjectives,
  loadClubObjectives,
  loadWorkspaceObjectives,
  type ScopeContext,
} from "@/lib/objectives";
import {
  createOwnObjective,
  duplicateObjectiveFor,
  moveObjectiveFor,
  placeObjectiveFor,
  removeObjectiveFor,
  restoreObjectiveFor,
  updateObjectiveText,
  type WriteScope,
} from "@/lib/objectives-write";
import { getWorkMode } from "@/lib/work-mode";

// Objetivos del espacio en el que trabaja el monitor (apartado "Objetivos" del
// menú). El ámbito sale del modo de trabajo, nunca del cliente:
// - Modo Ten Planner (solo administradores) → catálogo base, para todos.
// - Modo club → ajustes y objetivos propios del club.
// - Modo particular → ajustes y objetivos propios del monitor.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID_RE);
const text = {
  title: z.string().trim().min(1).max(200),
  criterion: z.string().trim().max(300).optional(),
};

type Authorized = {
  ok: true;
  userId: string;
  scope: Exclude<WriteScope, "student">;
  ctx: ScopeContext;
};
type Failure = { ok: false; error: string };

async function authorize(): Promise<Authorized | Failure> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { ok: false, error: "Unauthorized" };

  const mode = await getWorkMode(user.id);
  if (mode.kind === "tenplanner")
    return {
      ok: true,
      userId: user.id,
      scope: "base",
      ctx: { studentId: null, clubId: null, coachId: user.id },
    };
  if (mode.kind === "club")
    return {
      ok: true,
      userId: user.id,
      scope: "club",
      ctx: { studentId: null, clubId: mode.clubId, coachId: user.id },
    };
  return {
    ok: true,
    userId: user.id,
    scope: "coach",
    ctx: { studentId: null, clubId: null, coachId: user.id },
  };
}

function loadItems(auth: Authorized) {
  if (auth.scope === "base")
    return loadBaseObjectives({ includeRemoved: true });
  if (auth.scope === "club")
    return loadClubObjectives(auth.ctx.clubId!, auth.userId);
  return loadWorkspaceObjectives(auth.userId, null, { includeHidden: true });
}

function refresh() {
  revalidatePath("/objetivos");
  // Los alumnos ven el cambio en su ficha y en el informe.
  revalidatePath("/students", "layout");
}

function done(res: { ok: boolean; error?: string }) {
  refresh();
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error ?? "Error" };
}

export async function createWorkspaceObjective(input: {
  ball: string;
  aspect: string;
  block: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z
    .object({
      ball: z.enum(BALLS.map((b) => b.id) as [string, ...string[]]),
      aspect: z.enum(["tecnico", "tactico", "mental", "fisico"]),
      block: z.string().trim().min(1).max(80),
      ...text,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize();
  if (!auth.ok) return auth;
  return done(
    await createOwnObjective(auth.ctx, auth.scope, auth.userId, {
      ball: v.ball,
      aspect: v.aspect,
      block: v.block,
      title: v.title,
      criterion: v.criterion || null,
    })
  );
}

export async function updateWorkspaceObjective(input: {
  objectiveId: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z.object({ objectiveId: uuid, ...text }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize();
  if (!auth.ok) return auth;
  return done(
    await updateObjectiveText(
      auth.ctx,
      auth.scope,
      auth.userId,
      v.objectiveId,
      {
        title: v.title,
        criterion: v.criterion ?? "",
      }
    )
  );
}

export async function removeWorkspaceObjective(input: { objectiveId: string }) {
  const parsed = z.object({ objectiveId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const auth = await authorize();
  if (!auth.ok) return auth;
  return done(
    await removeObjectiveFor(
      auth.ctx,
      auth.scope,
      auth.userId,
      parsed.data.objectiveId
    )
  );
}

export async function restoreWorkspaceObjective(input: {
  objectiveId: string;
}) {
  const parsed = z.object({ objectiveId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const auth = await authorize();
  if (!auth.ok) return auth;
  return done(
    await restoreObjectiveFor(
      auth.ctx,
      auth.scope,
      auth.userId,
      parsed.data.objectiveId
    )
  );
}

export async function moveWorkspaceObjective(input: {
  objectiveId: string;
  direction: "up" | "down";
}) {
  const parsed = z
    .object({ objectiveId: uuid, direction: z.enum(["up", "down"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const auth = await authorize();
  if (!auth.ok) return auth;
  const items = await loadItems(auth);
  return done(
    await moveObjectiveFor(
      auth.ctx,
      auth.scope,
      auth.userId,
      items,
      parsed.data.objectiveId,
      parsed.data.direction
    )
  );
}

const groupSchema = z.object({
  ball: z.enum(BALLS.map((b) => b.id) as [string, ...string[]]),
  aspect: z.enum(["tecnico", "tactico", "mental", "fisico"]),
  block: z.string().trim().min(1).max(80),
});

/** Arrastra un objetivo a otra posición o a otro grupo (bola, aspecto, bloque). */
export async function placeWorkspaceObjective(input: {
  objectiveId: string;
  target: { ball: string; aspect: string; block: string };
  beforeId: string | null;
}) {
  const parsed = z
    .object({
      objectiveId: uuid,
      target: groupSchema,
      beforeId: uuid.nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const auth = await authorize();
  if (!auth.ok) return auth;
  const items = await loadItems(auth);
  return done(
    await placeObjectiveFor(
      auth.ctx,
      auth.scope,
      auth.userId,
      items,
      parsed.data.objectiveId,
      parsed.data.target,
      parsed.data.beforeId
    )
  );
}

/** Duplica un objetivo justo debajo del original, como objetivo propio. */
export async function duplicateWorkspaceObjective(input: {
  objectiveId: string;
}) {
  const parsed = z.object({ objectiveId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const auth = await authorize();
  if (!auth.ok) return auth;
  const items = await loadItems(auth);
  return done(
    await duplicateObjectiveFor(
      auth.ctx,
      auth.scope,
      auth.userId,
      items,
      parsed.data.objectiveId
    )
  );
}
