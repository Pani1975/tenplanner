import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import {
  deleteReportTemplate,
  templateUpdateSchema,
  updateReportTemplate,
} from "@/lib/club-report/templates";

type Context = { params: Promise<{ id: string }> };

async function resolve(context: Context) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  const clubId = await getClubAccountClubId(user.id);
  if (!clubId)
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return { clubId, id };
}

/** PATCH /api/gestion/plantillas/:id { name?, metrics? } */
export async function PATCH(request: Request, context: Context) {
  const r = await resolve(context);
  if ("error" in r) return r.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = templateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(". ") },
      { status: 400 }
    );
  }
  try {
    const updated = await updateReportTemplate(r.clubId, r.id, parsed.data);
    if (!updated)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[report templates] update failed", err);
    return NextResponse.json(
      { error: "No se pudo guardar la plantilla" },
      { status: 500 }
    );
  }
}

/** DELETE /api/gestion/plantillas/:id */
export async function DELETE(_request: Request, context: Context) {
  const r = await resolve(context);
  if ("error" in r) return r.error;
  try {
    const ok = await deleteReportTemplate(r.clubId, r.id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[report templates] delete failed", err);
    return NextResponse.json(
      { error: "No se pudo borrar la plantilla" },
      { status: 500 }
    );
  }
}
