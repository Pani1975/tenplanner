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
  groups,
  groupStudents,
  places,
  users,
} from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import {
  exerciseOwnOrClubCondition,
  exerciseVisibleToUserCondition,
} from "@/lib/exercise-access";
import { SessionWizard } from "@/components/app/session-wizard/session-wizard";
import type {
  TrainingPhase,
  WizardExercise,
  WizardSessionBlock,
} from "@/components/app/session-wizard/types";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import { canSeeClassDraft } from "@/lib/classes/visibility";
import { loadSessionPlan } from "@/lib/sessions/plan";
import {
  createTextItem,
  createWarmupItem,
  createStationsItem,
  planItemsToWizard,
} from "@/components/app/session-wizard/timeline";
import { resolveItemKind, type StationItemJson } from "@/lib/block-items";
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
    group?: string;
    at?: string;
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

  // Todos los ejercicios del deporte activo (antes se cortaba en 200 por
  // orden alfabético y mezclando deportes). El paso de ejercicios solo pinta
  // los 30 primeros resultados del buscador.
  const sport = await getActiveSport(user.id);
  const allExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      category: exercises.category,
      difficulty: exercises.difficulty,
      durationMinutes: exercises.durationMinutes,
      description: exercises.description,
      nivel: exercises.nivel,
      niveles: exercises.niveles,
      phase: exercises.phase,
      aspectoJuego: exercises.aspectoJuego,
      aspectosJuego: exercises.aspectosJuego,
      golpes: exercises.golpes,
    })
    .from(exercises)
    .where(
      and(
        publicExercisesEnabled
          ? exerciseVisibleToUserCondition(user.id)
          : exerciseOwnOrClubCondition(user.id),
        eq(exercises.sport, sport)
      )
    )
    .orderBy(exercises.name)
    .limit(2000);

  const {
    exercises: exerciseParam,
    from: fromSessionId,
    fromClass: fromClassId,
    group: groupIdParam,
    at: atParam,
  } = await searchParams;

  // Fecha/hora ya calculada por quien nos trae aquí (p. ej. el próximo día
  // habitual del grupo al "asignar clase"). Formato esperado:
  // "YYYY-MM-DDTHH:mm"; si no es válido se ignora y el wizard usa su
  // valor por defecto.
  const initialScheduledAt =
    atParam && !isNaN(new Date(atParam).getTime()) ? atParam : undefined;

  // Preasignar un grupo (p. ej. desde "Asignar clase" en la ficha de grupo):
  // precarga el grupo y a sus alumnos, igual que si se eligieran a mano en
  // el paso de alumnos.
  let fromGroup: { id: string; name: string } | null = null;
  let fromGroupStudentIds: string[] = [];
  if (groupIdParam) {
    const groupActiveClubId = await getActiveWorkClubId(user.id);
    const [grp] = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(
        and(
          eq(groups.id, groupIdParam),
          sharedWithClubCondition(
            groups.coachId,
            groups.clubId,
            user.id,
            groupActiveClubId
          )
        )
      )
      .limit(1);
    if (grp) {
      fromGroup = grp;
      const memberRows = await db
        .select({ studentId: groupStudents.studentId })
        .from(groupStudents)
        .where(eq(groupStudents.groupId, grp.id));
      fromGroupStudentIds = memberRows.map((m) => m.studentId);
    }
  }

  // Pre-fill from a class library template
  let fromClass: {
    id: string;
    name: string;
    objetivos: string | null;
    material: string | null;
    observations: string | null;
    tags: string[] | null;
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
        tags: classes.tags,
        isLibrary: classes.isLibrary,
        createdBy: classes.createdBy,
        clubId: classes.clubId,
        status: classes.status,
      })
      .from(classes)
      .where(eq(classes.id, fromClassId))
      .limit(1);

    const classActiveClubId =
      cls && !cls.isLibrary && cls.createdBy !== user.id && cls.clubId
        ? await getActiveWorkClubId(user.id)
        : null;
    const sharedViaClub = !!cls?.clubId && cls.clubId === classActiveClubId;

    if (
      cls &&
      canSeeClassDraft(cls, user.id) &&
      (cls.isLibrary || cls.createdBy === user.id || sharedViaClub)
    ) {
      fromClass = {
        id: cls.id,
        name: cls.name,
        objetivos: cls.objetivos,
        material: cls.material,
        observations: cls.observations,
        tags: Array.isArray(cls.tags) ? cls.tags : null,
      };
      const items = await db
        .select({
          blockOrder: classBlocks.orderIndex,
          blockTitle: classBlocks.title,
          blockNotes: classBlocks.notes,
          itemExerciseId: classBlockExercises.exerciseId,
          freeText: classBlockExercises.freeText,
          itemTitle: classBlockExercises.title,
          itemDuration: classBlockExercises.durationMinutes,
          itemOrderIndex: classBlockExercises.orderIndex,
          itemKind: classBlockExercises.kind,
          itemStations: classBlockExercises.stations,
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

        const itemKind = resolveItemKind({
          kind: row.itemKind,
          exerciseId: row.itemExerciseId,
          freeText: row.freeText,
        });

        if (itemKind === "warmup") {
          fromClassExercises.push(
            createWarmupItem(
              phaseFromBlock(orderIndex),
              row.itemDuration ?? null
            )
          );
          continue;
        }

        if (itemKind === "stations") {
          const stations = (row.itemStations as StationItemJson[] | null) ?? [];
          const stationsItem = createStationsItem(
            phaseFromBlock(orderIndex),
            stations.length || 1,
            row.freeText ?? "",
            row.itemDuration ?? null
          );
          if (stations.length) {
            stationsItem.stations = stations.map((s) => ({
              kind: s.kind,
              exerciseId: s.exerciseId,
              name: s.exerciseName ?? "",
              freeText: s.freeText ?? "",
              durationMinutes: s.durationMinutes,
            }));
          }
          fromClassExercises.push(stationsItem);
          continue;
        }

        // Textos libres de la clase: van a la línea de tiempo en su sitio.
        if (
          !row.itemExerciseId &&
          (row.freeText?.trim() || row.itemTitle?.trim())
        ) {
          fromClassExercises.push(
            createTextItem(
              row.freeText?.trim() ?? "",
              phaseFromBlock(orderIndex),
              row.itemDuration ?? null,
              "",
              row.itemTitle?.trim() ?? ""
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
    material: string | null;
    observations: string | null;
    tags: string[];
    location: string | null;
  } | null = null;
  let fromExercises: WizardExercise[] = [];

  if (fromSessionId) {
    const [sourceSession] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        objective: sessions.objective,
        material: sessions.material,
        observations: sessions.observations,
        tags: sessions.tags,
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
        material: sourceSession.material,
        observations: sourceSession.observations,
        tags: Array.isArray(sourceSession.tags) ? sourceSession.tags : [],
        location: sourceSession.location,
      };

      const plan = await loadSessionPlan(fromSessionId);
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
              initialMaterial={
                fromSession?.material ?? fromClass?.material ?? undefined
              }
              initialObservations={
                fromSession?.observations ??
                fromClass?.observations ??
                undefined
              }
              initialTags={fromSession?.tags ?? fromClass?.tags ?? undefined}
              initialSourceClassId={fromClass?.id ?? null}
              initialBlocks={fromClassBlocks}
              initialLocation={fromSession?.location ?? undefined}
              initialGroupId={fromGroup?.id ?? null}
              initialGroupName={fromGroup?.name}
              initialStudentIds={fromGroupStudentIds}
              initialScheduledAt={initialScheduledAt}
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
