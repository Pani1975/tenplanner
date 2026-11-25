import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { matches, playerProfiles, users } from "@/db/schema";
import { isAdult } from "@/lib/age";
import { playerCategory } from "./category";
import { roundLabel } from "@/lib/matches/rounds";
import { matchOutcome } from "@/lib/matches/outcome";
import { rivalName } from "@/lib/matches/validation";
import { slugBase, type ProfileData } from "./profile";

export type PlayerProfileRow = typeof playerProfiles.$inferSelect;

export async function getPlayerProfile(
  userId: string
): Promise<PlayerProfileRow | null> {
  const [row] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
    .limit(1);
  return row ?? null;
}

/** Enlace público libre: "ana-garcia", "ana-garcia-2"… */
async function freeSlug(userId: string, base: string): Promise<string> {
  for (let i = 1; i < 200; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const [taken] = await db
      .select({ userId: playerProfiles.userId })
      .from(playerProfiles)
      .where(
        and(eq(playerProfiles.slug, candidate), ne(playerProfiles.userId, userId))
      )
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Guarda el perfil. El enlace público se crea la primera vez que se hace
 * público y no cambia después (aunque cambie el nombre), para no romper
 * enlaces ya compartidos.
 */
export async function savePlayerProfile(userId: string, data: ProfileData) {
  const current = await getPlayerProfile(userId);
  const slug =
    current?.slug ??
    (data.isPublic ? await freeSlug(userId, slugBase(data.firstName, data.lastName)) : null);

  const [row] = await db
    .insert(playerProfiles)
    .values({ userId, ...data, slug })
    .onConflictDoUpdate({
      target: playerProfiles.userId,
      set: { ...data, slug, updatedAt: new Date() },
    })
    .returning();
  return row;
}

/** Lo único que se publica de un partido: nunca el rival. */
export interface PublicMatch {
  id: string;
  matchType: (typeof matches.$inferSelect)["matchType"];
  matchDate: string;
  tournamentName: string | null;
  /** Ronda ya en texto («Semifinal»), o null. */
  round: string | null;
  /** Rival (nombre y apellidos), solo de los partidos publicados. Sin licencia. */
  rival: string | null;
  finalResult: string | null;
  outcome: "victoria" | "derrota" | null;
}

export interface PublicPlayerProfile {
  name: string;
  photoUrl: string | null;
  category: string | null;
  clubName: string | null;
  dominantHand: string | null;
  startedAge: number | null;
  favoritePlayer: string | null;
  birthPlace: string | null;
  matches: PublicMatch[];
}

/**
 * Perfil público por su enlace. null si no existe, no es público o el
 * jugador es menor (doble comprobación: no se publica nunca a un menor).
 * No devuelve la fecha de nacimiento, solo la categoría.
 */
export async function getPublicPlayerProfile(
  slug: string
): Promise<PublicPlayerProfile | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const [row] = await db
    .select({ profile: playerProfiles, image: users.image })
    .from(playerProfiles)
    .innerJoin(users, eq(users.id, playerProfiles.userId))
    .where(and(eq(playerProfiles.slug, slug), eq(playerProfiles.isPublic, true)))
    .limit(1);
  if (!row) return null;
  const p = row.profile;
  if (!p.birthDate || !isAdult(p.birthDate)) return null;

  const publicMatches = await db
    .select({
      id: matches.id,
      matchType: matches.matchType,
      matchDate: matches.matchDate,
      tournamentName: matches.tournamentName,
      round: matches.round,
      roundOther: matches.roundOther,
      rivalFirstName: matches.rivalFirstName,
      rivalLastName: matches.rivalLastName,
      finalResult: matches.finalResult,
    })
    .from(matches)
    .where(and(eq(matches.userId, p.userId), eq(matches.showOnProfile, true)))
    .orderBy(desc(matches.matchDate), desc(matches.createdAt));

  return {
    name: `${p.firstName} ${p.lastName}`,
    photoUrl: p.showPhoto ? row.image : null,
    category: playerCategory(p.birthDate),
    clubName: p.clubName,
    dominantHand: p.dominantHand,
    startedAge: p.startedAge,
    favoritePlayer: p.favoritePlayer,
    birthPlace: p.birthPlace,
    matches: publicMatches.map(
      ({ roundOther, rivalFirstName, rivalLastName, ...m }): PublicMatch => ({
        ...m,
        round: roundLabel(m.round, roundOther),
        rival: rivalName({ rivalFirstName, rivalLastName }),
        outcome: matchOutcome(m.finalResult),
      })
    ),
  };
}
