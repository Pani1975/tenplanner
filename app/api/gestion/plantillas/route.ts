import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClubAccountClubId } from "@/lib/clubs";
import {
  createReportTemplate,
  listReportTemplates,
  templateInputSchema,
} from "@/lib/club-report/templates";

async function clubAccount() {
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
  return { userId: user.id, clubId };
}

/** GET /api/gestion/plantillas: plantillas del informe del club. */
export async function GET() {
  const auth = await clubAccount();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ data: await listReportTemplates(auth.clubId) });
  } catch (err) {
    console.error("[report templates] list failed", err);
    return NextResponse.json(
      { error: "No se pudieron cargar las plantillas" },
      { status: 500 }
    );
  }
}

/** POST /api/gestion/plantillas { name, metrics }: guarda un diseño de informe. */
export async function POST(request: Request) {
  const auth = await clubAccount();
  if ("error" in auth) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = templateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(". ") },
      { status: 400 }
    );
  }
  try {
    const created = await createReportTemplate(
      auth.clubId,
      auth.userId,
      parsed.data
    );
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error("[report templates] create failed", err);
    return NextResponse.json(
      { error: "No se pudo guardar la plantilla" },
      { status: 500 }
    );
  }
}
