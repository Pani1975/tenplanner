// Noticias y fotos del torneo. Gestión solo del organizador; la parte de
// lectura (publicadas) la usan la página pública y el menú de familias.
// Fotos en el bucket privado tournament-media, con URLs firmadas.

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  students,
  tournamentEntries,
  tournamentNews,
  tournamentPhotos,
  tournamentPhotoTags,
  tournaments,
  users,
} from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { imageConsentStatus, type ImageConsentStatus } from "./image-consent";
import { getTournament, TournamentError, type Organizer } from "./server";

export const MEDIA_BUCKET = "tournament-media";
const SIGNED_URL_SECONDS = 60 * 60;
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// ── Noticias ───────────────────────────────────────────────────────────

/** Autor: el club si escribe su cuenta (administrador), si no el monitor. */
export async function newsAuthor(o: Organizer, tournamentId?: string) {
  // Modo prueba: el nombre que dio quien organiza (o «Organización»).
  if (o.guest && tournamentId) {
    const [t] = await db
      .select({ name: tournaments.guestName })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    return {
      authorType: "organizer" as const,
      authorName: t?.name || "Organización",
    };
  }
  if (o.clubId && o.canSeeContacts) {
    const [c] = await db
      .select({ name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, o.clubId))
      .limit(1);
    if (c) return { authorType: "club" as const, authorName: c.name };
  }
  const [u] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, o.userId))
    .limit(1);
  return { authorType: "organizer" as const, authorName: u?.name ?? "" };
}

export async function listNews(o: Organizer, tournamentId: string) {
  await getTournament(o, tournamentId);
  return db
    .select()
    .from(tournamentNews)
    .where(eq(tournamentNews.tournamentId, tournamentId))
    .orderBy(desc(tournamentNews.createdAt));
}

export async function createNews(
  o: Organizer,
  tournamentId: string,
  input: { title: string; body: string; publish: boolean }
) {
  await getTournament(o, tournamentId);
  const author = await newsAuthor(o, tournamentId);
  const [row] = await db
    .insert(tournamentNews)
    .values({
      tournamentId,
      ...author,
      authorUserId: o.userId,
      title: input.title,
      body: input.body,
      publishedAt: input.publish ? new Date() : null,
    })
    .returning();
  return row;
}

export async function updateNews(
  o: Organizer,
  tournamentId: string,
  newsId: string,
  input: { title?: string; body?: string; published?: boolean }
) {
  await getTournament(o, tournamentId);
  const [current] = await db
    .select()
    .from(tournamentNews)
    .where(
      and(
        eq(tournamentNews.id, newsId),
        eq(tournamentNews.tournamentId, tournamentId)
      )
    )
    .limit(1);
  if (!current) throw new TournamentError("not_found", 404);
  const [row] = await db
    .update(tournamentNews)
    .set({
      updatedAt: new Date(),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.published !== undefined && {
        publishedAt: input.published
          ? (current.publishedAt ?? new Date())
          : null,
      }),
    })
    .where(eq(tournamentNews.id, newsId))
    .returning();
  return row;
}

export async function deleteNews(
  o: Organizer,
  tournamentId: string,
  newsId: string
) {
  await getTournament(o, tournamentId);
  await db
    .delete(tournamentNews)
    .where(
      and(
        eq(tournamentNews.id, newsId),
        eq(tournamentNews.tournamentId, tournamentId)
      )
    );
}

/** Noticias publicadas (para la página pública y las familias). */
export async function publishedNews(tournamentId: string) {
  return db
    .select({
      id: tournamentNews.id,
      title: tournamentNews.title,
      body: tournamentNews.body,
      authorType: tournamentNews.authorType,
      authorName: tournamentNews.authorName,
      publishedAt: tournamentNews.publishedAt,
    })
    .from(tournamentNews)
    .where(
      and(
        eq(tournamentNews.tournamentId, tournamentId),
        isNotNull(tournamentNews.publishedAt)
      )
    )
    .orderBy(desc(tournamentNews.publishedAt));
}

// ── Fotos ──────────────────────────────────────────────────────────────

