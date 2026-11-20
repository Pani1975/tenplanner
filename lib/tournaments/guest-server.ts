// Torneos de prueba sin cuenta, guardados en el servidor (migraciones 0112
// y 0113). Sin correos:
// - Al crear se generan dos enlaces: uno secreto de edición (en la base solo
//   queda su hash) y el público de inscripción (/t/<slug>). El de edición
//   queda en este navegador (cookie) y se muestra en la ficha para copiarlo
//   y abrirlo en otro dispositivo. Si se pierde, no se puede recuperar.
// - Se borran 30 días después del torneo, salvo que pasen a una cuenta.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { tournamentPhotos, tournaments } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { renderActionEmailHtml } from "@/lib/email-layout";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveWorkClubId } from "@/lib/clubs";
import { MEDIA_BUCKET } from "./media";
import { GUEST_USER_ID, getOrganizer, type Organizer } from "./server";

export const GUEST_COOKIE_PREFIX = "tpg_";
/** La cookie dura hasta un año (el torneo caduca antes). */
const COOKIE_MAX_AGE = 365 * 24 * 3600;

const sha = (token: string) => createHash("sha256").update(token).digest("hex");
export const newGuestToken = () => randomBytes(24).toString("base64url");

function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Pares (torneo, enlace) que tiene este navegador. */
async function cookieTokens(): Promise<{ id: string; token: string }[]> {
  const jar = await cookies();
  return jar
    .getAll()
    .filter((c) => c.name.startsWith(GUEST_COOKIE_PREFIX))
    .map((c) => ({
      id: c.name.slice(GUEST_COOKIE_PREFIX.length),
      token: c.value,
    }))
    .filter((c) => UUID.test(c.id) && c.token.length >= 20)
    .slice(0, 30);
}

/** Torneos de prueba de este navegador cuyo enlace sigue siendo válido. */
export async function guestTournamentIds(): Promise<string[]> {
  const pairs = await cookieTokens();
  if (!pairs.length) return [];
  const rows = await db
    .select({ id: tournaments.id, hash: tournaments.guestTokenHash })
    .from(tournaments)
    .where(
      and(
        inArray(
          tournaments.id,
          pairs.map((p) => p.id)
        ),
        eq(tournaments.ownerType, "guest")
      )
    );
  const byId = new Map(rows.map((r) => [r.id, r.hash]));
  return pairs
    .filter((p) => {
      const h = byId.get(p.id);
      return !!h && sameHash(h, sha(p.token));
    })
    .map((p) => p.id);
}

/** Organizador del modo prueba (sin sesión), limitado a sus torneos. */
export async function guestOrganizer(
  create?: NonNullable<Organizer["guest"]>["create"]
): Promise<Organizer> {
  return {
    userId: GUEST_USER_ID,
    clubId: null,
    sport: "tenis",
    canSeeContacts: true,
    guest: { tournamentIds: await guestTournamentIds(), create },
  };
}

/** Con sesión: la cuenta. Sin sesión: el modo prueba (si hay torneos). */
export async function organizerFor(userId: string | null) {
  if (userId) return getOrganizer(userId);
  return guestOrganizer();
}

export async function setGuestCookie(id: string, token: string) {
  const jar = await cookies();
  jar.set(`${GUEST_COOKIE_PREFIX}${id}`, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearGuestCookie(id: string) {
  const jar = await cookies();
  jar.delete(`${GUEST_COOKIE_PREFIX}${id}`);
}

/** Enlace de edición de un torneo (para mostrarlo y copiarlo). */
export const guestEditUrl = (baseUrl: string, id: string, token: string) =>
  `${baseUrl}/probar-torneos/editar/${id}/${token}`;

/** Enlace de edición que guarda este navegador para ese torneo. */
export async function guestEditToken(id: string): Promise<string | null> {
  const pair = (await cookieTokens()).find((p) => p.id === id);
  return pair?.token ?? null;
}

/** Abre el enlace de edición: lo comprueba y deja el torneo en este navegador. */
export async function openEditLink(id: string, token: string) {
  if (!UUID.test(id)) return false;
  const [t] = await db
    .select({
      hash: tournaments.guestTokenHash,
      verifiedAt: tournaments.guestVerifiedAt,
    })
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.ownerType, "guest")))
    .limit(1);
  if (!t?.hash || !sameHash(t.hash, sha(token))) return false;
  if (!t.verifiedAt) {
    await db
      .update(tournaments)
      .set({ guestVerifiedAt: new Date() })
      .where(eq(tournaments.id, id));
  }
  // Un circuito comparte enlace: se abren todos sus torneos.
  const same = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.ownerType, "guest"),
        eq(tournaments.guestTokenHash, t.hash)
      )
    )
    .limit(30);
  for (const s of same) await setGuestCookie(s.id, token);
  return true;
}

