import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  exercises,
  sessions,
  classes,
  classBlocks,
  classBlockExercises,
  places,
  users,
} from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { SessionWizard } from "@/components/app/session-wizard/session-wizard";
import type {
  TrainingPhase,
  WizardExercise,
  WizardSessionBlock,
} from "@/components/app/session-wizard/types";
import { getBooleanSetting } from "@/lib/app-settings";
import { loadSessionPlan } from "@/lib/sessions/plan";
import {
  createTextItem,
  planItemsToWizard,
} from "@/components/app/session-wizard/timeline";
import { FeatureLocked } from "@/components/app/feature-locked";
import {
  ArrowLeft,
  BookOpen,
  PencilLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    exercises?: string;
    step?: string;
    from?: string;
    fromClass?: string;
  }>;
}

export default async function NewSessionPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const [sessionCreationEnabled, publicExercisesEnabled] = await Promise.all([
    getBooleanSetting("feature.session_creation_enabled"),
    getBooleanSetting("feature.public_exercises_enabled"),
  ]);
  if (!sessionCreationEnabled) {
    return (
      <FeatureLocked
        title="Crear sesiones está bloqueado"
        description="Un administrador ha desactivado temporalmente la creación manual de sesiones."
        href="/sessions"
        cta="Volver a sesiones"
      />
    );
  }

  const [coachPlaces, userRow] = await Promise.all([
    db
      .select({ id: places.id, name: places.name })
      .from(places)
      .where(eq(places.coachId, user.id))
      .orderBy(places.name),
    db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
  ]);
  const monitorName =
    userRow[0]?.name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Monitor";

  const allExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      category: exercises.category,
      difficulty: exercises.difficulty,
      durationMinutes: exercises.durationMinutes,
    })
    .from(exercises)
    .where(
      publicExercisesEnabled
        ? exerciseVisibleToUserCondition(user.id)
        : eq(exercises.createdBy, user.id)
    )
    .orderBy(exercises.name)
    .limit(200);

  const {
    exercises: exerciseParam,
    from: fromSessionId,
    fromClass: fromClassId,
  } = await searchParams;

  // Pre-fill from a class library template
  let fromClass: {
    id: string;
    name: string;
    objetivos: string | null;
    material: string | null;
    observations: string | null;
  } | null = null;
  const fromClassExercises: WizardExercise[] = [];
  let fromClassBlocks: WizardSessionBlock[] = [];

  if (fromClassId) {
    const [cls] = await db
      .select({
        id: classes.id,
        name: classes.name,
        objetivos: classes.objetivos,
        material: classes.material,
        observations: classes.aspectosImportantes,
        isLibrary: classes.isLibrary,
        createdBy: classes.createdBy,
      })
      .from(classes)
      .where(eq(classes.id, fromClassId))
      .limit(1);

    if (cls && (cls.isLibrary || cls.createdBy === user.id)) {
      fromClass = {
        id: cls.id,
        name: cls.name,
        objetivos: cls.objetivos,
        material: cls.material,
        observations: cls.observations,
      };
      const items = await db
        .select({
          blockOrder: classBlocks.orderIndex,
          blockTitle: classBlocks.title,
          blockNotes: classBlocks.notes,
          itemExerciseId: classBlockExercises.exerciseId,
          freeText: classBlockExercises.freeText,
          itemDuration: classBlockExercises.durationMinutes,
          itemOrderIndex: classBlockExercises.orderIndex,
          exerciseId: exercises.id,
          name: exercises.name,
          category: exercises.category,
          defaultDuration: exercises.durationMinutes,
        })
        .from(classBlocks)
        .leftJoin(
          classBlockExercises,
          eq(classBlockExercises.blockId, classBlocks.id)
        )
        .leftJoin(exercises, eq(exercises.id, classBlockExercises.exerciseId))
        .where(eq(classBlocks.classId, fromClassId))
        .orderBy(
          asc(classBlocks.orderIndex),
          asc(classBlockExercises.orderIndex)
        );

      const blockMap = new Map<number, WizardSessionBlock>();
      function phaseFromBlock(orderIndex: number): TrainingPhase {
        if (orderIndex === 1) return "activation";
        if (orderIndex === 3) return "cooldown";
        return "main";
      }

      for (const row of items) {
        const orderIndex =
          row.blockOrder === 1 || row.blockOrder === 3 ? row.blockOrder : 2;
        const block =
          blockMap.get(orderIndex) ??
          ({
            orderIndex,
            title:
              row.blockTitle ??
              (orderIndex === 1
                ? "Bloque inicial"
                : orderIndex === 3
                  ? "Bloque final"
                  : "Bloque principal"),
            notes: row.blockNotes ?? "",
            items: [],
          } satisfies WizardSessionBlock);

        blockMap.set(orderIndex, block);

        // Textos libres de la clase: van a la línea de tiempo en su sitio.
        if (!row.itemExerciseId && row.freeText?.trim()) {
          fromClassExercises.push(
            createTextItem(
              row.freeText.trim(),
              phaseFromBlock(orderIndex),
              row.itemDuration ?? null
            )
          );
        }

        if (row.exerciseId && row.name && row.category) {
          fromClassExercises.push({
            exerciseId: row.exerciseId,
            name: row.name,
            category: row.category,
            durationMinutes: row.itemDuration ?? row.defaultDuration ?? 0,
            overrideDuration: row.itemDuration ?? null,
            notes: "",
            phase: phaseFromBlock(orderIndex),
            intensity: null,
          });
        }
      }

      fromClassBlocks = [1, 2, 3].map(
        (orderIndex) =>
          blockMap.get(orderIndex) ??
          ({
            orderIndex: orderIndex as 1 | 2 | 3,
            title:
              orderIndex === 1
                ? "Bloque inicial"
                : orderIndex === 3
                  ? "Bloque final"
                  : "Bloque principal",
            notes: "",
            items: [],
          } satisfies WizardSessionBlock)
      );
    }
  }

  // Pre-fill from an existing session ("Reutilizar")
  let fromSession: {
    title: string;
    objective: string | null;
    location: string | null;
  } | null = null;
  let fromExercises: WizardExercise[] = [];

  if (fromSessionId) {
    const [sourceSession] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        objective: sessions.objective,
        location: sessions.location,
        userId: sessions.userId,
      })
      .from(sessions)
      .where(eq(sessions.id, fromSessionId))
      .limit(1);

    if (sourceSession && sourceSession.userId === user.id) {
      fromSession = {
        title: sourceSession.title,
        objective: sourceSession.objective,
        location: sourceSession.location,
      };

      const plan = await loadSessionPlan(fromSessionId, user.id);
      fromExercises = planItemsToWizard(plan.items);
    }
  }

  const preSelectedIds = new Set(
    (exerciseParam ?? "").split(",").filter(Boolean)
  );
  const preSelected: WizardExercise[] = allExercises
    .filter((e) => preSelectedIds.has(e.id))
    .map((e) => ({
      exerciseId: e.id,
      name: e.name,
      category: e.category,
      durationMinutes: e.durationMinutes,
      overrideDuration: null,
      notes: "",
      phase: null,
      intensity: null,
    }));

  const initialExercises =
    fromExercises.length > 0
      ? fromExercises
      : fromClassExercises.length > 0
        ? fromClassExercises
        : preSelected.length > 0
          ? preSelected
          : undefined;
  const allowDraftRestore =
    !fromSession && !fromClass && preSelected.length === 0;
  const noPreload = !fromSession && !fromClass && preSelected.length === 0;

  return (
    <div className="relative min-h-full w-full bg-[#F4F4F1] dark:bg-[#050505]">
      <div className="relative flex min-h-full w-full flex-col px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <header className="relative overflow-hidden rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_18px_60px_rgba(5,5,5,0.06)] dark:border-white/10 dark:bg-white/[0.045] sm:p-6">
          <div
            aria-hidden
            className="court-grid pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
          />
          <div className="relative flex items-center gap-4">
            <Link
              href="/sessions"
              aria-label="Volver a sesiones"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-[#F4F4F1] text-[0px] text-foreground/60 transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-[#050505]/70"
            >
              <ArrowLeft className="size-4 text-foreground/60" />←
            </Link>
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-[#F4F4F1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60 dark:bg-[#050505]/70">
                <Sparkles className="size-3.5 text-brand" />
                Wizard de sesión
              </p>
              <h1 className="font-heading text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
                {fromSession ? (
                  <>
                    Reutilizando{" "}
                    <em className="italic text-brand">
                      &ldquo;{fromSession.title}&rdquo;
                    </em>
                  </>
                ) : fromClass ? (
                  <>
                    Desde clase{" "}
                    <em className="italic text-brand">
                      &ldquo;{fromClass.name}&rdquo;
                    </em>
                  </>
                ) : preSelected.length > 0 ? (
                  <>
                    <em className="italic text-brand">
                      {preSelected.length} ejercicio
                      {preSelected.length !== 1 ? "s" : ""}
                    </em>{" "}
                    cargados
                  </>
                ) : (
                  <>
                    Nueva <em className="italic text-brand">sesión</em>
                  </>
                )}
              </h1>
            </div>
          </div>
        </header>

        {noPreload && (
          <div className="grid sm:grid-cols-3 gap-3 pt-6">
            <Link
              href="/classes"
              className="group rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_12px_36px_rgba(5,5,5,0.04)] transition-colors hover:border-[#D6FF38]/70 hover:bg-[#D6FF38]/10 dark:border-white/10 dark:bg-white/[0.045]"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#D6FF38]/20 text-foreground [&>span]:hidden">
                <BookOpen className="size-4 text-brand" />
                <span className="text-lg">📖</span>
              </div>
              <p className="font-heading text-base text-foreground group-hover:text-brand">
                Elegir del catálogo Ten Planner
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Importa una clase ya preparada y conviértela en sesión.
              </p>
            </Link>

            <Link
              href="/sessions?filter=past"
              className="group rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_12px_36px_rgba(5,5,5,0.04)] transition-colors hover:border-[#D6FF38]/70 hover:bg-[#D6FF38]/10 dark:border-white/10 dark:bg-white/[0.045]"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#D6FF38]/20 text-foreground [&>span]:hidden">
                <RotateCcw className="size-4 text-brand" />
                <span className="text-lg">🔄</span>
              </div>
              <p className="font-heading text-base text-foreground group-hover:text-brand">
                Reutilizar clase pasada
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Copia una sesión que ya impartiste.
              </p>
            </Link>

            <div className="rounded-lg border border-[#D6FF38]/60 bg-[#D6FF38]/15 p-5 shadow-[0_12px_36px_rgba(5,5,5,0.04)]">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505] [&>span]:hidden">
                <PencilLine className="size-4" />
                <span className="text-lg">✏️</span>
              </div>
              <p className="font-heading text-base text-brand">
                Crear desde cero
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sigue construyendo bloque a bloque abajo.
              </p>
            </div>
          </div>
        )}

        <div className="flex w-full flex-1 flex-col gap-6 pt-8">
          <Suspense fallback={null}>
            <SessionWizard
              availableExercises={allExercises}
              initialExercises={initialExercises}
              initialTitle={fromSession?.title ?? fromClass?.name}
              initialObjective={
                fromSession?.objective ?? fromClass?.objetivos ?? undefined
              }
              initialMaterial={fromClass?.material ?? undefined}
              initialObservations={fromClass?.observations ?? undefined}
              initialSourceClassId={fromClass?.id ?? null}
              initialBlocks={fromClassBlocks}
              initialLocation={fromSession?.location ?? undefined}
              places={coachPlaces}
              monitorName={monitorName}
              allowDraftRestore={allowDraftRestore}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
