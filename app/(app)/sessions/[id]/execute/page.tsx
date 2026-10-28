import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadSessionPlan } from "@/lib/sessions/plan";
import { getExerciseDiagrams } from "@/lib/exercise-diagrams";
import { ExecuteSessionClient } from "./execute-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ExecuteSessionPage({ params }: PageProps) {
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

  if (!sessionRow) notFound();
  if (sessionRow.userId !== user.id) notFound();

  const plan = await loadSessionPlan(id, user.id);
  const resolvedExercises = plan.items.map((item, orderIndex) => {
    if (item.kind === "exercise") {
      return {
        key: item.key,
        kind: "exercise" as const,
        exerciseId: item.exerciseId,
        name: item.name,
        category: item.category,
        difficulty: item.difficulty,
        description: item.description,
        durationMinutes: item.durationMinutes ?? item.defaultDurationMinutes,
        notes: item.notes,
        orderIndex,
        steps: item.steps,
        tips: item.tips,
        materials: item.materials,
      };
    }
    if (item.kind === "warmup") {
      return {
        key: item.key,
        kind: "text" as const,
        exerciseId: null,
        name: "Descanso",
        category: "warmup",
        difficulty: "",
        description: null,
        durationMinutes: item.durationMinutes ?? 0,
        notes: item.notes,
        orderIndex,
        steps: [],
        tips: null,
        materials: [],
      };
    }
    if (item.kind === "stations") {
      const stationLines = item.stations.map(
        (station, idx) =>
          `${idx + 1}. ${station.kind === "exercise" ? (station.exerciseName ?? "Ejercicio") : (station.freeText ?? "")}`
      );
      return {
        key: item.key,
        kind: "text" as const,
        exerciseId: null,
        name: "Estaciones",
        category: "stations",
        difficulty: "",
        description: [item.introText, ...stationLines]
          .filter((v) => v && v.trim())
          .join("\n"),
        durationMinutes: item.durationMinutes ?? 0,
        notes: item.notes,
        orderIndex,
        steps: [],
        tips: null,
        materials: [],
      };
    }
    return {
      key: item.key,
      kind: "text" as const,
      exerciseId: null,
      name: item.text,
      category: "text",
      difficulty: "",
      description: item.description,
      durationMinutes: item.durationMinutes ?? 0,
      notes: item.notes,
      orderIndex,
      steps: [],
      tips: null,
      materials: [],
    };
  });

  return (
    <ExecuteSessionClient
      session={{
        id: sessionRow.id,
        title: sessionRow.title,
        durationMinutes: sessionRow.durationMinutes,
        scheduledAt: sessionRow.scheduledAt.toISOString(),
        status: sessionRow.status,
      }}
      exercises={resolvedExercises}
      diagrams={getExerciseDiagrams(
        resolvedExercises
          .map((e) => e.exerciseId)
          .filter((x): x is string => !!x)
      )}
    />
  );
}