async function signUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return out;
  try {
    const { data } = await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrls(unique, SIGNED_URL_SECONDS);
    for (const r of data ?? []) {
      if (r.path && r.signedUrl) out.set(r.path, r.signedUrl);
    }
  } catch (e) {
    console.error("No se pudieron firmar las URLs de fotos", e);
  }
  return out;
}

export type TaggablePerson = {
  entryId: string;
  side: "player" | "partner";
  name: string;
  image: ImageConsentStatus;
};

/** Personas que se pueden etiquetar (inscripciones no canceladas). */
export async function taggablePeople(
  tournamentId: string
): Promise<TaggablePerson[]> {
  const entries = await db
    .select()
    .from(tournamentEntries)
    .where(eq(tournamentEntries.tournamentId, tournamentId))
    .orderBy(asc(tournamentEntries.createdAt));
  const live = entries.filter((e) => e.status !== "cancelled");
  const ids = [
    ...new Set(
      live.flatMap((e) =>
        [e.studentId, e.partnerStudentId].filter((x): x is string => !!x)
      )
    ),
  ];
  const consent = new Map(
    ids.length
      ? (
          await db
            .select({ id: students.id, c: students.imageConsent })
            .from(students)
            .where(inArray(students.id, ids))
        ).map((r) => [r.id, r.c] as const)
      : []
  );
  const full = (f: string, l: string | null) =>
    [f, l].filter(Boolean).join(" ");
  return live.flatMap((e) => {
    const people: TaggablePerson[] = [
      {
        entryId: e.id,
        side: "player",
        name: full(e.firstName, e.lastName),
        image: imageConsentStatus({
          isStudent: !!e.studentId,
          studentConsent: e.studentId ? consent.get(e.studentId) : null,
          entryConsentAt: e.imageConsentAt,
        }),
      },
    ];
    if (e.partnerFirstName) {
      people.push({
        entryId: e.id,
        side: "partner",
        name: full(e.partnerFirstName, e.partnerLastName),
        image: imageConsentStatus({
          isStudent: !!e.partnerStudentId,
          studentConsent: e.partnerStudentId
            ? consent.get(e.partnerStudentId)
            : null,
          entryConsentAt: e.partnerImageConsentAt,
        }),
      });
    }
    return people;
  });
}

const tagKey = (entryId: string, side: string) => `${entryId}:${side}`;

export async function listPhotos(o: Organizer, tournamentId: string) {
  await getTournament(o, tournamentId);
  const [photos, people] = await Promise.all([
    db
      .select()
      .from(tournamentPhotos)
      .where(eq(tournamentPhotos.tournamentId, tournamentId))
      .orderBy(desc(tournamentPhotos.createdAt)),
    taggablePeople(tournamentId),
  ]);
  const tags = photos.length
    ? await db
        .select()
        .from(tournamentPhotoTags)
        .where(
          inArray(
            tournamentPhotoTags.photoId,
            photos.map((p) => p.id)
          )
        )
    : [];
  const urls = await signUrls(photos.map((p) => p.storagePath));
  const byKey = new Map(people.map((p) => [tagKey(p.entryId, p.side), p]));
  return {
    people,
    photos: photos.map((p) => ({
      id: p.id,
      url: urls.get(p.storagePath) ?? null,
      caption: p.caption,
      published: p.published,
      tags: tags
        .filter((t) => t.photoId === p.id)
        .map((t) => byKey.get(tagKey(t.entryId, t.side)))
        .filter((x): x is TaggablePerson => !!x),
    })),
  };
}

export async function uploadPhoto(
  o: Organizer,
  tournamentId: string,
  file: { bytes: ArrayBuffer; type: string; width?: number; height?: number },
  caption: string | null
) {
  await getTournament(o, tournamentId);
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    throw new TournamentError("photo_type", 400);
  }
  if (file.bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new TournamentError("photo_too_big", 400);
  }
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/jpeg"
        ? "jpg"
        : "webp";
  const path = `${tournamentId}/photos/${randomUUID()}.${ext}`;
  try {
    const { error } = await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .upload(path, file.bytes, { contentType: file.type, upsert: false });
    if (error) throw error;
  } catch (e) {
    console.error("Subida de foto", e);
    throw new TournamentError("photo_upload_failed", 502);
  }
  const [row] = await db
    .insert(tournamentPhotos)
    .values({
      tournamentId,
      storagePath: path,
      caption,
      width: file.width ?? null,
      height: file.height ?? null,
      uploadedBy: o.userId,
    })
    .returning({ id: tournamentPhotos.id });
  return row;
}

