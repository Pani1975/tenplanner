import { randomBytes } from "crypto";
import { and, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { db } from "@/db";
import { clubInvites, clubMembers, clubs, users } from "@/db/schema";

export const CLUB_INVITE_EXPIRY_DAYS = 14;

export function generateInviteToken() {
  return randomBytes(24).toString("base64url");
}

export function inviteExpiryDate() {
  return new Date(Date.now() + CLUB_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

/** The club a user owns (role "owner", still active), or null. */
export async function getOwnedClub(userId: string) {
  const [row] = await db
    .select({ club: clubs })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(
      and(
        eq(clubMembers.userId, userId),
        eq(clubMembers.role, "owner"),
        eq(clubMembers.status, "active")
      )
    )
    .limit(1);
  return row?.club ?? null;
}

/**
 * Every club a user is linked to as an active coach (not counting one they
 * own), one row per club — with every sport they're linked for at that
 * club (club_members has one row per (club, user, sport), see schema.ts).
 */
export async function getCoachMemberships(userId: string) {
  const rows = await db
    .select({ club: clubs, membership: clubMembers })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(
      and(
        eq(clubMembers.userId, userId),
        eq(clubMembers.role, "coach"),
        eq(clubMembers.status, "active")
      )
    );
  const byClubId = new Map<
    string,
    { club: (typeof rows)[number]["club"]; sports: (typeof rows)[number]["membership"]["sport"][] }
  >();
  for (const { club, membership } of rows) {
    const entry = byClubId.get(club.id) ?? { club, sports: [] };
    entry.sports.push(membership.sport);
    byClubId.set(club.id, entry);
  }
  return Array.from(byClubId.values());
}

/**
 * {id, name} of every club a user can work as: the club they own (if any)
 * plus every club they coach for. Used to populate the "modo de trabajo"
 * switcher in the profile — the user picks one of these (or "particular")
 * and everything they create from then on is tagged with it until they
 * switch again (see getActiveWorkClubId / setActiveWorkClub).
 *
 * A coach may have several club_members rows for the same club (one per
 * sport they're linked for — see club_members.sport), so this dedupes by
 * club id: "modo de trabajo" is about the club, not the sport, which is
 * its own context (see lib/sports.ts).
 */
export async function getClubOptionsForUser(userId: string) {
  const [owned, coachOf] = await Promise.all([
    getOwnedClub(userId),
    getCoachMemberships(userId),
  ]);
  const byId = new Map<string, { id: string; name: string }>();
  if (owned) byId.set(owned.id, { id: owned.id, name: owned.name });
  for (const { club } of coachOf)
    byId.set(club.id, { id: club.id, name: club.name });
  return Array.from(byId.values());
}

/**
 * Whether `userId` may work as `clubId` — true for any club they're an
 * active member of (owner or coach). Used to validate the work-mode
 * switcher server-side, so nobody can set their active club to one they
 * don't belong to.
 */
export async function canTagWithClub(userId: string, clubId: string) {
  const [row] = await db
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .where(
      and(
        eq(clubMembers.userId, userId),
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.status, "active")
      )
    )
    .limit(1);
  return !!row;
}

/**
 * Every club `userId` is an active member of (owner or coach). An item
 * tagged with one of these clubIds is shared among all of that club's
 * active members — this is the list to check against for "can I see
 * this club-tagged item" / "OR clubId IN (...)" visibility queries.
 */
export async function getActiveClubIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ clubId: clubMembers.clubId })
    .from(clubMembers)
    .where(
      and(eq(clubMembers.userId, userId), eq(clubMembers.status, "active"))
    );
  return rows.map((r) => r.clubId);
}

/**
 * {id, name} of every distinct active member (owner + coaches) across the
 * given clubs. Used to build a "filter by monitor" selector once club-shared
 * content is merged into a list.
 */
export async function getClubMembersDirectory(clubIds: string[]) {
  if (clubIds.length === 0) return [];
  const rows = await db
    .select({ userId: clubMembers.userId, name: users.name })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(
      and(
        inArray(clubMembers.clubId, clubIds),
        eq(clubMembers.status, "active")
      )
    );
  const byId = new Map<string, string>();
  for (const row of rows) byId.set(row.userId, row.name);
  return Array.from(byId, ([id, name]) => ({ id, name }));
}

/**
 * The club the user is currently working as (their "modo de trabajo"),
 * or null if they're in "particular"/individual mode. Re-validates that
 * the membership is still active — if the user left the club or was
 * removed since picking it, this returns null rather than a stale id.
 */
export async function getActiveWorkClubId(
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ activeClubId: users.activeClubId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const clubId = row?.activeClubId ?? null;
  if (!clubId) return null;
  const stillActive = await canTagWithClub(userId, clubId);
  return stillActive ? clubId : null;
}

/**
 * Sets the user's "modo de trabajo": `clubId` to work as that club (every
 * new session/alumno/clase/grupo/evento they create is tagged with it and
 * shared with the club's other active members), or `null` to go back to
 * "particular" (individual, private) mode. Throws if `clubId` isn't a club
 * the user actively belongs to.
 */
export async function setActiveWorkClub(userId: string, clubId: string | null) {
  if (clubId && !(await canTagWithClub(userId, clubId))) {
    throw new Error("not_a_member");
  }
  await db
    .update(users)
    .set({ activeClubId: clubId })
    .where(eq(users.id, userId));
}

/**
 * Visibility condition driven by the viewer's current "modo de trabajo"
 * (see getActiveWorkClubId), not by which clubs they merely belong to:
 *
 * - "Particular" mode (`activeClubId` is null): only the viewer's own
 *   items that were themselves created in particular mode
 *   (`ownerColumn = userId AND clubColumn IS NULL`). Anything the viewer
 *   created while working as a club stays out of their particular space.
 * - A club's mode (`activeClubId` set): every item tagged with that club
 *   (`clubColumn = activeClubId`), regardless of who created it — the
 *   whole shared space of that club, not just the viewer's own items.
 *
 * Use this instead of a bare `eq(table.userId, user.id)` wherever a
 * club's members should see each other's club-tagged
 * sessions/events/groups/students/classes.
 */
export function sharedWithClubCondition(
  ownerColumn: AnyColumn,
  clubColumn: AnyColumn,
  userId: string,
  activeClubId: string | null
): SQL {
  if (activeClubId) return eq(clubColumn, activeClubId);
  return and(eq(ownerColumn, userId), isNull(clubColumn))!;
}

/** Active coaches and pending invites for a club the caller owns. */
export async function listClubRoster(clubId: string) {
  const [members, invites] = await Promise.all([
    db
      .select({
        id: clubMembers.id,
        role: clubMembers.role,
        status: clubMembers.status,
        sport: clubMembers.sport,
        createdAt: clubMembers.createdAt,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(clubMembers)
      .innerJoin(users, eq(users.id, clubMembers.userId))
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.role, "coach"),
          eq(clubMembers.status, "active")
        )
      )
      .orderBy(desc(clubMembers.createdAt)),
    db
      .select()
      .from(clubInvites)
      .where(
        and(eq(clubInvites.clubId, clubId), eq(clubInvites.status, "pending"))
      )
      .orderBy(desc(clubInvites.createdAt)),
  ]);
  return { members, invites };
}
