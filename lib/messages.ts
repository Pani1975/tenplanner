import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  clubMembers,
  groupStudents,
  groups,
  studentGuardians,
  students,
  users,
} from "@/db/schema";
import { dbForUser } from "@/lib/db-for-user";
import { getActiveWorkClubId } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import type { Sport } from "@/lib/sport-constants";
import { isAdult } from "@/lib/age";

/**
 * Mensajes del club (tabla announcements). Las reglas de quién envía y
 * quién lee viven en la base de datos (migraciones 0054 y 0055): aquí se
 * reutilizan esas funciones SQL dentro de dbForUser, que fija auth.uid()
 * al usuario de la petición — la conexión de Drizzle se salta RLS, así que
 * las comprobaciones no se pueden omitir.
 */

export const AUDIENCES = [
  "club",
  "group",
  "student",
  "coaches",
  "coach",
] as const;
export type Audience = (typeof AUDIENCES)[number];

export interface MessagingContext {
  clubId: string | null;
  isClubAdmin: boolean;
  sport: Sport;
}

export async function getMessagingContext(
  userId: string
): Promise<MessagingContext> {
  const [clubId, sport] = await Promise.all([
    getActiveWorkClubId(userId),
    getActiveSport(userId),
  ]);
  if (!clubId) return { clubId: null, isClubAdmin: false, sport };
  const isClubAdmin = await dbForUser(userId, async (tx) => {
    const rows = await tx.execute<{ ok: boolean }>(
      sql`select public.is_club_admin(${clubId}::uuid) as ok`
    );
    return !!rows[0]?.ok;
  });
  return { clubId, isClubAdmin, sport };
}

export interface RecipientOptions {
  coaches: { id: string; name: string }[];
  groups: { id: string; name: string; students: number; contacts: number }[];
  students: {
    id: string;
    name: string;
    adult: boolean;
    contacts: number;
  }[];
}

/**
 * Destinatarios posibles en el espacio del club y deporte activos: los
 * monitores vinculados al club para ese deporte, los grupos del club de
 * ese deporte y los alumnos del club. `contacts` = tutores (o el propio
 * alumno adulto) con cuenta activa, que son quienes lo recibirán.
 */
export async function listRecipientOptions(
  clubId: string,
  sport: Sport
): Promise<RecipientOptions> {
  const activeContact = and(
    isNull(studentGuardians.revokedAt),
    sql`${studentGuardians.userId} is not null`
  );

  const [coachRows, groupRows, studentRows] = await Promise.all([
    db
      .selectDistinct({ id: users.id, name: users.name })
      .from(clubMembers)
      .innerJoin(users, eq(users.id, clubMembers.userId))
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.role, "coach"),
          eq(clubMembers.status, "active"),
          eq(clubMembers.sport, sport)
        )
      )
      .orderBy(asc(users.name)),
    db
      .select({
        id: groups.id,
        name: groups.name,
        students: sql<number>`count(distinct ${groupStudents.studentId})::int`,
        contacts: sql<number>`count(distinct ${studentGuardians.id}) filter (where ${studentGuardians.revokedAt} is null and ${studentGuardians.userId} is not null)::int`,
      })
      .from(groups)
      .leftJoin(groupStudents, eq(groupStudents.groupId, groups.id))
      .leftJoin(
        studentGuardians,
        eq(studentGuardians.studentId, groupStudents.studentId)
      )
      .where(and(eq(groups.clubId, clubId), eq(groups.sport, sport)))
      .groupBy(groups.id)
      .orderBy(asc(groups.name)),
    db
      .select({
        id: students.id,
        name: students.name,
        birthDate: students.birthDate,
        contacts: count(studentGuardians.id),
      })
      .from(students)
      .leftJoin(
        studentGuardians,
        and(eq(studentGuardians.studentId, students.id), activeContact)
      )
      .where(eq(students.clubId, clubId))
      .groupBy(students.id)
      .orderBy(asc(students.name)),
  ]);

  return {
    coaches: coachRows,
    groups: groupRows.map((g) => ({
      ...g,
      students: Number(g.students),
      contacts: Number(g.contacts),
    })),
    students: studentRows.map((s) => ({
      id: s.id,
      name: s.name,
      adult: isAdult(s.birthDate),
      contacts: Number(s.contacts),
    })),
  };
}

export interface SendMessageInput {
  audience: Audience;
  recipientUserId?: string | null;
  groupId?: string | null;
  studentId?: string | null;
  title: string;
  body: string;
  allowReplies?: boolean;
}

export class MessagePermissionError extends Error {}

/** Crea el mensaje si la base de datos confirma que el usuario puede enviarlo. */
export async function sendMessage(
  userId: string,
  clubId: string,
  sport: Sport,
  input: SendMessageInput
) {
  const groupId = input.audience === "group" ? (input.groupId ?? null) : null;
  const studentId =
    input.audience === "student" ? (input.studentId ?? null) : null;
  const recipientUserId =
    input.audience === "coach" ? (input.recipientUserId ?? null) : null;
  const allowReplies =
    ["club", "group", "student"].includes(input.audience) &&
    !!input.allowReplies;

  return dbForUser(userId, async (tx) => {
    const [check] = await tx.execute<{ ok: boolean }>(
      sql`select public.can_send_announcement(
        ${clubId}::uuid,
        ${input.audience}::announcement_audience,
        ${groupId}::uuid,
        ${studentId}::uuid,
        ${recipientUserId}::uuid
      ) as ok`
    );
    if (!check?.ok) throw new MessagePermissionError();

    const [row] = await tx
      .insert(announcements)
      .values({
        clubId,
        audience: input.audience,
        groupId,
        studentId,
        recipientUserId,
        sport: input.audience === "coaches" ? sport : null,
        authorId: userId,
        title: input.title,
        body: input.body,
        allowReplies,
      })
      .returning({ id: announcements.id });
    return row;
  });
}

