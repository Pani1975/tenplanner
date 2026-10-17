import { randomBytes } from "crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubs, studentGuardians, students, users } from "@/db/schema";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { isAdult } from "@/lib/age";
import {
  GUARDIAN_CONSENT_VERSION,
  type GuardianRelationship,
} from "@/lib/guardian-labels";

/**
 * Contactos de un alumno para los mensajes del club (tabla
 * student_guardians). Con un menor el contacto es siempre su madre, padre o
 * tutor legal; el propio alumno solo puede ser su contacto si consta que es
 * mayor de edad (lo impone también el trigger check_guardian_relationship).
 *
 * El contacto activa su cuenta con un enlace /familia/<token>; hasta
 * entonces no recibe nada.
 */

export const GUARDIAN_INVITE_DAYS = 14;

export function generateGuardianToken() {
  return randomBytes(24).toString("base64url");
}

function inviteExpiry() {
  return new Date(Date.now() + GUARDIAN_INVITE_DAYS * 24 * 60 * 60 * 1000);
}

export type GuardianStatus = "active" | "pending" | "expired" | "revoked";

export interface GuardianView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: GuardianRelationship | null;
  status: GuardianStatus;
  inviteToken: string | null;
  inviteExpiresAt: Date | null;
  accountName: string | null;
}

export function guardianStatus(g: {
  userId: string | null;
  revokedAt: Date | null;
  inviteToken: string | null;
  inviteExpiresAt: Date | null;
}): GuardianStatus {
  if (g.revokedAt) return "revoked";
  if (g.userId) return "active";
  if (
    g.inviteToken &&
    g.inviteExpiresAt &&
    g.inviteExpiresAt.getTime() > Date.now()
  ) {
    return "pending";
  }
  return "expired";
}

/**
 * El alumno si el usuario puede gestionarlo en su modo de trabajo actual
 * (la misma regla que la ficha del alumno), o null.
 */
export async function getManageableStudent(userId: string, studentId: string) {
  const activeClubId = await getActiveWorkClubId(userId);
  const [student] = await db
    .select({
      id: students.id,
      name: students.name,
      clubId: students.clubId,
      birthDate: students.birthDate,
    })
    .from(students)
    .where(
      and(
        eq(students.id, studentId),
        sharedWithClubCondition(
          students.coachId,
          students.clubId,
          userId,
          activeClubId
        )
      )
    )
    .limit(1);
  return student ?? null;
}

export async function listGuardians(
  studentId: string
): Promise<GuardianView[]> {
  const rows = await db
    .select({
      g: studentGuardians,
      accountName: users.name,
    })
    .from(studentGuardians)
    .leftJoin(users, eq(users.id, studentGuardians.userId))
    .where(eq(studentGuardians.studentId, studentId))
    .orderBy(asc(studentGuardians.createdAt));
  return rows.map(({ g, accountName }) => {
    const status = guardianStatus(g);
    return {
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      relationship: (g.relationship as GuardianRelationship | null) ?? null,
      status,
      // El enlace solo se muestra mientras sirve para algo
      inviteToken: status === "pending" ? g.inviteToken : null,
      inviteExpiresAt: status === "pending" ? g.inviteExpiresAt : null,
      accountName: status === "active" ? accountName : null,
    };
  });
}

export class GuardianError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export async function createGuardian(
  student: { id: string; birthDate: string | null },
  input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    relationship: GuardianRelationship;
  }
) {
  if (input.relationship === "alumno" && !isAdult(student.birthDate)) {
    throw new GuardianError(
      "El alumno es menor de edad (o no consta su fecha de nacimiento): el contacto tiene que ser su madre, padre o tutor legal."
    );
  }
  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    const [dup] = await db
      .select({ id: studentGuardians.id })
      .from(studentGuardians)
      .where(
        and(
          eq(studentGuardians.studentId, student.id),
          isNull(studentGuardians.revokedAt),
          sql`lower(${studentGuardians.email}) = ${email}`
        )
      )
      .limit(1);
    if (dup) {
      throw new GuardianError(
        "Ya hay un contacto con ese email para este alumno.",
        409
      );
    }
  }
  const [row] = await db
    .insert(studentGuardians)
    .values({
      studentId: student.id,
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || null,
      relationship: input.relationship,
      inviteToken: generateGuardianToken(),
      inviteExpiresAt: inviteExpiry(),
    })
    .returning({ id: studentGuardians.id });
  return row;
}

