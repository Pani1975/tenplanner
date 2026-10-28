import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToStream } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { clubs, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId, getClubMembersDirectory } from "@/lib/clubs";
import { loadStudentsStats } from "@/lib/students/load-stats";
import { StudentsStatsPdf } from "@/lib/students/stats-pdf";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * GET /api/students/stats/pdf[?monitor=<id>]: informe estadístico de la
 * cartera de alumnos (los propios y los compartidos con el club activo).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeClubId = await getActiveWorkClubId(user.id);
  const clubMembers = activeClubId
    ? await getClubMembersDirectory([activeClubId])
    : [];
  const requestedMonitor = new URL(request.url).searchParams.get("monitor");
  const monitor = requestedMonitor
    ? (clubMembers.find((m) => m.id === requestedMonitor) ?? null)
    : null;

  const [stats, club, me] = await Promise.all([
    loadStudentsStats({
      userId: user.id,
      activeClubId,
      monitorFilter: monitor?.id ?? null,
    }),
    activeClubId
      ? db
          .select({ name: clubs.name })
          .from(clubs)
          .where(eq(clubs.id, activeClubId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const baseLabel = club?.name ?? "Mis alumnos";
  const scopeLabel = monitor
    ? `${baseLabel} · ${monitor.id === user.id ? "mis alumnos" : monitor.name}`
    : baseLabel;

  try {
    const element = createElement(StudentsStatsPdf, {
      scopeLabel,
      coachName: me?.name ?? user.email ?? "Entrenador",
      generatedAt: new Date(),
      stats,
    }) as ReactElement<DocumentProps>;
    const buffer = await streamToBuffer(await renderToStream(element));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="informe-alumnos.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[students stats pdf] render failed", err);
    return NextResponse.json(
      { error: "No se pudo generar el informe" },
      { status: 500 }
    );
  }
}
