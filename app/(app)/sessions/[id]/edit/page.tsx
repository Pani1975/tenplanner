import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  exercises,
  places,
  sessionStudents,
  sessions,
  users,
} from "@/db/schema";
import {
  exerciseOwnOrClubCondition,
  exerciseVisibleToUserCondition,
} from "@/lib/exercise-access";
import { getBooleanSetting } from "@/lib/app-settings";
import { loadSessionPlan } from "@/lib/sessions/plan";
import { SessionWizard } from "@/components/app/session-wizard/session-wizard";
import { planItemsToWizard } from "@/components/app/session-wizard/timeline";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSessionPage({ params }: PageProps) {
  const supabase = await createClient();
  const {
    data: { session: authSession },
  } = await supabase.auth.getSession();
  const user = authSession?.user ?? null;
  if (!user) redirect("/login");

  const { id } = await params;

  const [sessionRow] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  if (!sessionRow || sessionRow.userId !== user.id) notFound();

  const publicExercisesEnabled = await getBooleanSetting(
    "feature.public_exercises_enabled"
  );

  const [plan, studentRows, coachPlaces, userRow, allExercises] =
    await Promise.all([
      loadSessionPlan(id),
      db
        .select({ studentId: sessionStudents.studentId })
        .from(sessionStudents)
        .where(eq(sessionStudents.sessionId, id)),
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
      db
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
              ? exerciseVisibleToUserCondition(user.id)
              : exerciseOwnOrClubCondition(user.id),
            eq(exercises.sport, sessionRow.sport)
          )
        )
        .orderBy(exercises.name)
        .limit(2000),
    ]);

  const monitorName =
    userRow[0]?.name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Monitor";

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
              href={`/sessions/${id}`}
              aria-label="Volver a la sesión"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-[#F4F4F1] text-foreground/60 transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-[#050505]/70"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-[#F4F4F1] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60 dark:bg-[#050505]/70">
                <Pencil className="size-3.5 text-brand" />
                Editar sesión
              </p>
              <h1 className="font-heading text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
                <em className="italic text-brand">
                  &ldquo;{sessionRow.title}&rdquo;
                </em>
              </h1>
            </div>
          </div>
        </header>

        <div className="flex w-full flex-1 flex-col gap-6 pt-8">
          <Suspense fallback={null}>
            <SessionWizard
              availableExercises={allExercises}
              places={coachPlaces}
              monitorName={monitorName}
              allowDraftRestore={false}
              edit={{
                sessionId: id,
                initialState: {
                  title: sessionRow.title,
                  scheduledAt: sessionRow.scheduledAt.toISOString(),
                  durationMinutes: sessionRow.durationMinutes,
                  location: sessionRow.location ?? "",
                  placeId: sessionRow.placeId ?? null,
                  groupId: sessionRow.groupId ?? null,
                  objective: sessionRow.objective ?? "",
                  material: sessionRow.material ?? "",
                  observations: sessionRow.observations ?? "",
                  sourceClassId: sessionRow.sourceClassId ?? null,
                  intensity: sessionRow.intensity ?? null,
                  tags: Array.isArray(sessionRow.tags) ? sessionRow.tags : [],
                  studentIds: studentRows.map((row) => row.studentId),
                  exercises: planItemsToWizard(plan.items),
                  blocks: plan.blocks.map((block) => ({
                    orderIndex: block.orderIndex,
                    title: block.title,
                    notes: block.notes ?? "",
                    items: [],
                  })),
                },
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
