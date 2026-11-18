import { redirect } from "next/navigation";
import { Globe2, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  loadBaseObjectives,
  loadClubObjectives,
  loadWorkspaceObjectives,
} from "@/lib/objectives";
import { getWorkMode, spaceTitle, workModeKicker } from "@/lib/work-mode";
import { WorkspaceObjectivesManager } from "./workspace-objectives-manager";
import { BulkObjectivesActions } from "./bulk-objectives-actions";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getTerm } from "@/lib/i18n-terms";

export async function generateMetadata() {
  const term = await getTerm();
  return { title: term("Objetivos") };
}

export default async function ObjectivesPage() {
  const tx = await getTranslations("ui.s_objetivos_page");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mode = await getWorkMode(user.id);
  const items =
    mode.kind === "tenplanner"
      ? await loadBaseObjectives({ includeRemoved: true })
      : mode.kind === "club"
        ? await loadClubObjectives(mode.clubId, user.id)
        : await loadWorkspaceObjectives(user.id, null, {
            includeHidden: true,
          });
  const scope =
    mode.kind === "tenplanner"
      ? "base"
      : mode.kind === "club"
        ? "club"
        : "coach";

  const intro =
    mode.kind === "tenplanner"
      ? tx("catalogoDeObjetivosDe")
      : mode.kind === "club"
        ? tx("objetivosQueVenTodos")
        : tx("objetivosDeTusAlumnos");

  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-4xl space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <Target className="size-3.5" />
            {workModeKicker(mode, await getLocale())}
          </div>
          <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
            {spaceTitle("Objetivos", mode, await getLocale())}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            {intro}
          </p>
        </header>

        {mode.kind === "tenplanner" && (
          <p className="flex items-start gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm font-semibold text-foreground">
            <Globe2 className="mt-0.5 size-4 shrink-0 text-brand" />
            {tx("estasEnModoTen")}
          </p>
        )}

        {scope !== "base" && (
          <BulkObjectivesActions inClub={scope === "club"} />
        )}

        <WorkspaceObjectivesManager items={items} scope={scope} />
      </div>
    </div>
  );
}
