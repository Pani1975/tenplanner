import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToStream } from "@react-pdf/renderer";
import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { MultiClassPdf } from "@/lib/classes/pdf";
import type { PdfClass } from "@/lib/classes/pdf";
import {
  buildPdfClass,
  getClassCoachName,
  slugify,
  streamToBuffer,
  type ClassRow,
} from "@/lib/classes/pdf-data";
import { getActiveWorkClubId } from "@/lib/clubs";
import { canSeeClassDraft } from "@/lib/classes/visibility";

// Generar muchas clases (con diagramas) puede tardar más que el límite por
// defecto de una función.
export const maxDuration = 120;

/** Igual que el máximo de clases que muestra el listado filtrado. */
const MAX_CLASSES = 60;
/** Clases que se preparan a la vez, para no saturar la base de datos. */
const BATCH_SIZE = 5;

const querySchema = z.object({
  ids: z
    .string()
    .min(1, "Debes indicar al menos una clase")
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
        .array(z.string().uuid("Cada id de clase debe ser un UUID válido"))
        .min(1, "Debes indicar al menos una clase")
        .max(MAX_CLASSES, `Máximo ${MAX_CLASSES} clases por PDF`)
    ),
});

/**
 * Genera un único PDF con varias clases (todas las de un filtrado o una
 * selección), cada una en una página nueva y en el orden de `ids`. Uso:
 * GET /api/classes/pdf?ids=<uuid1>,<uuid2>,...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ ids: searchParams.get("ids") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Petición no válida" },
      { status: 400 }
    );
  }
  const { ids } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(classes).where(inArray(classes.id, ids));

  // Mismas reglas de acceso que el PDF de una clase: biblioteca, propias o
  // compartidas por el club activo, y sin borradores ajenos. Las que no se
  // pueden ver se omiten en silencio.
  const activeClubId = await getActiveWorkClubId(user.id);
  const visible = rows.filter((cls) => {
    const allowed =
      cls.isLibrary ||
      cls.createdBy === user.id ||
      (!!cls.clubId && cls.clubId === activeClubId);
    return allowed && canSeeClassDraft(cls, user.id);
  });

  if (visible.length === 0) {
    return NextResponse.json({ error: "Classes not found" }, { status: 404 });
  }

  // Respetar el orden en que llegan los ids (el del listado).
  const position = new Map(ids.map((id, idx) => [id, idx]));
  visible.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));

  try {
    const coachCache = new Map<string, string>();
    const data: PdfClass[] = [];
    for (let i = 0; i < visible.length; i += BATCH_SIZE) {
      const batch = visible.slice(i, i + BATCH_SIZE);
      data.push(
        ...(await Promise.all(
          batch.map(async (cls: ClassRow) =>
            buildPdfClass(
              cls,
              await getClassCoachName(cls.createdBy, coachCache)
            )
          )
        ))
      );
    }

    const title =
      visible.length === 1 ? visible[0].name : `Clases (${visible.length})`;
    const filename =
      visible.length === 1
        ? `clase-${slugify(visible[0].name)}.pdf`
        : `clases-${visible.length}-${new Date().toISOString().split("T")[0]}.pdf`;

    const element = createElement(MultiClassPdf, {
      classes: data,
      title,
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
    console.error("[classes/pdf] multi render failed", { ids, err });
    return NextResponse.json(
      { error: "No se pudo generar el PDF" },
      { status: 500 }
    );
  }
}
