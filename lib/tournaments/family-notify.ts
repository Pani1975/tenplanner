// Aviso por correo a las familias (o al jugador adulto) con cuenta cuando a
// su jugador le inscriben sin consentimiento. Si el correo no está
// configurado o falla, no pasa nada: el aviso también está en su menú.

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  studentGuardians,
  students,
  tournamentEntries,
  tournaments,
  users,
} from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { consentRequestEmail } from "./emails";

export async function notifyGuardiansConsentNeeded(
  tournamentId: string,
  studentIds: string[],
  siteUrl: string
): Promise<number> {
  if (!studentIds.length) return 0;
  const [t] = await db
    .select({
      name: tournaments.name,
      slug: tournaments.slug,
      clubId: tournaments.clubId,
      coachId: tournaments.coachId,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!t) return 0;
  const [org] = t.clubId
    ? await db
        .select({ name: clubs.name })
        .from(clubs)
        .where(eq(clubs.id, t.clubId))
        .limit(1)
    : await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, t.coachId!))
        .limit(1);

  const rows = await db
    .select({
      studentName: students.firstName,
      studentFull: students.name,
      guardianEmail: studentGuardians.email,
      userEmail: users.email,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .innerJoin(users, eq(users.id, studentGuardians.userId))
    .where(
      and(
        inArray(studentGuardians.studentId, studentIds),
        isNull(studentGuardians.revokedAt),
        isNotNull(studentGuardians.userId)
      )
    );

  let sent = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const to = (r.userEmail || r.guardianEmail || "").trim().toLowerCase();
    const player = r.studentName?.trim() || r.studentFull.split(" ")[0];
    const key = `${to}|${player}`;
    if (!to || seen.has(key)) continue;
    seen.add(key);
    const mail = consentRequestEmail({
      playerName: player,
      tournamentName: t.name,
      organizer: org?.name ?? null,
      url: `${siteUrl}/mi-familia/torneos/${t.slug}`,
    });
    const res = await sendEmail({ to, ...mail });
    if (res.sent) sent += 1;
  }
  return sent;
}

/** Alumnos con el consentimiento pendiente en un torneo (jugador o pareja). */
export async function pendingConsentStudentIds(
  tournamentId: string
): Promise<string[]> {
  const rows = await db
    .select({
      studentId: tournamentEntries.studentId,
      partnerStudentId: tournamentEntries.partnerStudentId,
      consentAt: tournamentEntries.consentAt,
      partnerConsentAt: tournamentEntries.partnerConsentAt,
    })
    .from(tournamentEntries)
    .where(
      and(
        eq(tournamentEntries.tournamentId, tournamentId),
        inArray(tournamentEntries.status, ["pending", "waitlist"])
      )
    );
  return rows.flatMap((r) =>
    [
      !r.consentAt ? r.studentId : null,
      !r.partnerConsentAt ? r.partnerStudentId : null,
    ].filter((x): x is string => !!x)
  );
}
