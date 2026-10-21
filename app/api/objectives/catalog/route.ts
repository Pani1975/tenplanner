import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId } from "@/lib/clubs";
import { loadWorkspaceObjectives } from "@/lib/objectives";

// Catálogo de objetivos para el selector "Cargar objetivos" de ejercicios,
// clases, sesiones y grupos: el del club con el que trabaja el monitor (o el
// suyo de particular), con los cambios que haya hecho el club.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clubId = await getActiveWorkClubId(user.id);
  const items = await loadWorkspaceObjectives(user.id, clubId);

  return NextResponse.json({
    data: {
      scope: clubId ? "club" : "coach",
      items: items.map((i) => ({
        id: i.id,
        code: i.code,
        ball: i.ball,
        aspect: i.aspect,
        block: i.block,
        title: i.title,
        criterion: i.criterion,
        scope: i.scope,
      })),
    },
  });
}
