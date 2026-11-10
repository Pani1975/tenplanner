import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToStream } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { clubs, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import { loadClubReport, parseReportRange } from "@/lib/club-reports";
import {
  loadClubDetailReport,
  parseReportSections,
} from "@/lib/club-report-detail";
import { ClubReportPdf } from "@/lib/club-report-pdf";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * GET /api/gestion/informe/pdf?periodo=&desde=&hasta=&secciones=a,b,c
 * Informe de gestión del club (solo la cuenta del club) con las secciones
 * elegidas; sin `secciones`, todas.
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
  const sections = parseReportSections(params.get("secciones"));

  const [[club], [me], base, detail] = await Promise.all([
    db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, clubId)).limit(1),
    db.select({ name: users.name }).from(users).where(eq(users.id, user.id)).limit(1),
    loadClubReport(clubId, range),
    loadClubDetailReport(clubId, range),
  ]);

  try {
    const element = createElement(ClubReportPdf, {
      clubName: club?.name ?? "Club",
      periodLabel: range.label,
      coachName: me?.name ?? user.email ?? "Gestor",
      generatedAt: new Date(),
      sections,
      base,
      detail,
    }) as ReactElement<DocumentProps>;
    const buffer = await streamToBuffer(await renderToStream(element));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="informe-gestion.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[club report pdf] render failed", err);
    return NextResponse.json(
      { error: "No se pudo generar el informe" },
      { status: 500 }
    );
  }
}
