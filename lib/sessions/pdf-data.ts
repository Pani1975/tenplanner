import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionStudents, sessions, students, users } from "@/db/schema";
import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import { loadSessionPlan } from "@/lib/sessions/plan";
import { DEFAULT_BLOCK_ITEM_DURATION } from "@/lib/block-items";
import type { PdfExercise, PdfSession } from "@/lib/sessions/pdf";

export type SessionRow = typeof sessions.$inferSelect;

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "session"
  );
}

export async function getCoachName(userId: string, fallback: string) {
  const [coachRow] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return coachRow?.name ?? fallback;
}

/** Construye los datos de una sesión para el PDF (plan de bloques,
 * ejercicios y alumnos), a partir de la fila de la sesión ya cargada. */
export async function buildPdfSession(
  session: SessionRow,
  coachName: string
): Promise<PdfSession> {
  const plan = await loadSessionPlan(session.id);
  const blockTitles = new Map(
    plan.blocks.map((block) => [block.orderIndex, block.title])
  );

  const studentRows = await db
    .select({
      name: students.name,
      playerLevel: students.playerLevel,
    })
    .from(sessionStudents)
    .innerJoin(students, eq(sessionStudents.studentId, students.id))
    .where(eq(sessionStudents.sessionId, session.id));

  return {
    title: session.title,
    description: session.description,
    scheduledAt: new Date(session.scheduledAt),
    durationMinutes: session.durationMinutes,
    objective: session.objective,
    intensity: session.intensity,
    tags: session.tags,
    location: session.location,
    coachName,
    material: session.material,
    observations: session.observations,
    exercises: plan.items.map((item, orderIndex) => {
      if (item.kind === "exercise") {
        return {
          kind: "exercise" as const,
          name: item.name,
          category: item.category as PdfExercise["category"],
          difficulty: item.difficulty as PdfExercise["difficulty"],
          orderIndex,
          durationMinutes: item.durationMinutes ?? item.defaultDurationMinutes,
          notes: item.notes,
          phase: item.phase,
          intensity: null,
          materials: item.materials,
          description: item.description,
          steps: item.steps,
          diagram: getExerciseDiagram(item.exerciseId),
          tips: item.tips,
          blockTitle: blockTitles.get(item.blockOrder) ?? null,
        };
      }
      if (item.kind === "warmup") {
        return {
          kind: "text" as const,
          name: "Descanso",
          category: "warm-up" as const,
          difficulty: "beginner" as const,
          orderIndex,
          // Si el monitor no tocó la duración se queda sin guardar (usa el
          // valor por defecto de la línea de tiempo), así que hay que
          // aplicar aquí el mismo valor por defecto o el PDF saldría sin
          // tiempo de calentamiento.
          durationMinutes: item.durationMinutes ?? DEFAULT_BLOCK_ITEM_DURATION,
          notes: item.notes,
          phase: item.phase,
          intensity: null,
          materials: [],
          description: null,
          blockTitle: blockTitles.get(item.blockOrder) ?? null,
        };
      }
      if (item.kind === "stations") {
        const stationLines = item.stations.map(
          (station, idx) =>
            `${idx + 1}. ${station.kind === "exercise" ? (station.exerciseName ?? "Ejercicio") : (station.freeText ?? "")}`
        );
        return {
          kind: "text" as const,
          name: "Estaciones",
          category: "technique" as const,
          difficulty: "beginner" as const,
          orderIndex,
          durationMinutes: item.durationMinutes ?? DEFAULT_BLOCK_ITEM_DURATION,
          notes: item.notes,
          phase: item.phase,
          intensity: null,
          materials: [],
          description: [item.introText, ...stationLines]
            .filter((v) => v && v.trim())
            .join("\n"),
          blockTitle: blockTitles.get(item.blockOrder) ?? null,
        };
      }
      return {
        kind: "text" as const,
        name: item.title || item.text || "Anotación",
        category: "technique" as const,
        difficulty: "beginner" as const,
        orderIndex,
        durationMinutes: item.durationMinutes ?? DEFAULT_BLOCK_ITEM_DURATION,
        notes: item.notes,
        phase: item.phase,
        intensity: null,
        materials: [],
        description: item.title && item.text ? item.text : item.description,
        blockTitle: blockTitles.get(item.blockOrder) ?? null,
      };
    }),
    students: studentRows,
  };
}
