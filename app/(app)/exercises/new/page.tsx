import { ArrowLeft } from "lucide-react";
import { getWorkMode, spaceTitle } from "@/lib/work-mode";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ExerciseForm } from "@/components/app/exercise-form";
import { FeatureLocked } from "@/components/app/feature-locked";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveSport } from "@/lib/sports";

interface PageProps {
  searchParams: Promise<{ mode?: string }>;
}

export default async function NewExercisePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const [exerciseCreationEnabled, sport] = await Promise.all([
    getBooleanSetting("feature.exercise_creation_enabled"),
    getActiveSport(user.id),
  ]);

  if (!exerciseCreationEnabled) {
    return (
      <FeatureLocked
        title="Creación de ejercicios desactivada"
        description="El administrador ha pausado temporalmente la creación manual de ejercicios."
        href="/exercises"
        cta="Volver a ejercicios"
      />
    );
  }

  const workMode = await getWorkMode(user.id);
  // Las opciones de Biblioteca pública solo existen en Modo Ten Planner.
  const isAdmin = workMode.kind === "tenplanner";
  const { mode } = await searchParams;
  const initialFormMode =
    mode === "full" || mode === "quick" ? mode : undefined;

  return (
    <div className="flex min-h-full flex-col px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
        <Link
          href="/exercises"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505]"
          aria-label="Volver a ejercicios"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#D6FF38]">
            {spaceTitle("Ejercicios", workMode)}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Nuevo ejercicio
          </h1>
        </div>
      </div>

      <div className="flex-1">
        <ExerciseForm
          mode="create"
          isAdmin={isAdmin}
          publishToLibrary={isAdmin}
          initialFormMode={initialFormMode}
          enableDrafts
          sport={sport}
        />
      </div>
    </div>
  );
}
