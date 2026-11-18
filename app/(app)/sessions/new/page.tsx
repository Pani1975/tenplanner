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
  students,
  users,
} from "@/db/schema";
import { and, eq, asc, inArray } from "drizzle-orm";
import {
  exerciseListableCondition,
  exerciseOwnOrClubCondition,
  isPlatformAdmin,
} from "@/lib/exercise-access";
import { SessionWizard } from "@/components/app/session-wizard/session-wizard";
import type {
  TrainingPhase,
  WizardExercise,
  WizardSessionBlock,
} from "@/components/app/session-wizard/types";
import { getBooleanSetting } from "@/lib/app-settings";
import {
  getActiveWorkClubId,
  getClubMembersDirectory,
  sharedWithClubCondition,
} from "@/lib/clubs";
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
import { SessionTargetStep } from "@/components/app/session-wizard/session-target-step";
import { TargetModeCards } from "@/components/app/session-wizard/target-mode-cards";
import type { SessionTarget } from "@/lib/session-target";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";

interface PageProps {
  searchParams: Promise<{
    exercises?: string;
    step?: string;
    from?: string;
    fromClass?: string;
    group?: string;
    at?: string;
    /** "Que la diseñe Ten Planner": la propuesta se prepara en el Paso 2. */
    disenar?: string;
    /** Respuestas de "Antes de la propuesta". */
    dur?: string;
    obj?: string;
    lugar?: string;
    /** pistas=2: la sesión usa dos pistas. */
    pistas?: string;
    /** rota=1: con dos pistas, los grupos rotan. */
    rota?: string;
    /** Destino ya elegido en el primer paso: alumnos sueltos, 2.º lugar… */
    students?: string;
    lugar2?: string;
    target?: string;
    modo?: string;
    draft?: string;
  }>;
}

