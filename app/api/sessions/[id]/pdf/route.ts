import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/db";
import { sessionStudents, sessions, students, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId } from "@/lib/clubs";
import {
  sessionIdParamsSchema,
  zodValidationErrorResponse,
} from "../../validation";
import {
  SessionPdf,
  type PdfExercise,
  type PdfSession,
} from "@/lib/sessions/pdf";
import { loadSessionPlan } from "@/lib/sessions/plan";

type RouteContext = { params: Promise<{ id: string }> };

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "session"
  );
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const parsed = sessionIdParamsSchema.safeParse(params);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = parsed.data;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.userId !== user.id) {
    const activeClubId = session.clubId
      ? await getActiveWorkClubId(user.id)
      : null;
    if (!session.clubId || session.clubId !== activeClubId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [coachRow] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const plan = await loadSessionPlan(id, user.id);
  const blockTitles = new Map(
    plan.blocks.map((block) => [block.orderIndex, block.title])
  );

  const studentRows = await db
    .select({
      name: students.name,
      playerLevel: students.playerLevel,
    })
    .from(sessionStudents)
    .innerJoin(students, eq(sessionStudents.studentId, students.id))
    .where(eq(sessionStudents.sessionId, id));

  const data: PdfSession = {
    title: session.title,
    description: session.description,
    scheduledAt: new Date(session.scheduledAt),
    durationMinutes: session.durationMinutes,
    objective: session.objective,
    intensity: session.intensity,
    tags: session.tags,
    location: session.location,
    coachName: coachRow?.name ?? user.email ?? "Entrenador",
    material: session.material,
    observations: session.observations,
    exercises: plan.items.map((item, orderIndex) => {
      if (item.kind === "exercise") {
        return {
          kind: "exercise" as const,
          name: item.name,
          category: item.category as PdfExercise["category"],
          difficulty: item.difficulty as PdfExercise["difficulty"],
          orderIndex,
          durationMinutes: item.durationMinutes ?? item.defaultDurationMinutes,
          notes: item.notes,
          phase: item.phase,
          intensity: null,
          materials: item.materials,
          description: item.description,
          steps: item.steps,
          diagram: getExerciseDiagram(item.exerciseId),
          tips: item.tips,
          blockTitle: blockTitles.get(item.blockOrder) ?? null,
        };
      }
      if (item.kind === "warmup") {
        return {
          kind: "text" as const,
          name: "Descanso",
          category: "warm-up" as const,
          difficulty: "beginner" as const,
          orderIndex,
          durationMinutes: item.durationMinutes,
          notes: item.notes,
          phase: item.phase,
          intensity: null,
          materials: [],
          description: null,
          blockTitle: blockTitles.get(item.blockOrder) ?? null,
        };
      }
      if (item.kind === "stations") {
        const stationLines = item.stations.map(
          (station, idx) =>
            `${idx + 1}. ${station.kind === "exercise" ? (station.exerciseName ?? "Ejercicio") : (station.freeText ?? "")}`
        );
        return {
          kind: "text" as const,
          name: "Estaciones",
          category: "technique" as const,
          difficulty: "beginner" as const,
          orderIndex,
          durationMinutes: item.durationMinutes,
          notes: item.notes,
          phase: item.phase,
          intensity: null,
          materials: [],
          description: [item.introText, ...stationLines]
            .filter((v) => v && v.trim())
            .join("\n"),
          blockTitle: blockTitles.get(item.blockOrder) ?? null,
        };
      }
      return {
        kind: "text" as const,
        name: item.text,
        category: "technique" as const,
        difficulty: "beginner" as const,
        orderIndex,
        durationMinutes: item.durationMinutes,
        notes: item.notes,
        phase: item.phase,
        intensity: null,
        materials: [],
        description: item.description,
        blockTitle: blockTitles.get(item.blockOrder) ?? null,
      };
    }),
    students: studentRows,
  };

  try {
    const element = createElement(SessionPdf, {
      session: data,
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await renderToStream(element);
    const buffer = await streamToBuffer(
      stream as unknown as NodeJS.ReadableStream
    );
    const filename = `sesion-${slugify(session.title)}-${
      new Date(session.scheduledAt).toISOString().split("T")[0]
    }.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[sessions/pdf] render failed", { sessionId: id, err });
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
