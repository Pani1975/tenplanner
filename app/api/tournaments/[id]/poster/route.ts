import { createElement, type ReactElement } from "react";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteUrl } from "@/lib/email";
import { streamToBuffer } from "@/lib/classes/pdf-data";
import { checkIds, withOrganizer } from "@/lib/tournaments/api";
import { buildPoster } from "@/lib/tournaments/poster";
import { PosterPdf } from "@/lib/tournaments/poster-pdf";
import { slugBase } from "@/lib/tournaments/slug";

type Ctx = { params: Promise<{ id: string }> };

// Cartel en PDF (A4) con la plantilla guardada y el QR del torneo.
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const [tr, locale] = await Promise.all([
      getTranslations("tournaments"),
      getLocale(),
    ]);
    const poster = await buildPoster(o, id, {
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
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="cartel-${slugBase(poster.data.name) || "torneo"}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
