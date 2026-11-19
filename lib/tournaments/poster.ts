// Cartel del torneo: plantilla, imagen propia (en tournament-media) y datos
// para el PDF. Solo el organizador.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSkillLevels } from "@/lib/skill-levels-repo";
import { formatDateRange } from "./labels";
import { levelOptions } from "./levels";
import { MEDIA_BUCKET } from "./media";
import type { PosterData, PosterTemplate } from "./poster-pdf";
import { getPublicTournament, type PublicTournament } from "./public";
import { getTournament, TournamentError, type Organizer } from "./server";

// react-pdf no lee WebP: el cartel se guarda en JPG o PNG.
export const POSTER_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export const POSTER_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export async function setPosterImage(
  o: Organizer,
  tournamentId: string,
  file: { bytes: ArrayBuffer; type: string }
) {
  const t = await getTournament(o, tournamentId);
  if (!(POSTER_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new TournamentError("poster_type", 400);
  }
  if (file.bytes.byteLength > POSTER_IMAGE_MAX_BYTES) {
    throw new TournamentError("photo_too_big", 400);
  }
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${tournamentId}/poster/${randomUUID()}.${ext}`;
  try {
    const storage = createAdminClient().storage.from(MEDIA_BUCKET);
    const { error } = await storage.upload(path, file.bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    if (t.posterImagePath) await storage.remove([t.posterImagePath]);
  } catch (e) {
    console.error("Subida del cartel", e);
    throw new TournamentError("photo_upload_failed", 502);
  }
  await db
    .update(tournaments)
    .set({
      posterImagePath: path,
      posterTemplate: "image",
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));
}

export async function removePosterImage(o: Organizer, tournamentId: string) {
  const t = await getTournament(o, tournamentId);
  if (!t.posterImagePath) return;
  await db
    .update(tournaments)
    .set({
      posterImagePath: null,
      ...(t.posterTemplate === "image" && { posterTemplate: "classic" }),
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, tournamentId));
  try {
    await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .remove([t.posterImagePath]);
  } catch (e) {
    console.error("No se pudo borrar la imagen del cartel", e);
  }
}

/** URL firmada de la imagen del cartel (para la vista previa). */
export async function posterImageUrl(o: Organizer, tournamentId: string) {
  const t = await getTournament(o, tournamentId);
  if (!t.posterImagePath) return null;
  try {
    const { data } = await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrl(t.posterImagePath, 60 * 60);
    return data?.signedUrl ?? null;
  } catch (e) {
    console.error("URL de la imagen del cartel", e);
    return null;
  }
}

async function loadImage(path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch (e) {
    console.error("Descarga de la imagen del cartel", e);
    return null;
  }
}

export type Tr = (
  key: string,
  values?: Record<string, string | number>
) => string;

/**
 * Datos del cartel. El QR lleva a la página pública si el torneo es público;
 * si es privado, a la ficha del menú Torneos de familias (con sesión).
 */
export async function buildPoster(
  o: Organizer,
  tournamentId: string,
  opts: { baseUrl: string; locale: string; tr: Tr }
): Promise<{
  data: PosterData;
  template: PosterTemplate;
  image: Buffer | null;
}> {
  const row = await getTournament(o, tournamentId);
  const t = await getPublicTournament(row.slug, {
    allowPrivate: true,
    allowDraft: true,
  });
  if (!t) throw new TournamentError("not_found", 404);
  const { data, template } = await posterData(t, opts);
  const image =
    template === "image" && t.posterImagePath
      ? await loadImage(t.posterImagePath)
      : null;
  return { data, template, image };
}

/** URL firmada de la imagen del cartel, sin comprobar organizador (página pública). */
export async function signedPosterImage(path: string | null) {
  if (!path) return null;
  try {
    const { data } = await createAdminClient()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  } catch (e) {
    console.error("URL de la imagen del cartel", e);
    return null;
  }
}

/** Cartel en PDF para un torneo ya cargado (página pública). */
export async function buildPublicPoster(
  t: PublicTournament,
  opts: { baseUrl: string; locale: string; tr: Tr }
) {
  const { data, template } = await posterData(t, opts);
  const image =
    template === "image" && t.posterImagePath
      ? await loadImage(t.posterImagePath)
      : null;
  return { data, template, image };
}

/** Textos y datos del cartel (comunes al PDF y a la vista en la web). */
export async function posterData(
  t: PublicTournament,
  opts: { baseUrl: string; locale: string; tr: Tr }
): Promise<{ data: PosterData; template: PosterTemplate }> {
  const { tr, locale } = opts;

  const levels = levelOptions(await loadSkillLevels().catch(() => []), t.sport);
  const level = t.levelCode
    ? levels.find((l) => l.code === t.levelCode)?.label
    : null;
  const path =
    t.visibility === "public"
      ? `/t/${t.slug}`
      : `/mi-familia/torneos/${t.slug}`;
  const url = `${opts.baseUrl}${path}`;

  const facts: PosterData["facts"] = [
    {
      label: tr("poster.format"),
      value: `${tr(`modality.${t.modality}`)} · ${tr(`format.${t.format}`)}`,
    },
  ];
  if (level) facts.push({ label: tr("poster.level"), value: level });
  if (t.places.length) {
    facts.push({ label: tr("poster.place"), value: t.places.join(", ") });
  }
  if (t.registrationDeadline) {
    facts.push({
      label: tr("poster.deadline"),
      value: new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: t.timeZone,
      }).format(new Date(t.registrationDeadline)),
    });
  }
  if (t.maxEntries) {
    facts.push({ label: tr("poster.spots"), value: String(t.maxEntries) });
  }
  if (t.circuit) {
    facts.push({
      label: tr("poster.circuit"),
      value: [t.circuit.name, t.circuit.season].filter(Boolean).join(" · "),
    });
  }

  const template: PosterTemplate =
    t.posterTemplate === "image" && !t.posterImagePath
      ? "classic"
      : t.posterTemplate;

  return {
    template,
    data: {
      name: t.name,
      kicker: `${tr("poster.kicker")} · ${tr(`poster.sport.${t.sport}`)}`,
      dates: formatDateRange(t.startDate, t.endDate, locale),
      facts,
      description:
        t.description && t.description.length <= 420 ? t.description : null,
      cta:
        t.visibility === "private"
          ? tr("poster.ctaPrivate")
          : t.acceptsRegistrations || t.status === "draft"
            ? tr("poster.ctaRegister")
            : tr("poster.ctaFollow"),
      url,
      urlLabel: url.replace(/^https?:\/\//, ""),
      organizer: t.organizer,
      organizedBy: tr("poster.organizedBy"),
      footer: tr("poster.footer"),
    },
  };
}
