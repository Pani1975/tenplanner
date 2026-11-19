import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteUrl } from "@/lib/email";
import { streamToBuffer } from "@/lib/classes/pdf-data";
import { buildPublicPoster } from "@/lib/tournaments/poster";
import { PosterPdf } from "@/lib/tournaments/poster-pdf";
import { getPublicTournament } from "@/lib/tournaments/public";
import { slugBase } from "@/lib/tournaments/slug";

type Ctx = { params: Promise<{ slug: string }> };
const SLUG = /^[a-z0-9-]{3,80}$/;

// Cartel en PDF de un torneo público (sin sesión). Los privados y los
// borradores no tienen cartel público.
export async function GET(request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const t = SLUG.test(slug) ? await getPublicTournament(slug) : null;
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [tr, locale] = await Promise.all([
    getTranslations("tournaments"),
    getLocale(),
  ]);
  try {
    const poster = await buildPublicPoster(t, {
      baseUrl: getSiteUrl(request.url),
      locale,
      tr: (k, v) => tr(k as never, v as never),
    });
    const element = createElement(PosterPdf, {
      d: poster.data,
      template: poster.template,
      image: poster.image,
    }) as unknown as ReactElement<DocumentProps>;
    const buffer = await streamToBuffer(
      (await renderToStream(element)) as unknown as NodeJS.ReadableStream
    );
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="cartel-${slugBase(t.name) || "torneo"}.pdf"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("[torneos] cartel público", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