async function guardianOfStudent(studentId: string, guardianId: string) {
  const [g] = await db
    .select()
    .from(studentGuardians)
    .where(
      and(
        eq(studentGuardians.id, guardianId),
        eq(studentGuardians.studentId, studentId)
      )
    )
    .limit(1);
  if (!g) throw new GuardianError("Contacto no encontrado.", 404);
  return g;
}

/** Nuevo enlace de invitación (anula el anterior). */
export async function regenerateGuardianInvite(
  studentId: string,
  guardianId: string
) {
  const g = await guardianOfStudent(studentId, guardianId);
  if (g.revokedAt) {
    throw new GuardianError("Este contacto está dado de baja.");
  }
  if (g.userId) {
    throw new GuardianError("Este contacto ya tiene la cuenta activada.");
  }
  await db
    .update(studentGuardians)
    .set({
      inviteToken: generateGuardianToken(),
      inviteExpiresAt: inviteExpiry(),
    })
    .where(eq(studentGuardians.id, g.id));
}

/** Baja: deja de recibir mensajes y su enlace deja de valer. */
export async function revokeGuardian(studentId: string, guardianId: string) {
  const g = await guardianOfStudent(studentId, guardianId);
  if (g.revokedAt) return;
  await db
    .update(studentGuardians)
    .set({ revokedAt: new Date(), inviteToken: null, inviteExpiresAt: null })
    .where(eq(studentGuardians.id, g.id));
}

export async function getGuardianInvite(token: string) {
  if (!token || token.length < 10) return null;
  const [row] = await db
    .select({
      guardian: studentGuardians,
      studentName: students.name,
      clubName: clubs.name,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .leftJoin(clubs, eq(clubs.id, students.clubId))
    .where(eq(studentGuardians.inviteToken, token))
    .limit(1);
  return row ?? null;
}

/**
 * Vincula la cuenta del usuario al contacto y registra su consentimiento.
 * Si el contacto tiene email, la cuenta tiene que ser de ese email.
 */
export async function acceptGuardianInvite(
  user: { id: string; email: string | null | undefined },
  token: string
) {
  const invite = await getGuardianInvite(token);
  if (!invite) throw new GuardianError("Invitación no encontrada.", 404);
  const g = invite.guardian;
  const status = guardianStatus(g);
  if (status === "revoked" || status === "active") {
    throw new GuardianError("Esta invitación ya no está disponible.", 410);
  }
  if (status === "expired") {
    throw new GuardianError(
      "Esta invitación ha caducado. Pide al club un enlace nuevo.",
      410
    );
  }
  if (g.email && g.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    throw new GuardianError(
      `Esta invitación es para ${g.email}. Entra con esa cuenta para aceptarla.`,
      403
    );
  }
  const [updated] = await db
    .update(studentGuardians)
    .set({
      userId: user.id,
      consentGivenAt: new Date(),
      consentVersion: GUARDIAN_CONSENT_VERSION,
      inviteToken: null,
      inviteExpiresAt: null,
    })
    .where(
      and(
        eq(studentGuardians.id, g.id),
        eq(studentGuardians.inviteToken, token),
        isNull(studentGuardians.userId),
        isNull(studentGuardians.revokedAt)
      )
    )
    .returning({ id: studentGuardians.id });
  if (!updated) {
    throw new GuardianError("Esta invitación ya no está disponible.", 410);
  }
  return { studentName: invite.studentName, clubName: invite.clubName };
}
