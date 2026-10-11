import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/db";
import { classes, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { loadClassPlan } from "@/lib/classes/plan";
import { ClassPdf, type PdfClass, type PdfExercise } from "@/lib/classes/pdf";
import { autoriaLabel } from "@/lib/exercise-taxonomy";
import { getActiveWorkClubId } from "@/lib/clubs";
import { canSeeClassDraft } from "@/lib/classes/visibility";

type RouteContext = { params: Promise<{ id: string }> };

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clase"
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
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const [cls] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);
  if (!cls) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const isOwner = !!user && cls.createdBy === user.id;
  let sharedViaClub = false;
  if (!cls.isLibrary && !isOwner && user && cls.clubId) {
    const activeClubId = await getActiveWorkClubId(user.id);
    sharedViaClub = cls.clubId === activeClubId;
  }
  if (!cls.isLibrary && !isOwner && !sharedViaClub) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSeeClassDraft(cls, user?.id)) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  let coachName = "TenPlanner";
  if (cls.createdBy) {
    const [creator] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, cls.createdBy))
      .limit(1);
    coachName = creator?.name ?? coachName;
  }

  const plan = await loadClassPlan(id);
  const blockTitles = new Map(
    plan.blocks.map((block) => [block.orderIndex, block.title])
  );

  const niveles =
    Array.isArray(cls.niveles) && cls.niveles.length > 0
      ? cls.niveles
      : cls.nivel
        ? [cls.nivel]
        : null;
  const aspectosJuego =
    Array.isArray(cls.aspectosJuego) && cls.aspectosJuego.length > 0
      ? cls.aspectosJuego
      : cls.aspectoJuego
        ? [cls.aspectoJuego]
        : null;

  const data: PdfClass = {
    name: cls.name,
    durationMinutes: cls.duracionMinutes,
    objetivos: cls.objetivos,
    material: cls.material,
    aspectosImportantes: cls.aspectosImportantes,
    alumnosTipo: cls.alumnosTipo as "individual" | "grupal" | null,
    numAlumnos: cls.numAlumnos,
    niveles,
    aspectosJuego,
    golpes: Array.isArray(cls.golpes) ? cls.golpes : null,
    autoriaLabel:
      cls.autoria && cls.autoria !== "libre" ? autoriaLabel(cls.autoria) : null,
    coachName,
    exercises: plan.items.map((item, orderIndex): PdfExercise => {
      if (item.kind === "exercise") {
        return {
          kind: "exercise",
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
          kind: "text",
          name: "Descanso",
          category: "warm-up",
          difficulty: "beginner",
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
          kind: "text",
          name: "Estaciones",
          category: "technique",
          difficulty: "beginner",
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
        kind: "text",
        name: item.text,
        category: "technique",
        difficulty: "beginner",
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
  };

  try {
    const element = createElement(ClassPdf, {
      cls: data,
    }) as unknown as ReactElement<DocumentProps>;
    const stream = await renderToStream(element);
    const buffer = await streamToBuffer(
      stream as unknown as NodeJS.ReadableStream
    );
    const filename = `clase-${slugify(cls.name)}.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[classes/pdf] render failed", { classId: id, err });
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