export default async function NewSessionPage({ searchParams }: PageProps) {
  const intlLocale = (await getLocale()) === "en" ? "en-GB" : "es-ES";
  const tx = await getTranslations("ui.s_new_page");
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
        title={tx("crearSesionesEstaBloqueado")}
        description={tx("unAdministradorHaDesactivado")}
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
  // En modo club se elige qué monitor imparte la sesión (por defecto, uno
  // mismo).
  const workClubId = await getActiveWorkClubId(user.id);
  const clubCoaches = workClubId
    ? (await getClubMembersDirectory([workClubId])).sort((a, b) =>
        a.name.localeCompare(b.name, "es")
      )
    : [];

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
      fases: exercises.fases,
      aspectoJuego: exercises.aspectoJuego,
      aspectosJuego: exercises.aspectosJuego,
      golpes: exercises.golpes,
    })
    .from(exercises)
    .where(
      and(
        publicExercisesEnabled
          ? exerciseListableCondition(user.id, await isPlatformAdmin(user.id))
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
    disenar: disenarParam,
    dur: durParam,
    obj: objParam,
    lugar: lugarParam,
    pistas: pistasParam,
    rota: rotaParam,
    students: studentsParam,
    lugar2: lugar2Param,
    target: targetParam,
    modo: modoParam,
    draft: draftParam,
    step: stepParam,
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
  let fromGroup: { id: string; name: string; objetivos: string | null } | null =
    null;
  let fromGroupStudentIds: string[] = [];
  if (groupIdParam) {
    const groupActiveClubId = await getActiveWorkClubId(user.id);
    const [grp] = await db
      .select({ id: groups.id, name: groups.name, objetivos: groups.objetivos })
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
    courts: number;
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
        courts: classes.courts,
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
        courts: cls.courts,
      };
      const items = await db
        .select({
          blockOrder: classBlocks.orderIndex,
          blockTitle: classBlocks.title,
          blockNotes: classBlocks.notes,
          blockRotates: classBlocks.rotates,
          itemExerciseId: classBlockExercises.exerciseId,
          freeText: classBlockExercises.freeText,
          itemTitle: classBlockExercises.title,
          itemDuration: classBlockExercises.durationMinutes,
          itemOrderIndex: classBlockExercises.orderIndex,
          itemKind: classBlockExercises.kind,
          itemStations: classBlockExercises.stations,
          itemCourt: classBlockExercises.court,
          itemLedBy: classBlockExercises.ledBy,
          itemTurnMinutes: classBlockExercises.turnMinutes,
          itemTurnSize: classBlockExercises.turnSize,
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

      // Pista y quién dirige cada elemento (plantillas con dos pistas).
      let lane: Pick<
        WizardExercise,
        "court" | "ledBy" | "turnMinutes" | "turnSize"
      > = {};
      const pushItem = (item: WizardExercise) =>
        fromClassExercises.push({ ...item, ...lane });

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
            rotates: cls.courts === 2 && row.blockRotates === true,
            items: [],
          } satisfies WizardSessionBlock);

        blockMap.set(orderIndex, block);
        lane =
          cls.courts === 2
            ? {
                court: row.itemCourt === 2 ? 2 : 1,
                ledBy:
                  row.itemLedBy === "coach" || row.itemLedBy === "auto"
                    ? row.itemLedBy
                    : null,
                turnMinutes: row.itemTurnMinutes ?? null,
                turnSize: row.itemTurnSize ?? null,
              }
            : {};

        const itemKind = resolveItemKind({
          kind: row.itemKind,
          exerciseId: row.itemExerciseId,
          freeText: row.freeText,
        });

        if (itemKind === "warmup") {
          pushItem(
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
          pushItem(stationsItem);
          continue;
        }

        // Textos libres de la clase: van a la línea de tiempo en su sitio.
        if (
          !row.itemExerciseId &&
          (row.freeText?.trim() || row.itemTitle?.trim())
        ) {
          pushItem(
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
          pushItem({
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
    courts: number;
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
        courts: sessions.courts,
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
        courts: sourceSession.courts,
      };

      const plan = await loadSessionPlan(fromSessionId, user.id);
      fromExercises = planItemsToWizard(plan.items);
    }
  }

  // Alumnos sueltos elegidos en el primer paso (clase suelta): solo los del
  // monitor.
  const targetStudentIds = (studentsParam ?? "")
    .split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const targetStudents =
    targetStudentIds.length > 0
      ? await db
          .select({ id: students.id, name: students.name })
          .from(students)
          .where(
            and(
              eq(students.coachId, user.id),
              inArray(students.id, targetStudentIds)
            )
          )
      : [];

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
  // "Que la diseñe Ten Planner" (desde /sessions/new/montar): con grupo.
  const disenar =
    disenarParam === "1" && (!!fromGroup || targetStudents.length > 0);
  const durNum = Number(durParam);
  const disenarDuration =
    Number.isFinite(durNum) && durNum >= 10 && durNum <= 240
      ? Math.round(durNum)
      : undefined;
  const allowDraftRestore =
    !disenar && !fromSession && !fromClass && preSelected.length === 0;
  const noPreload =
    !disenar && !fromSession && !fromClass && preSelected.length === 0;
  // Destino elegido en el primer paso (para quién, cuándo, pistas y lugares).
  const hasTarget =
    targetParam === "1" || !!groupIdParam || targetStudentIds.length > 0 || !!atParam;
  const hasSource = !noPreload || !!draftParam;
  const showTargetStep = !hasSource && !hasTarget;
  const showModeCards = !hasSource && hasTarget && modoParam !== "cero";
  const showWizard = !showTargetStep && !showModeCards;
  const targetPlaceId =
    lugarParam && coachPlaces.some((p) => p.id === lugarParam)
      ? lugarParam
      : null;
  const targetPlaceId2 =
    lugar2Param && coachPlaces.some((p) => p.id === lugar2Param)
      ? lugar2Param
      : null;
  const targetCourts: 1 | 2 = pistasParam === "2" ? 2 : 1;
  const targetAt = initialScheduledAt ?? "";
  const targetInitial: SessionTarget = {
    groupId: fromGroup?.id ?? null,
    studentIds: targetStudents.map((st) => st.id),
    at: targetAt,
    courts: targetCourts,
    placeId: targetPlaceId,
    placeId2: targetPlaceId2,
  };
  const targetWho = fromGroup
    ? fromGroup.name
    : targetStudents.length > 0
      ? targetStudents.map((st) => st.name).join(", ")
      : tx("claseSueltaSinAlumnos");
  const targetWhen = targetAt
    ? new Intl.DateTimeFormat(intlLocale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(new Date(`${targetAt}:00Z`))
    : "";
  const targetLabel = [
    targetWho,
    targetWhen,
    targetCourts === 2 ? "dos pistas" : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
              aria-label={tx("volverASesiones")}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-[#F4F4F1] text-[0px] text-foreground/60 transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-[#050505]/70"
            >
              <ArrowLeft className="size-4 text-foreground/60" />←
            </Link>
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-[#F4F4F1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60 dark:bg-[#050505]/70">
                <Sparkles className="size-3.5 text-brand" />
                {tx("wizardDeSesion")}
              </p>
              <h1 className="font-heading text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
                {fromSession ? (
                  <>
                    {tx("reutilizando")}{" "}
                    <em className="italic text-brand">
                      {tx("v1", { v1: fromSession.title })}</em>
                  </>
                ) : fromClass ? (
                  <>
                    {tx("desdeClase")}{" "}
                    <em className="italic text-brand">
                      {tx("v1", { v1: fromClass.name })}</em>
                  </>
                ) : preSelected.length > 0 ? (
                  <>
                    <em className="italic text-brand">
                      {tx("v1EjercicioV2", { v1: preSelected.length, v2: preSelected.length !== 1 ? "s" : "" })}
                    </em>{" "}
                    {tx("cargados")}
                  </>
                ) : (
                  <>
                    {tx("nueva")}{" "}<em className="italic text-brand">{tx("sesion")}</em>
                  </>
                )}
              </h1>
            </div>
          </div>
        </header>

        {/* Paso 1: para quién, cuándo y cuántas pistas */}
        {showTargetStep && (
          <SessionTargetStep
            places={coachPlaces}
            initial={targetInitial}
          />
        )}

        {/* Paso 2: cómo montarla (con el destino ya elegido) */}
        {showModeCards && (
          <TargetModeCards target={targetInitial} label={targetLabel} />
        )}

        {showWizard && (
        <div className="flex w-full flex-1 flex-col gap-6 pt-8">
          <Suspense fallback={null}>
            <SessionWizard
              availableExercises={allExercises}
              initialExercises={initialExercises}
              initialTitle={
                // Con destino ya elegido, el nombre sale del grupo y la fecha.
                targetParam === "1"
                  ? undefined
                  : (fromSession?.title ?? fromClass?.name)
              }
              initialObjective={
                fromSession?.objective ??
                fromClass?.objetivos ??
                (disenar
                  ? ((objParam?.trim() || fromGroup?.objetivos) ?? undefined)
                  : undefined)
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
              initialRotation={
                disenar && pistasParam === "2" && rotaParam === "1"
              }
              initialCourts={
                fromSession?.courts === 2 ||
                fromClass?.courts === 2 ||
                pistasParam === "2"
                  ? 2
                  : 1
              }
              initialLocation={fromSession?.location ?? undefined}
              initialGroupId={fromGroup?.id ?? null}
              initialGroupName={fromGroup?.name}
              initialStudentIds={Array.from(
                new Set([
                  ...fromGroupStudentIds,
                  ...targetStudents.map((st) => st.id),
                ])
              )}
              initialScheduledAt={initialScheduledAt}
              initialPlaceId={targetPlaceId ?? undefined}
              initialSecondPlaceId={targetPlaceId2 ?? undefined}
              places={coachPlaces}
              monitorName={monitorName}
              coaches={clubCoaches}
              initialCoachId={clubCoaches.length > 0 ? user.id : null}
              allowDraftRestore={allowDraftRestore}
              initialDurationMinutes={disenar ? disenarDuration : undefined}
              engine={
                disenar && fromGroup
                  ? { groupId: fromGroup.id, autoStart: stepParam === "2" }
                  : disenar
                    ? {
                        studentIds: targetStudents.map((st) => st.id),
                        autoStart: stepParam === "2",
                      }
                    : undefined
              }
            />
          </Suspense>
        </div>
        )}
      </div>
    </div>
  );
}
