import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadBaseObjectives, loadWorkspaceObjectives } from "@/lib/objectives";
import { getWorkMode } from "@/lib/work-mode";

// Catálogo de objetivos para el selector "Cargar objetivos" de ejercicios,
// clases, sesiones y grupos, según el modo de trabajo: el de Ten Planner (Modo
// Ten Planner), el del club con sus cambios o el particular del monitor.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mode = await getWorkMode(user.id);
  const items =
    mode.kind === "tenplanner"
      ? await loadBaseObjectives()
      : await loadWorkspaceObjectives(
          user.id,
          mode.kind === "club" ? mode.clubId : null
        );

  return NextResponse.json({
    data: {
      scope:
        mode.kind === "club"
          ? "club"
          : mode.kind === "tenplanner"
            ? "base"
            : "coach",
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
