import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  clubMembers,
  groupCoaches,
  groups,
  studentCoaches,
  students,
  users,
} from "@/db/schema";
import type { Sport } from "@/lib/sport-constants";

// Asignación de monitores a grupos y alumnos de un club. Solo la hace el
// dueño del club (gestor) y solo entre los monitores activos de ese club.

export type AssignedCoach = { id: string; name: string };

/**
 * Separa los ids pedidos entre los que se pueden asignar y los que no.
 * Quita duplicados y conserva el orden de la petición.
 */
export function splitAssignable(requested: string[], allowed: string[]) {
  const allowedSet = new Set(allowed);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const id of requested) {
    if (seen.has(id)) continue;
    seen.add(id);
    (allowedSet.has(id) ? valid : invalid).push(id);
  }
  return { valid, invalid };
}

/**
 * Monitores activos del club que se pueden asignar. Con `sport`, solo los
 * vinculados al club para ese deporte (un grupo es de un único deporte).
 * Un monitor vinculado a varios deportes sale una sola vez.
 */
export async function getAssignableCoaches(
  clubId: string,
  sport?: Sport
): Promise<AssignedCoach[]> {
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.role, "coach"),
        eq(clubMembers.status, "active"),
        ...(sport ? [eq(clubMembers.sport, sport)] : [])
      )
    )
    .orderBy(users.name);
  const byId = new Map<string, AssignedCoach>();
  for (const row of rows) byId.set(row.id, row);
  return Array.from(byId.values());
}

export async function listGroupCoaches(
  groupId: string
): Promise<AssignedCoach[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(groupCoaches)
    .innerJoin(users, eq(users.id, groupCoaches.userId))
    .where(eq(groupCoaches.groupId, groupId))
    .orderBy(users.name);
}

export async function listStudentCoaches(
  studentId: string
): Promise<AssignedCoach[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(studentCoaches)
    .innerJoin(users, eq(users.id, studentCoaches.userId))
    .where(eq(studentCoaches.studentId, studentId))
    .orderBy(users.name);
}

/** Monitores asignados de varios grupos a la vez (para el listado). */
export async function listCoachesByGroupIds(groupIds: string[]) {
  const byGroup = new Map<string, AssignedCoach[]>();
  if (groupIds.length === 0) return byGroup;
  const rows = await db
    .select({
      groupId: groupCoaches.groupId,
      id: users.id,
      name: users.name,
    })
    .from(groupCoaches)
    .innerJoin(users, eq(users.id, groupCoaches.userId))
    .where(inArray(groupCoaches.groupId, groupIds))
    .orderBy(users.name);
  for (const row of rows) {
    const list = byGroup.get(row.groupId) ?? [];
    list.push({ id: row.id, name: row.name });
    byGroup.set(row.groupId, list);
  }
  return byGroup;
}

type SetResult =
  | { ok: true; coaches: AssignedCoach[] }
  | { ok: false; reason: "invalid_coaches" };

/** Sustituye los monitores asignados a un grupo del club. */
export async function setGroupCoaches(input: {
  groupId: string;
  clubId: string;
  sport: Sport;
  userIds: string[];
  assignedBy: string;
}): Promise<SetResult> {
  const assignable = await getAssignableCoaches(input.clubId, input.sport);
  const { valid, invalid } = splitAssignable(
    input.userIds,
    assignable.map((c) => c.id)
  );
  if (invalid.length > 0) return { ok: false, reason: "invalid_coaches" };

  await db.transaction(async (tx) => {
    await tx
      .delete(groupCoaches)
      .where(eq(groupCoaches.groupId, input.groupId));
    if (valid.length > 0) {
      await tx.insert(groupCoaches).values(
        valid.map((userId) => ({
          groupId: input.groupId,
          userId,
          assignedByUserId: input.assignedBy,
        }))
      );
    }
  });
  return {
    ok: true,
    coaches: assignable.filter((c) => valid.includes(c.id)),
  };
}

/** Sustituye los monitores asignados a un alumno del club. */
export async function setStudentCoaches(input: {
  studentId: string;
  clubId: string;
  userIds: string[];
  assignedBy: string;
}): Promise<SetResult> {
  const assignable = await getAssignableCoaches(input.clubId);
  const { valid, invalid } = splitAssignable(
    input.userIds,
    assignable.map((c) => c.id)
  );
  if (invalid.length > 0) return { ok: false, reason: "invalid_coaches" };

  await db.transaction(async (tx) => {
    await tx
      .delete(studentCoaches)
      .where(eq(studentCoaches.studentId, input.studentId));
    if (valid.length > 0) {
      await tx.insert(studentCoaches).values(
        valid.map((userId) => ({
          studentId: input.studentId,
          userId,
          assignedByUserId: input.assignedBy,
        }))
      );
    }
  });
  return {
    ok: true,
    coaches: assignable.filter((c) => valid.includes(c.id)),
  };
}

/**
 * Al desvincular a un monitor de un deporte del club se le quita de los
 * grupos de ese deporte; si ya no le queda ningún deporte activo en el club,
 * también de todos los grupos y alumnos del club.
 */
export async function clearCoachAssignments(input: {
  clubId: string;
  userId: string;
  sport: Sport;
}) {
  const remaining = await db
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .where(
      and(
        eq(clubMembers.clubId, input.clubId),
        eq(clubMembers.userId, input.userId),
        eq(clubMembers.role, "coach"),
        eq(clubMembers.status, "active")
      )
    )
    .limit(1);
  const leftClub = remaining.length === 0;

  const clubGroups = db
    .select({ id: groups.id })
    .from(groups)
    .where(
      leftClub
        ? eq(groups.clubId, input.clubId)
        : and(eq(groups.clubId, input.clubId), eq(groups.sport, input.sport))
    );
  await db
    .delete(groupCoaches)
    .where(
      and(
        eq(groupCoaches.userId, input.userId),
        inArray(groupCoaches.groupId, clubGroups)
      )
    );

  if (leftClub) {
    await db
      .delete(studentCoaches)
      .where(
        and(
          eq(studentCoaches.userId, input.userId),
          inArray(
            studentCoaches.studentId,
            db
              .select({ id: students.id })
              .from(students)
              .where(eq(students.clubId, input.clubId))
          )
        )
      );
  }
}
