import { ArrowLeft } from "lucide-react";
import { getWorkMode, spaceTitle } from "@/lib/work-mode";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ExerciseForm,
  type ExerciseFormProps,
} from "@/components/app/exercise-form";
import { FeatureLocked } from "@/components/app/feature-locked";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveSport } from "@/lib/sports";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessExercise } from "@/lib/exercise-access";

interface PageProps {
  searchParams: Promise<{ mode?: string; duplicar?: string }>;
}

type ExerciseFormInitialData = NonNullable<ExerciseFormProps["initialData"]>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COPY_SUFFIX = " (copia)";

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
  const { mode, duplicar } = await searchParams;

  // Duplicar: se abre el formulario de nuevo ejercicio con los datos del
  // original y el nombre "… (copia)". Al guardar se crea una ficha nueva e
  // independiente; el original no se toca.
  let duplicateData: ExerciseFormInitialData | undefined;
  if (duplicar && UUID_RE.test(duplicar)) {
    const [source] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, duplicar))
      .limit(1);
    if (source && (await canAccessExercise(source, user.id))) {
      duplicateData = {
        name: `${source.name.slice(0, 255 - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
        description: source.description,
        category: source.category,
        difficulty: source.difficulty,
        durationMinutes: source.durationMinutes,
        objectives: source.objectives,
        steps: source.steps as ExerciseFormInitialData["steps"],
        materials: source.materials as string[] | null,
        location: source.location as ExerciseFormInitialData["location"],
        videoUrl: source.videoUrl,
        tips: source.tips,
        imageUrl: source.imageUrl,
        imageUrls: source.imageUrls as string[] | null,
        variantes: source.variantes,
        observaciones: source.observaciones,
        formato: source.formato,
        numJugadores: source.numJugadores,
        tipoPelota: source.tipoPelota as ExerciseFormInitialData["tipoPelota"],
        tipoActividad: source.tipoActividad as never,
        tiposActividad: source.tiposActividad as never,
        caracter: source.caracter,
        situacionJuego: source.situacionJuego,
        tipoCompeticion: source.tipoCompeticion,
        golpes: source.golpes,
        efecto: source.efecto,
        nivel: source.nivel as never,
        niveles: source.niveles as never,
        aspectoJuego: source.aspectoJuego as never,
        aspectosJuego: source.aspectosJuego as never,
        parametro: source.parametro as never,
        parametros: source.parametros as never,
        tipologia: source.tipologia as never,
        duracionRango: source.duracionRango as never,
        phase: source.phase,
        fases: source.fases as ExerciseFormInitialData["fases"],
        intensity: source.intensity,
        autoria: source.autoria,
        // isGlobal no se hereda: lo decide el modo de trabajo (público solo
        // en Modo Ten Planner), igual que en un ejercicio nuevo.
      };
    }
  }

  const initialFormMode = duplicateData
    ? "full"
    : mode === "full" || mode === "quick"
      ? mode
      : undefined;

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
            {duplicateData ? "Duplicar ejercicio" : "Nuevo ejercicio"}
          </h1>
        </div>
      </div>

      <div className="flex-1">
        <ExerciseForm
          mode="create"
          isAdmin={isAdmin}
          publishToLibrary={isAdmin}
          initialFormMode={initialFormMode}
          initialData={duplicateData}
          enableDrafts={!duplicateData}
          sport={sport}
        />
      </div>
    </div>
  );
}
