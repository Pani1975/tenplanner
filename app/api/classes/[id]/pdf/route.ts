import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { ClassPdf } from "@/lib/classes/pdf";
import {
  buildPdfClass,
  getClassCoachName,
  slugify,
  streamToBuffer,
} from "@/lib/classes/pdf-data";
import { getActiveWorkClubId } from "@/lib/clubs";
import { canSeeClassDraft } from "@/lib/classes/visibility";

type RouteContext = { params: Promise<{ id: string }> };

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

  const coachName = await getClassCoachName(cls.createdBy);
  const data = await buildPdfClass(cls, coachName);

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
