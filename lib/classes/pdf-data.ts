import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, users } from "@/db/schema";
import { getExerciseDiagram } from "@/lib/exercise-diagrams";
import { loadClassPlan } from "@/lib/classes/plan";
import type { PdfClass, PdfExercise } from "@/lib/classes/pdf";
import { autoriaLabel } from "@/lib/exercise-taxonomy";

export type ClassRow = typeof classes.$inferSelect;

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clase"
  );
}

export async function streamToBuffer(
  stream: NodeJS.ReadableStream
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Nombre del entrenador que creó la clase (o "TenPlanner"). Usa una caché
 * opcional para no repetir la consulta al generar PDFs de varias clases. */
export async function getClassCoachName(
  createdBy: string | null,
  cache?: Map<string, string>
): Promise<string> {
  if (!createdBy) return "TenPlanner";
  const cached = cache?.get(createdBy);
  if (cached) return cached;
  const [creator] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, createdBy))
    .limit(1);
  const name = creator?.name ?? "TenPlanner";
  cache?.set(createdBy, name);
  return name;
}

/** Construye los datos de una clase para el PDF (plan de bloques y
 * ejercicios), a partir de la fila de la clase ya cargada. */
export async function buildPdfClass(
  cls: ClassRow,
  coachName: string
): Promise<PdfClass> {
  const plan = await loadClassPlan(cls.id);
  const blockTitles = new Map(
    plan.blocks.map((block) => [block.orderIndex, block.title])
  );

  const niveles =
    Array.isArray(cls.niveles) && cls.niveles.length > 0
      ? cls.niveles
      : cls.nivel
        ? [cls.nivel]
        : null;
  const aspectosJuego =
    Array.isArray(cls.aspectosJuego) && cls.aspectosJuego.length > 0
      ? cls.aspectosJuego
      : cls.aspectoJuego
        ? [cls.aspectoJuego]
        : null;

  return {
    name: cls.name,
    durationMinutes: cls.duracionMinutes,
    objetivos: cls.objetivos,
    material: cls.material,
    aspectosImportantes: cls.aspectosImportantes,
    alumnosTipo: cls.alumnosTipo as "individual" | "grupal" | null,
    numAlumnos: cls.numAlumnos,
    niveles,
    aspectosJuego,
    golpes: Array.isArray(cls.golpes) ? cls.golpes : null,
    autoriaLabel:
      cls.autoria && cls.autoria !== "libre" ? autoriaLabel(cls.autoria) : null,
    coachName,
    exercises: plan.items.map((item, orderIndex): PdfExercise => {
      if (item.kind === "exercise") {
        return {
          kind: "exercise",
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
          kind: "text",
          name: "Descanso",
          category: "warm-up",
          difficulty: "beginner",
          orderIndex,
          durationMinutes: item.durationMinutes,
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
          kind: "text",
          name: "Estaciones",
          category: "technique",
          difficulty: "beginner",
          orderIndex,
          durationMinutes: item.durationMinutes,
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
        kind: "text",
        name: item.text,
        category: "technique",
        difficulty: "beginner",
        orderIndex,
        durationMinutes: item.durationMinutes,
        notes: item.notes,
        phase: item.phase,
        intensity: null,
        materials: [],
        description: item.description,
        blockTitle: blockTitles.get(item.blockOrder) ?? null,
      };
    }),
  };
}
