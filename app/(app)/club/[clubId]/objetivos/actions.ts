"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canTagWithClub } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { BALLS, loadClubObjectives, type ScopeContext } from "@/lib/objectives";
import {
  createOwnObjective,
  duplicateObjectiveFor,
  moveObjectiveFor,
  placeObjectiveFor,
  removeObjectiveFor,
  restoreObjectiveFor,
  updateObjectiveText,
} from "@/lib/objectives-write";

// Objetivos para todo el club. Lo puede editar cualquier miembro activo
// (administrador o monitor) del club.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID_RE);

type Authorized = { ok: true; userId: string; ctx: ScopeContext };
type Failure = { ok: false; error: string };

async function authorize(clubId: string): Promise<Authorized | Failure> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { ok: false, error: "Unauthorized" };
  if (!(await canTagWithClub(user.id, clubId)))
    return { ok: false, error: "Forbidden" };
  return {
    ok: true,
    userId: user.id,
    ctx: { studentId: null, clubId, coachId: user.id },
  };
}

function refresh(clubId: string) {
  revalidatePath(`/club/${clubId}/objetivos`);
  // Los alumnos del club ven el cambio en su ficha y en el informe.
  revalidatePath("/students", "layout");
}

export async function createClubObjective(input: {
  clubId: string;
  ball: string;
  aspect: string;
  block: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z
    .object({
      clubId: uuid,
      ball: z.enum(BALLS.map((b) => b.id) as [string, ...string[]]),
      aspect: z.enum(["tecnico", "tactico", "mental", "fisico"]),
      block: z.string().trim().min(1).max(80),
      title: z.string().trim().min(1).max(200),
      criterion: z.string().trim().max(300).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.clubId);
  if (!auth.ok) return auth;
  const res = await createOwnObjective(auth.ctx, "club", auth.userId, {
    ball: v.ball,
    aspect: v.aspect,
    block: v.block,
    title: v.title,
    criterion: v.criterion || null,
  });
  refresh(v.clubId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function updateClubObjective(input: {
  clubId: string;
  objectiveId: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z
    .object({
      clubId: uuid,
      objectiveId: uuid,
      title: z.string().trim().min(1).max(200),
      criterion: z.string().trim().max(300).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.clubId);
  if (!auth.ok) return auth;
  const res = await updateObjectiveText(
    auth.ctx,
    "club",
    auth.userId,
    v.objectiveId,
    {
      title: v.title,
      criterion: v.criterion ?? "",
    }
  );
  refresh(v.clubId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function removeClubObjective(input: {
  clubId: string;
  objectiveId: string;
}) {
  const parsed = z.object({ clubId: uuid, objectiveId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.clubId);
  if (!auth.ok) return auth;
  const res = await removeObjectiveFor(
    auth.ctx,
    "club",
    auth.userId,
    v.objectiveId
  );
  refresh(v.clubId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function restoreClubObjective(input: {
  clubId: string;
  objectiveId: string;
}) {
  const parsed = z.object({ clubId: uuid, objectiveId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.clubId);
  if (!auth.ok) return auth;
  const res = await restoreObjectiveFor(
    auth.ctx,
    "club",
    auth.userId,
    v.objectiveId
  );
  refresh(v.clubId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function moveClubObjective(input: {
  clubId: string;
  objectiveId: string;
  direction: "up" | "down";
}) {
  const parsed = z
    .object({
      clubId: uuid,
      objectiveId: uuid,
      direction: z.enum(["up", "down"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.clubId);
  if (!auth.ok) return auth;
  const items = await loadClubObjectives(v.clubId, auth.userId);
  const res = await moveObjectiveFor(
    auth.ctx,
    "club",
    auth.userId,
    items,
    v.objectiveId,
    v.direction
  );
  refresh(v.clubId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

const groupSchema = z.object({
  ball: z.enum(BALLS.map((b) => b.id) as [string, ...string[]]),
  aspect: z.enum(["tecnico", "tactico", "mental", "fisico"]),
  block: z.string().trim().min(1).max(80),
});

export async function placeClubObjective(input: {
  clubId: string;
  objectiveId: string;
  target: { ball: string; aspect: string; block: string };
  beforeId: string | null;
}) {
  const parsed = z
    .object({
      clubId: uuid,
      objectiveId: uuid,
      target: groupSchema,
      beforeId: uuid.nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.clubId);
  if (!auth.ok) return auth;
  const items = await loadClubObjectives(v.clubId, auth.userId);
  const res = await placeObjectiveFor(
    auth.ctx,
    "club",
    auth.userId,
    items,
    v.objectiveId,
    v.target,
    v.beforeId
  );
  refresh(v.clubId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function duplicateClubObjective(input: {
  clubId: string;
  objectiveId: string;
}) {
  const parsed = z.object({ clubId: uuid, objectiveId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.clubId);
  if (!auth.ok) return auth;
  const items = await loadClubObjectives(v.clubId, auth.userId);
  const res = await duplicateObjectiveFor(
    auth.ctx,
    "club",
    auth.userId,
    items,
    v.objectiveId
  );
  refresh(v.clubId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}
