// Torneos de prueba sin cuenta, guardados en el servidor (migración 0112).
//
// - Al crear se pide un correo. Se genera un enlace secreto de edición; en
//   la base solo queda su hash (sha256). Quien lo crea lo tiene ya en este
//   navegador (cookie) y lo recibe por correo para abrirlo en otro sitio.
// - Hasta abrir el enlace del correo (confirmar el correo) no hay página
//   pública ni inscripción por enlace: frena el spam y los correos falsos.
// - Se borran 30 días después del torneo (aviso una semana antes), salvo
//   que pasen a una cuenta.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm";
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

// ── Correos ────────────────────────────────────────────────────────────

const editUrl = (baseUrl: string, id: string, token: string) =>
  `${baseUrl}/probar-torneos/editar/${id}/${token}`;

export async function sendEditLink(opts: {
  baseUrl: string;
  email: string;
  tournaments: { id: string; name: string; token: string }[];
}) {
  const { baseUrl, email } = opts;
  const list = opts.tournaments;
  if (!list.length) return { sent: false };
  const first = list[0];
  const subject =
    list.length === 1
      ? `Enlace para editar «${first.name}»`
      : `Enlaces para editar tus ${list.length} torneos de prueba`;
  const lines = list.map(
    (t) => `${t.name}: ${editUrl(baseUrl, t.id, t.token)}`
  );
  const paragraphs = [
    list.length === 1
      ? `Con este enlace puedes editar el torneo «${first.name}» desde cualquier móvil u ordenador, sin crear cuenta. Al abrirlo se activa también la página de inscripción para compartir.`
      : "Con estos enlaces puedes editar tus torneos de prueba desde cualquier móvil u ordenador, sin crear cuenta.",
    ...(list.length > 1 ? lines : []),
    "No lo compartas: quien tenga el enlace puede editar el torneo. Si creas una cuenta gratis, podrás pasar el torneo a tu cuenta.",
    "El torneo de prueba se borra 30 días después de que termine.",
  ];
  const res = await sendEmail({
    to: email,
    subject,
    html: renderActionEmailHtml({
      greeting: "Tu torneo en Ten Planner",
      paragraphs,
      buttonLabel: list.length === 1 ? "Editar el torneo" : "Ver mis torneos",
      buttonUrl:
        list.length === 1
          ? editUrl(baseUrl, first.id, first.token)
          : `${baseUrl}/probar-torneos`,
      footnote:
        "Si no has creado este torneo, ignora este correo: sin abrir el enlace no se publica nada.",
    }),
    text: [...paragraphs, "", ...lines].join("\n"),
  });
  return { sent: res.sent };
}

/**
 * Abre el enlace de edición: comprueba el enlace, confirma el correo (activa
 * la página pública) y deja el torneo en este navegador.
 */
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
  await setGuestCookie(id, token);
  return true;
}

/**
 * Reenvía los enlaces de los torneos de prueba de un correo. Se generan
 * enlaces nuevos (solo guardamos el hash): los anteriores dejan de valer.
 */
export async function resendEditLinks(email: string, baseUrl: string) {
  const rows = await db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.ownerType, "guest"),
        eq(tournaments.guestEmail, email.trim().toLowerCase())
      )
    )
    .limit(20);
  if (!rows.length) return;
  const list = [];
  for (const r of rows) {
    const token = newGuestToken();
    await db
      .update(tournaments)
      .set({ guestTokenHash: sha(token) })
      .where(eq(tournaments.id, r.id));
    list.push({ ...r, token });
  }
  await sendEditLink({ baseUrl, email, tournaments: list });
}

export const hashGuestToken = sha;

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

/** Aviso una semana antes de borrar y borrado de los caducados. */
export async function expireGuestTournaments(
  baseUrl: string,
  now = new Date()
) {
  const inAWeek = new Date(now.getTime() + 7 * 86400_000);
  const toWarn = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      email: tournaments.guestEmail,
      expiresAt: tournaments.guestExpiresAt,
    })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.ownerType, "guest"),
        isNotNull(tournaments.guestVerifiedAt),
        isNull(tournaments.guestWarnedAt),
        lte(tournaments.guestExpiresAt, inAWeek)
      )
    );
  let warned = 0;
  for (const t of toWarn) {
    if (!t.email || !t.expiresAt) continue;
    const date = new Intl.DateTimeFormat("es-ES", {
      day: "numeric",
      month: "long",
      timeZone: "Europe/Madrid",
    }).format(t.expiresAt);
    const paragraphs = [
      `El torneo de prueba «${t.name}» se borrará el ${date}, junto con sus inscritos, resultados y fotos.`,
      "Si quieres conservarlo, crea una cuenta gratis en el mismo navegador donde lo editas y pásalo a tu cuenta desde «Torneos».",
    ];
    await sendEmail({
      to: t.email,
      subject: `Tu torneo de prueba «${t.name}» se borrará pronto`,
      html: renderActionEmailHtml({
        greeting: "Aviso",
        paragraphs,
        buttonLabel: "Crear cuenta gratis",
        buttonUrl: `${baseUrl}/register`,
        footnote:
          "Te escribimos porque creaste este torneo sin cuenta en Ten Planner.",
      }),
      text: [...paragraphs, "", `${baseUrl}/register`].join("\n"),
    });
    await db
      .update(tournaments)
      .set({ guestWarnedAt: now })
      .where(eq(tournaments.id, t.id));
    warned++;
  }

  // Borrado: también los que nunca se confirmaron (7 días después de crear).
  const expired = await db
    .select({ id: tournaments.id, poster: tournaments.posterImagePath })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.ownerType, "guest"),
        lt(tournaments.guestExpiresAt, now)
      )
    );
  const stale = await db
    .select({ id: tournaments.id, poster: tournaments.posterImagePath })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.ownerType, "guest"),
        isNull(tournaments.guestVerifiedAt),
        lt(tournaments.createdAt, new Date(now.getTime() - 7 * 86400_000))
      )
    );
  const doomed = [...expired, ...stale];
  if (!doomed.length) return { warned, deleted: 0 };
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
  return { warned, deleted: ids.length };
}
