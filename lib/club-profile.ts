import { and, count, countDistinct, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers, clubs, students } from "@/db/schema";
import type { ClubIdentity } from "@/lib/club-identity";

type ClubRow = typeof clubs.$inferSelect;

/** Ficha del club a partir de su fila (ver components/app/club-identity-form). */
export function clubIdentityFromRow(
  club: ClubRow,
  /** Email que se propone si el club aún no tiene (el de la cuenta). */
  fallbackEmail?: string | null
): ClubIdentity {
  return {
    name: club.name,
    fullName: club.fullName,
    address: club.address,
    phone: club.phone,
    email: club.email ?? fallbackEmail ?? null,
    website: club.website,
    coverImageUrl: club.coverImageUrl,
    photos: club.photos ?? [],
    videos: club.videos ?? [],
    courts: club.courts ?? null,
    padelCourts: club.padelCourts,
    hasCafeteria: club.hasCafeteria,
    hasParking: club.hasParking,
    foundedYear: club.foundedYear,
  };
}

/** Monitores dados de alta (activos) y alumnos del club. */
export async function getClubStats(
  clubId: string
): Promise<{ monitors: number; students: number }> {
  const [[m], [s]] = await Promise.all([
    db
      .select({ total: countDistinct(clubMembers.userId) })
      .from(clubMembers)
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.role, "coach"),
          eq(clubMembers.status, "active")
        )
      ),
    db
      .select({ total: count() })
      .from(students)
      .where(eq(students.clubId, clubId)),
  ]);
  return { monitors: Number(m?.total ?? 0), students: Number(s?.total ?? 0) };
}
