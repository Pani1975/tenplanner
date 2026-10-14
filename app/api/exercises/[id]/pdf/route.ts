import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import { ExerciseListPdf, type PdfExercise } from "@/lib/exercises/pdf";

type RouteContext = { params: Promise<{ id: string }> };

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "ejercicio"
  );
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// PDF de un único ejercicio. Mismas reglas de acceso que la ficha pública
// (app/(public)/exercises/[id]/page.tsx): global, sin dueño, o propio.
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const [exercise] = await db
    .select()
    .from(exercises)
    .where(eq(exercises.id, id))
    .limit(1);
  if (!exercise) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  const canAccess =
    exercise.isGlobal ||
    exercise.createdBy === null ||
    exercise.createdBy === user?.id;
  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pdfExercise: PdfExercise = {
    kind: "exercise",
    name: exercise.name,
    category: exercise.category as PdfExercise["category"],
    difficulty: exercise.difficulty as PdfExercise["difficulty"],
    orderIndex: 0,
    durationMinutes: exercise.durationMinutes,
    notes: null,
    phase: null,
    intensity: null,
    materials: exercise.materials as string[] | null,
    description: exercise.description,
    steps: exercise.steps as PdfExercise["steps"],
    tips: exercise.tips,
    blockTitle: null,
    diagram: getExerciseDiagram(exercise.id),
  };

  try {
    const element = createElement(ExerciseListPdf, {
      list: {
        title: exercise.name,
        filtersSummary: null,
        total: 1,
        truncated: false,
        exercises: [pdfExercise],
      },
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await renderToStream(element);
    const buffer = await streamToBuffer(
      stream as unknown as NodeJS.ReadableStream
    );
    const filename = `ejercicio-${slugify(exercise.name)}.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[exercises/pdf] render failed", { exerciseId: id, err });
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
