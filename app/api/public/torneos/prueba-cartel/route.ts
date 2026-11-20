import { createElement, type ReactElement } from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { getSiteUrl } from "@/lib/email";
import { streamToBuffer } from "@/lib/classes/pdf-data";
import {
  getClientIp,
  rateLimit,
  tooManyRequestsResponse,
} from "@/lib/rate-limit";
import { posterData } from "@/lib/tournaments/poster";
import { PosterPdf } from "@/lib/tournaments/poster-pdf";
import type { PublicTournament } from "@/lib/tournaments/public";
import { TOURNAMENT_TIME_ZONES } from "@/lib/tournaments/schedule";
import { slugBase } from "@/lib/tournaments/slug";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Imagen propia del cartel: JPG o PNG en data URL (react-pdf no lee WebP).
const IMAGE = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const schema = z.object({
  name: z.string().trim().min(3).max(160),
  sport: z.enum(["tenis", "padel", "pickleball"]),
  modality: z.enum(["singles", "doubles"]),
  format: z.enum(["knockout", "round_robin"]),
  levelCode: z.string().max(32).nullable().optional(),
  startDate: date,
  endDate: date.nullable().optional(),
  registrationDeadline: z.string().datetime({ offset: true }).nullable().optional(),
  maxEntries: z.number().int().min(2).max(256).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  timeZone: z.enum(TOURNAMENT_TIME_ZONES).default("Europe/Madrid"),
  template: z.enum(["classic", "court", "image"]),
  image: z.string().max(6 * 1024 * 1024).nullable().optional(),
});

// Cartel en PDF de un torneo de prueba (sin cuenta). Los datos llegan del
// navegador y no se guardan: se devuelve el PDF y nada más.
export async function POST(request: Request) {
  const limit = await rateLimit(
    `guest-poster:${getClientIp(request.headers)}`,
    20,
    60 * 60_000
  );
  if (!limit.ok) return tooManyRequestsResponse(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const d = parsed.data;
  let image: Buffer | null = null;
  if (d.template === "image" && d.image) {
    const m = IMAGE.exec(d.image);
    if (!m) {
      return NextResponse.json({ error: "poster_type" }, { status: 400 });
    }
    image = Buffer.from(m[2], "base64");
    if (image.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "photo_too_big" }, { status: 400 });
    }
  }

  const [tr, locale] = await Promise.all([
    getTranslations("tournaments"),
    getLocale(),
  ]);
  const baseUrl = getSiteUrl(request.url);
  // Lo que usa posterData de un torneo público.
  const t = {
    name: d.name,
    slug: "",
    sport: d.sport,
    modality: d.modality,
    format: d.format,
    levelCode: d.levelCode ?? null,
    startDate: d.startDate,
    endDate: d.endDate ?? null,
    registrationDeadline: d.registrationDeadline ?? null,
    maxEntries: d.maxEntries ?? null,
    description: d.description ?? null,
    timeZone: d.timeZone,
    visibility: "public",
    places: [],
    circuit: null,
    posterTemplate: d.template,
    posterImagePath: image ? "prueba" : null,
    // Sin inscripción por enlace: el cartel invita a seguir el torneo.
    acceptsRegistrations: false,
    status: "in_progress",
    organizer: null,
  } as unknown as PublicTournament;
  const { data, template } = await posterData(t, {
    baseUrl,
    locale,
    tr: (k, v) => tr(k as never, v as never),
  });
  // Sin página pública: el QR lleva a Ten Planner.
  const url = baseUrl;
  const element = createElement(PosterPdf, {
    d: { ...data, url, urlLabel: url.replace(/^https?:\/\//, "") },
    template,
    image,
  }) as unknown as ReactElement<DocumentProps>;
  const buffer = await streamToBuffer(
    (await renderToStream(element)) as unknown as NodeJS.ReadableStream
  );
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="cartel-${slugBase(d.name) || "torneo"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
