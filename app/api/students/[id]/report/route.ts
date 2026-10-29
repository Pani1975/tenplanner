import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToStream } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { students } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { getCoachName, slugify } from "@/lib/sessions/pdf-data";
import { loadStudentReport, periodBounds } from "@/lib/students/report-data";
import { StudentReportPdf } from "@/lib/students/report-pdf";
import {
  studentIdParamsSchema,
  zodValidationErrorResponse,
} from "../../validation";

const MAX_DAYS = 400;

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD")
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), {
    message: "Fecha no válida",
  });

const querySchema = z
  .object({ from: dateParam, to: dateParam })
  .refine((v) => v.from <= v.to, {
    message: "La fecha de inicio debe ser anterior o igual a la de fin",
    path: ["to"],
  })
  .refine(
    (v) =>
      (new Date(`${v.to}T00:00:00Z`).getTime() -
        new Date(`${v.from}T00:00:00Z`).getTime()) /
        86_400_000 <=
      MAX_DAYS,
    { message: `El periodo no puede superar ${MAX_DAYS} días`, path: ["to"] }
  );

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Informe en PDF de un alumno para un periodo (p. ej. un trimestre).
 * GET /api/students/<id>/report?from=AAAA-MM-DD&to=AAAA-MM-DD
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedId = studentIdParamsSchema.safeParse(await context.params);
  if (!parsedId.success) return zodValidationErrorResponse(parsedId.error);

  const { searchParams } = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  });
  if (!parsedQuery.success)
    return zodValidationErrorResponse(parsedQuery.error);

  const studentId = parsedId.data.id;

  // Mismo acceso que la ficha: monitor propietario o miembro del club activo.
  const activeClubId = await getActiveWorkClubId(user.id);
  const [allowed] = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.id, studentId),
        sharedWithClubCondition(
          students.coachId,
          students.clubId,
          user.id,
          activeClubId
        )
      )
    )
    .limit(1);
  if (!allowed) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    const range = periodBounds(parsedQuery.data.from, parsedQuery.data.to);
    const report = await loadStudentReport(studentId, range);
    if (!report) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    const coachName = await getCoachName(user.id, user.email ?? "Entrenador");

    const element = createElement(StudentReportPdf, {
      report,
      coachName,
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await renderToStream(element);
    const buffer = await streamToBuffer(
      stream as unknown as NodeJS.ReadableStream
    );

    const filename = `informe-${slugify(report.student.name)}-${parsedQuery.data.from}_${parsedQuery.data.to}.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[students/report] render failed", { studentId, err });
    return NextResponse.json(
      { error: "No se pudo generar el informe" },
      { status: 500 }
    );
  }
}
