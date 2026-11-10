import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToStream } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clubs, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import { parseReportRange } from "@/lib/club-reports";
import { blocksFor, parseMetricParam } from "@/lib/club-report/catalog";
import { loadClubReportData } from "@/lib/club-report/data";
import { ClubReportPdf } from "@/lib/club-report/pdf";
import { getReportTemplate } from "@/lib/club-report/templates";
import { buildMetricViews } from "@/lib/club-report/views";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "informe"
  );
}

/**
 * GET /api/gestion/informe/pdf?periodo=&desde=&hasta=&metricas=a,b|plantilla=<id>
 * Informe de gestión del club (solo la cuenta del club). Con `plantilla`,
 * los datos de esa plantilla; si no, los de `metricas` (sin nada, todos).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clubId = await getClubAccountClubId(user.id);
  if (!clubId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const range = parseReportRange({
    periodo: params.get("periodo"),
    desde: params.get("desde"),
    hasta: params.get("hasta"),
  });

  let metrics = parseMetricParam(params.get("metricas"));
  let reportTitle = "Informe de gestión";
  const templateId = params.get("plantilla");
  if (templateId) {
    const template = z.string().uuid().safeParse(templateId).success
      ? await getReportTemplate(clubId, templateId)
      : null;
    if (!template) {
      return NextResponse.json(
        { error: "Plantilla no encontrada" },
        { status: 404 }
      );
    }
    metrics = template.metrics;
    reportTitle = template.name;
  }

  try {
    const [[club], [me], data] = await Promise.all([
      db
        .select({ name: clubs.name })
        .from(clubs)
        .where(eq(clubs.id, clubId))
        .limit(1),
      db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1),
      loadClubReportData(clubId, range),
    ]);
    const element = createElement(ClubReportPdf, {
      clubName: club?.name ?? "Club",
      reportTitle,
      periodLabel: range.label,
      authorName: me?.name ?? user.email ?? "Gestor",
      generatedAt: new Date(),
      blocks: blocksFor(metrics),
      views: buildMetricViews(data, metrics),
    }) as ReactElement<DocumentProps>;
    const buffer = await streamToBuffer(await renderToStream(element));
    const filename = `${slug(reportTitle)}-${slug(range.label)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[club report pdf] failed", err);
    return NextResponse.json(
      { error: "No se pudo generar el informe" },
      { status: 500 }
    );
  }
}