/**
 * Mensajes "recibidos" por el usuario (los que cuentan como nuevos): no los
 * ha escrito él y van dirigidos a él — como familia, como monitor concreto o
 * como parte de "todos los monitores". Los avisos que el admin ve solo por
 * supervisar el club no cuentan.
 */
function receivedBy(userId: string) {
  return sql`(${announcements.authorId} <> ${userId}::uuid and (
    public.guardian_sees_announcement(${announcements.id})
    or (${announcements.audience} = 'coach' and ${announcements.recipientUserId} = ${userId}::uuid)
    or (${announcements.audience} = 'coaches' and public.staff_sees_announcement(${announcements.id}))
  ))`;
}

function notReadBy(userId: string) {
  return sql`not exists (select 1 from announcement_reads r
    where r.announcement_id = ${announcements.id} and r.user_id = ${userId}::uuid)`;
}

/** Número de mensajes recibidos sin leer (para el contador del menú). */
export async function countUnreadMessages(userId: string): Promise<number> {
  const [row] = await dbForUser(userId, (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(announcements)
      .where(
        and(
          isNull(announcements.deletedAt),
          receivedBy(userId),
          notReadBy(userId)
        )
      )
  );
  return Number(row?.n ?? 0);
}

/** Marca como leídos los mensajes indicados que el usuario puede ver. */
export async function markMessagesRead(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await dbForUser(userId, (tx) =>
    tx.execute(sql`
      insert into announcement_reads (announcement_id, user_id)
      select a.id, ${userId}::uuid from announcements a
      where a.id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `
      )})
        and (public.staff_sees_announcement(a.id) or public.guardian_sees_announcement(a.id))
      on conflict do nothing`)
  );
}

export interface MessageListItem {
  id: string;
  audience: Audience;
  title: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string | null;
  targetLabel: string;
  sentByMe: boolean;
  /** Recibido y todavía sin leer */
  unread: boolean;
}

/** Mensajes que el usuario puede ver (enviados o recibidos), más recientes primero. */
export async function listVisibleMessages(
  userId: string,
  limit = 50
): Promise<MessageListItem[]> {
  const rows = await dbForUser(userId, (tx) =>
    tx
      .select({
        id: announcements.id,
        audience: announcements.audience,
        title: announcements.title,
        body: announcements.body,
        createdAt: announcements.createdAt,
        authorId: announcements.authorId,
        sport: announcements.sport,
        groupId: announcements.groupId,
        studentId: announcements.studentId,
        recipientUserId: announcements.recipientUserId,
        unread: sql<boolean>`(${receivedBy(userId)} and ${notReadBy(userId)})`,
      })
      .from(announcements)
      .where(
        and(
          isNull(announcements.deletedAt),
          sql`(public.staff_sees_announcement(${announcements.id}) or public.guardian_sees_announcement(${announcements.id}))`
        )
      )
      .orderBy(desc(announcements.createdAt))
      .limit(limit)
  );
  if (rows.length === 0) return [];

  const userIds = new Set<string>();
  const groupIds = new Set<string>();
  const studentIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.authorId);
    if (r.recipientUserId) userIds.add(r.recipientUserId);
    if (r.groupId) groupIds.add(r.groupId);
    if (r.studentId) studentIds.add(r.studentId);
  }
  const [userNames, groupNames, studentNames] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [...userIds])),
    groupIds.size
      ? db
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(inArray(groups.id, [...groupIds]))
      : [],
    studentIds.size
      ? db
          .select({ id: students.id, name: students.name })
          .from(students)
          .where(inArray(students.id, [...studentIds]))
      : [],
  ]);
  const nameOf = (list: { id: string; name: string }[]) =>
    new Map(list.map((x) => [x.id, x.name]));
  const userMap = nameOf(userNames);
  const groupMap = nameOf(groupNames);
  const studentMap = nameOf(studentNames);

  return rows.map((r) => {
    let targetLabel: string;
    switch (r.audience) {
      case "club":
        targetLabel = "Todo el club";
        break;
      case "group":
        targetLabel = `Grupo ${groupMap.get(r.groupId ?? "") ?? ""}`.trim();
        break;
      case "student":
        targetLabel = studentMap.get(r.studentId ?? "") ?? "Alumno";
        break;
      case "coaches":
        targetLabel = "Todos los monitores";
        break;
      case "coach":
        targetLabel =
          r.recipientUserId === userId
            ? "Para ti"
            : (userMap.get(r.recipientUserId ?? "") ?? "Monitor");
        break;
    }
    return {
      id: r.id,
      audience: r.audience,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt,
      authorId: r.authorId,
      authorName: userMap.get(r.authorId) ?? null,
      targetLabel,
      sentByMe: r.authorId === userId,
      unread: !!r.unread,
    };
  });
}
