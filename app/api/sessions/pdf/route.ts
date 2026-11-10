import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToStream } from "@react-pdf/renderer";
import { and, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { MultiSessionPdf } from "@/lib/sessions/pdf";
import {
  buildPdfSession,
  getCoachName,
  slugify,
} from "@/lib/sessions/pdf-data";
import { zodValidationErrorResponse } from "../validation";
import { editableSessionCondition } from "@/lib/sessions/permissions";

const MAX_SESSIONS = 20;

const querySchema = z.object({
  ids: z
    .string()
    .min(1, "Debes indicar al menos un id de sesión")
    .transform((value) =>
      Array.from(
        new Set(
          value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        )
      )
    )
    .pipe(
      z
        .array(z.string().uuid("Cada id de sesión debe ser un UUID válido"))
        .min(1, "Debes indicar al menos una sesión")
        .max(MAX_SESSIONS, `Máximo ${MAX_SESSIONS} sesiones por PDF`)
    ),
});

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Genera un único PDF combinando varias sesiones (p. ej. todas las
 * sesiones de un día, o una selección de ellas). Uso:
 * GET /api/sessions/pdf?ids=<uuid1>,<uuid2>,...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ ids: searchParams.get("ids") ?? "" });
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const { ids } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Solo se incluyen sesiones del propio entrenador; cualquier id que
  // no le pertenezca (o no exista) se ignora en silencio.
  const rows = await db
    .select()
    .from(sessions)
    .where(
      and(inArray(sessions.id, ids), await editableSessionCondition(user.id))
    )
    .orderBy(asc(sessions.scheduledAt));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Sessions not found" }, { status: 404 });
  }

  const coachName = await getCoachName(user.id, user.email ?? "Entrenador");

  try {
    const sessionsData = await Promise.all(
      rows.map((row) => buildPdfSession(row, coachName))
    );

    const dateStr = sessionsData[0].scheduledAt.toISOString().split("T")[0];
    const filename =
      rows.length === 1
        ? `sesion-${slugify(rows[0].title)}-${dateStr}.pdf`
        : `sesiones-${dateStr}.pdf`;

    const element = createElement(MultiSessionPdf, {
      sessions: sessionsData,
      title:
        rows.length === 1 ? sessionsData[0].title : `Sesiones del ${dateStr}`,
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await renderToStream(element);
    const buffer = await streamToBuffer(
      stream as unknown as NodeJS.ReadableStream
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[sessions/pdf] render failed", { ids, err });
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
