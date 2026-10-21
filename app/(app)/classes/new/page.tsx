import Link from "next/link";
import { getWorkMode, spaceTitle } from "@/lib/work-mode";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, eq, or } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { ClassForm } from "@/components/app/class-form";
import { getActiveSport } from "@/lib/sports";
import { exerciseOwnOrClubCondition } from "@/lib/exercise-access";

export default async function NewClassPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sport = await getActiveSport(user.id);

  const workMode = await getWorkMode(user.id);
  // Las opciones de Biblioteca pública solo existen en Modo Ten Planner.
  const publishToLibrary = workMode.kind === "tenplanner";

  const availableExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      category: exercises.category,
      description: exercises.description,
      nivel: exercises.nivel,
      niveles: exercises.niveles,
      phase: exercises.phase,
      fases: exercises.fases,
      aspectoJuego: exercises.aspectoJuego,
      aspectosJuego: exercises.aspectosJuego,
      golpes: exercises.golpes,
    })
    .from(exercises)
    .where(
      and(
        or(eq(exercises.isGlobal, true), exerciseOwnOrClubCondition(user.id)),
        eq(exercises.sport, sport)
      )
    )
    .orderBy(exercises.name)
    .limit(2000);

  return (
    <div className="px-4 py-8 sm:px-6 md:px-10">
      <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
        <Link
          href="/classes"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505]"
          aria-label="Volver a clases"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#D6FF38]">
            {spaceTitle("Clases", workMode)}
          </p>
          <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Nueva clase
          </h1>
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
            Define una plantilla reutilizable. Luego podrás cargarla en
            cualquier sesión.
          </p>
        </div>
      </div>

      <ClassForm
        mode="create"
        availableExercises={availableExercises}
        isAdmin={publishToLibrary}
        publishToLibrary={publishToLibrary}
        sport={sport}
      />
    </div>
  );
}
