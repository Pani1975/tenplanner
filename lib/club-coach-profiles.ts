import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubCoachProfiles, clubMembers, users } from "@/db/schema";
import { generateInviteToken } from "@/lib/clubs";
import {
  COACH_PROFILE_LINK_EXPIRY_DAYS,
  type Availability,
  type CoachProfileData,
  type CoachProfileStatus,
  type ExperienceEntry,
} from "@/lib/coach-profile";

type ProfileRow = typeof clubCoachProfiles.$inferSelect;

/** Ficha tal como la ve el gestor en pantalla (fechas como texto). */
export type CoachProfileView = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  academicTraining: string | null;
  tennisTraining: string | null;
  availability: Availability | null;
  startedTeachingYear: number | null;
  experience: ExperienceEntry[];
  status: CoachProfileStatus;
  /** La rellenó el propio monitor desde el enlace. */
  filledByCoach: boolean;
  /** Token del enlace si sigue vigente; null si no hay o caducó. */
  linkToken: string | null;
  linkExpiresAt: string | null;
  updatedAt: string;
};

export function toCoachProfileView(
  row: ProfileRow,
  now = new Date()
): CoachProfileView {
  const linkActive =
    !!row.profileToken &&
    !!row.profileTokenExpiresAt &&
    row.profileTokenExpiresAt > now;
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    academicTraining: row.academicTraining,
    tennisTraining: row.tennisTraining,
    availability: row.availability ?? null,
    startedTeachingYear: row.startedTeachingYear,
    experience: row.experience ?? [],
    status: row.status === "pending" ? "pending" : "complete",
    filledByCoach: !!row.consentGivenAt,
    linkToken: linkActive ? row.profileToken : null,
    linkExpiresAt: linkActive
      ? (row.profileTokenExpiresAt?.toISOString() ?? null)
      : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function newProfileLink() {
  return {
    profileToken: generateInviteToken(),
    profileTokenExpiresAt: new Date(
      Date.now() + COACH_PROFILE_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    ),
  };
}

export function isUniqueViolation(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function listClubCoachProfiles(
  clubId: string
): Promise<CoachProfileView[]> {
  const rows = await db
    .select()
    .from(clubCoachProfiles)
    .where(eq(clubCoachProfiles.clubId, clubId))
    .orderBy(asc(clubCoachProfiles.fullName));
  const now = new Date();
  return rows.map((row) => toCoachProfileView(row, now));
}

export async function getClubCoachProfile(clubId: string, id: string) {
  const [row] = await db
    .select()
    .from(clubCoachProfiles)
    .where(
      and(eq(clubCoachProfiles.id, id), eq(clubCoachProfiles.clubId, clubId))
    )
    .limit(1);
  return row ?? null;
}

/** Campos de la tabla a partir de una ficha ya validada. */
export function profileColumns(data: CoachProfileData) {
  return {
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    academicTraining: data.academicTraining,
    tennisTraining: data.tennisTraining,
    availability: data.availability,
    startedTeachingYear: data.startedTeachingYear,
    experience: data.experience,
  };
}

/**
 * Fichas de los clubes de los que `userId` es monitor activo, por su email.
 * La ficha de un monitor con cuenta la mantiene él desde su Perfil.
 */
export async function getOwnCoachProfiles(userId: string, email: string) {
  const clubIds = (
    await db
      .select({ clubId: clubMembers.clubId })
      .from(clubMembers)
      .where(
        and(
          eq(clubMembers.userId, userId),
          eq(clubMembers.role, "coach"),
          eq(clubMembers.status, "active")
        )
      )
  ).map((r) => r.clubId);
  const uniqueClubIds = Array.from(new Set(clubIds));
  if (uniqueClubIds.length === 0) return { clubIds: [], rows: [] };
  const rows = await db
    .select()
    .from(clubCoachProfiles)
    .where(
      and(
        inArray(clubCoachProfiles.clubId, uniqueClubIds),
        eq(clubCoachProfiles.email, email.toLowerCase())
      )
    )
    .orderBy(desc(clubCoachProfiles.updatedAt));
  return { clubIds: uniqueClubIds, rows };
}

/**
 * ¿La ficha es de un monitor del club con cuenta que la rellenó él? Entonces
 * la controla el monitor (desde su Perfil) y el gestor solo la ve.
 */
export async function isCoachControlledProfile(
  clubId: string,
  row: { email: string; consentGivenAt: Date | null }
) {
  if (!row.consentGivenAt) return false;
  const [member] = await db
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.status, "active"),
        sql`lower(${users.email}) = ${row.email.toLowerCase()}`
      )
    )
    .limit(1);
  return !!member;
}