export const hashGuestToken = sha;

/**
 * Envío opcional del enlace de edición por correo (casilla al crear). El
 * correo no se guarda. Devuelve si el servicio de correo lo aceptó.
 */
export async function sendEditLinkEmail(opts: {
  to: string;
  name: string;
  editUrl: string;
  publicUrl: string | null;
  circuitUrl: string | null;
}) {
  const paragraphs = [
    `Este es el enlace para editar «${opts.name}» desde cualquier móvil u ordenador, sin crear cuenta:`,
    opts.editUrl,
    "No lo compartas: quien lo tenga puede editar el torneo. Si lo pierdes, no se puede recuperar.",
    ...(opts.publicUrl
      ? [`Enlace público de inscripción: ${opts.publicUrl}`]
      : []),
    ...(opts.circuitUrl
      ? [`Clasificación del circuito: ${opts.circuitUrl}`]
      : []),
    "Los torneos de prueba se borran 30 días después de terminar.",
  ];
  const res = await sendEmail({
    to: opts.to,
    subject: `Enlace de edición de «${opts.name}»`,
    html: renderActionEmailHtml({
      greeting: "Tu torneo en Ten Planner",
      paragraphs,
      buttonLabel: "Editar el torneo",
      buttonUrl: opts.editUrl,
      footnote:
        "Te llega porque marcaste «Enviarme el enlace por correo» al crear el torneo.",
    }),
    text: paragraphs.join("\n\n"),
  });
  return res.sent;
}

// ── Pasar a una cuenta ─────────────────────────────────────────────────

/**
 * Pasa a la cuenta (club activo o propia) los torneos de prueba de este
 * navegador. Dejan de caducar.
 */
export async function claimGuestTournaments(userId: string) {
  const ids = await guestTournamentIds();
  if (!ids.length) return 0;
  const clubId = await getActiveWorkClubId(userId);
  const rows = await db
    .update(tournaments)
    .set({
      ownerType: clubId ? "club" : "coach",
      clubId,
      coachId: clubId ? null : userId,
      createdBy: userId,
      guestEmail: null,
      guestName: null,
      guestTokenHash: null,
      guestVerifiedAt: null,
      guestExpiresAt: null,
      guestWarnedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(inArray(tournaments.id, ids), eq(tournaments.ownerType, "guest"))
    )
    .returning({ id: tournaments.id });
  for (const r of rows) await clearGuestCookie(r.id);
  return rows.length;
}

// ── Caducidad (cron diario) ────────────────────────────────────────────

/** Borra los torneos de prueba caducados (30 días después del torneo). */
export async function expireGuestTournaments(now = new Date()) {
  const doomed = await db
    .select({ id: tournaments.id, poster: tournaments.posterImagePath })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.ownerType, "guest"),
        lt(tournaments.guestExpiresAt, now)
      )
    );
  if (!doomed.length) return { deleted: 0 };
  const ids = [...new Set(doomed.map((d) => d.id))];
  const photos = await db
    .select({ path: tournamentPhotos.storagePath })
    .from(tournamentPhotos)
    .where(inArray(tournamentPhotos.tournamentId, ids));
  const paths = [
    ...photos.map((p) => p.path),
    ...doomed.map((d) => d.poster).filter((p): p is string => !!p),
  ];
  if (paths.length) {
    try {
      await createAdminClient().storage.from(MEDIA_BUCKET).remove(paths);
    } catch (e) {
      console.error("[torneos de prueba] borrar archivos", e);
    }
  }
  // Inscritos, partidos, noticias y fotos se borran en cascada.
  await db.delete(tournaments).where(inArray(tournaments.id, ids));
  return { deleted: ids.length };
}