async function getPhoto(tournamentId: string, photoId: string) {
  const [p] = await db
    .select()
    .from(tournamentPhotos)
    .where(
      and(
        eq(tournamentPhotos.id, photoId),
        eq(tournamentPhotos.tournamentId, tournamentId)
      )
    )
    .limit(1);
  if (!p) throw new TournamentError("not_found", 404);
  return p;
}

/**
 * Cambiar pie, etiquetas o publicación. Al publicar con personas sin
 * autorización de imagen se devuelve un aviso (409) con sus nombres, salvo
 * que el organizador ya lo haya visto (acknowledged). No se bloquea.
 */
export async function updatePhoto(
  o: Organizer,
  tournamentId: string,
  photoId: string,
  input: {
    caption?: string | null;
    tags?: { entryId: string; side: "player" | "partner" }[];
    published?: boolean;
    acknowledged?: boolean;
  }
) {
  await getTournament(o, tournamentId);
  await getPhoto(tournamentId, photoId);
  const people = await taggablePeople(tournamentId);
  const byKey = new Map(people.map((p) => [tagKey(p.entryId, p.side), p]));

  if (input.tags) {
    const valid = input.tags.filter((t) =>
      byKey.has(tagKey(t.entryId, t.side))
    );
    if (valid.length !== input.tags.length) {
      throw new TournamentError("invalid_tags", 400);
    }
    await db.transaction(async (tx) => {
      await tx
        .delete(tournamentPhotoTags)
        .where(eq(tournamentPhotoTags.photoId, photoId));
      if (valid.length) {
        await tx
          .insert(tournamentPhotoTags)
          .values(valid.map((t) => ({ photoId, ...t })))
          .onConflictDoNothing();
      }
    });
  }

  if (input.published && !input.acknowledged) {
    const current = await db
      .select()
      .from(tournamentPhotoTags)
      .where(eq(tournamentPhotoTags.photoId, photoId));
    const missing = current
      .map((t) => byKey.get(tagKey(t.entryId, t.side)))
      .filter((p): p is TaggablePerson => !!p && p.image !== "yes");
    if (missing.length) {
      throw new TournamentError("image_consent_missing", 409, {
        people: missing.map((p) => ({ name: p.name, image: p.image })),
      });
    }
  }

  if (input.caption === undefined && input.published === undefined) return;
  await db
    .update(tournamentPhotos)
    .set({
      ...(input.caption !== undefined && { caption: input.caption }),
      ...(input.published !== undefined && { published: input.published }),
      updatedAt: new Date(),
    })
    .where(eq(tournamentPhotos.id, photoId));
}

export async function deletePhoto(
  o: Organizer,
  tournamentId: string,
  photoId: string
) {
  await getTournament(o, tournamentId);
  const p = await getPhoto(tournamentId, photoId);
  await db.delete(tournamentPhotos).where(eq(tournamentPhotos.id, photoId));
  try {
    await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .remove([p.storagePath]);
  } catch (e) {
    console.error("No se pudo borrar el archivo de la foto", e);
  }
}

/** Fotos publicadas, con URL firmada; sin etiquetas (no se muestran fuera). */
export async function publishedPhotos(tournamentId: string) {
  const rows = await db
    .select({
      id: tournamentPhotos.id,
      path: tournamentPhotos.storagePath,
      caption: tournamentPhotos.caption,
      width: tournamentPhotos.width,
      height: tournamentPhotos.height,
    })
    .from(tournamentPhotos)
    .where(
      and(
        eq(tournamentPhotos.tournamentId, tournamentId),
        eq(tournamentPhotos.published, true)
      )
    )
    .orderBy(desc(tournamentPhotos.createdAt));
  const urls = await signUrls(rows.map((r) => r.path));
  return rows
    .map((r) => ({
      id: r.id,
      url: urls.get(r.path) ?? null,
      caption: r.caption,
      width: r.width,
      height: r.height,
    }))
    .filter((r) => r.url);
}
