import { createHash } from "node:crypto";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiDocumentEmbeddings,
  exercises,
  sessionExercises,
  sessions,
} from "@/db/schema";

export type AiEmbeddingSource = "exercise" | "session";

export interface SemanticSearchResult {
  id: string;
  source: AiEmbeddingSource;
  sourceId: string;
  ownerId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

// Voyage AI: voyage-3.5 usa 1024 dimensiones por defecto (confirmar en docs.voyageai.com).
export const AI_EMBEDDING_DIMENSIONS = 1024;
export const DEFAULT_EMBEDDING_MODEL = "voyage-3.5";

export function buildExerciseEmbeddingText(exercise: {
  name: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  description?: string | null;
  objectives?: string | null;
  tips?: string | null;
  materials?: string[] | null;
  location?: string | null;
}) {
  return [
    `Ejercicio: ${exercise.name}`,
    `Categoría: ${exercise.category}`,
    `Dificultad: ${exercise.difficulty}`,
    `Duración: ${exercise.durationMinutes} minutos`,
    exercise.location ? `Ubicación: ${exercise.location}` : null,
    exercise.objectives ? `Objetivos: ${exercise.objectives}` : null,
    exercise.description ? `Descripción: ${exercise.description}` : null,
    exercise.tips ? `Claves: ${exercise.tips}` : null,
    exercise.materials?.length
      ? `Materiales: ${exercise.materials.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSessionEmbeddingText(session: {
  title: string;
  description?: string | null;
  objective?: string | null;
  durationMinutes: number;
  intensity?: number | null;
  tags?: string[] | null;
  location?: string | null;
  exercises?: Array<{
    name: string;
    notes?: string | null;
    durationMinutes?: number | null;
  }>;
}) {
  const exerciseText = session.exercises?.length
    ? session.exercises
        .map(
          (exercise, index) =>
            `${index + 1}. ${exercise.name}${exercise.durationMinutes ? ` (${exercise.durationMinutes} min)` : ""}${exercise.notes ? ` - ${exercise.notes}` : ""}`
        )
        .join("\n")
    : null;

  return [
    `Sesión: ${session.title}`,
    `Duración: ${session.durationMinutes} minutos`,
    session.objective ? `Objetivo: ${session.objective}` : null,
    typeof session.intensity === "number"
      ? `Intensidad: ${session.intensity}/5`
      : null,
    session.location ? `Ubicación: ${session.location}` : null,
    session.tags?.length ? `Etiquetas: ${session.tags.join(", ")}` : null,
    session.description ? `Descripción: ${session.description}` : null,
    exerciseText ? `Ejercicios:\n${exerciseText}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function hashEmbeddingContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export async function createTextEmbedding(
  input: string,
  inputType: "query" | "document" = "document",
  model = process.env.AI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL
) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input, input_type: inputType }),
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== AI_EMBEDDING_DIMENSIONS) {
    throw new Error("Embedding response has unexpected dimensions");
  }
  return embedding;
}

export async function upsertAiDocumentEmbedding(input: {
  ownerId: string | null;
  source: AiEmbeddingSource;
  sourceId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
}) {
  if (input.embedding.length !== AI_EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${AI_EMBEDDING_DIMENSIONS} embedding dimensions`);
  }

  const contentHash = hashEmbeddingContent(input.content);
  const whereClause = and(
    input.ownerId
      ? eq(aiDocumentEmbeddings.ownerId, input.ownerId)
      : isNull(aiDocumentEmbeddings.ownerId),
    eq(aiDocumentEmbeddings.source, input.source),
    eq(aiDocumentEmbeddings.sourceId, input.sourceId)
  );

  const [existing] = await db
    .select({ id: aiDocumentEmbeddings.id })
    .from(aiDocumentEmbeddings)
    .where(whereClause)
    .limit(1);

  const values = {
    ownerId: input.ownerId,
    source: input.source,
    sourceId: input.sourceId,
    content: input.content,
    contentHash,
    metadata: input.metadata ?? {},
    embedding: input.embedding,
    embeddedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(aiDocumentEmbeddings)
      .set(values)
      .where(eq(aiDocumentEmbeddings.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(aiDocumentEmbeddings)
    .values(values)
    .returning({ id: aiDocumentEmbeddings.id });
  return created.id;
}

function toVectorLiteral(embedding: number[]) {
  if (embedding.length !== AI_EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${AI_EMBEDDING_DIMENSIONS} embedding dimensions`);
  }
  return `[${embedding.join(",")}]`;
}

export async function searchAiDocuments(input: {
  userId: string;
  embedding: number[];
  source?: AiEmbeddingSource;
  limit?: number;
  threshold?: number;
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 8, 20));
  const threshold = input.threshold ?? 0.72;
  const vectorParam = sql`${toVectorLiteral(input.embedding)}::extensions.vector(1536)`;
  const similarity = sql<number>`1 - (${aiDocumentEmbeddings.embedding} <=> ${vectorParam})`;

  const rows = await db
    .select({
      id: aiDocumentEmbeddings.id,
      source: aiDocumentEmbeddings.source,
      sourceId: aiDocumentEmbeddings.sourceId,
      ownerId: aiDocumentEmbeddings.ownerId,
      content: aiDocumentEmbeddings.content,
      metadata: aiDocumentEmbeddings.metadata,
      similarity,
    })
    .from(aiDocumentEmbeddings)
    .where(
      and(
        or(
          isNull(aiDocumentEmbeddings.ownerId),
          eq(aiDocumentEmbeddings.ownerId, input.userId)
        ),
        input.source
          ? eq(aiDocumentEmbeddings.source, input.source)
          : undefined,
        sql`${similarity} >= ${threshold}`
      )
    )
    .orderBy(sql`${aiDocumentEmbeddings.embedding} <=> ${vectorParam}`)
    .limit(limit);

  return rows as SemanticSearchResult[];
}

export async function searchAiDocumentsByText(input: {
  userId: string;
  query: string;
  source?: AiEmbeddingSource;
  limit?: number;
  threshold?: number;
}) {
  const embedding = await createTextEmbedding(input.query, "query");
  if (!embedding) return [];
  return searchAiDocuments({ ...input, embedding });
}

// ─── High-level embed helpers (fire-and-forget via after()) ──────────────────

export async function embedExercise(exercise: {
  id: string;
  ownerId: string | null;
  name: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  description?: string | null;
  objectives?: string | null;
  tips?: string | null;
  materials?: string[] | null;
  location?: string | null;
}) {
  const content = buildExerciseEmbeddingText(exercise);
  const embedding = await createTextEmbedding(content);
  if (!embedding) return;
  await upsertAiDocumentEmbedding({
    ownerId: exercise.ownerId,
    source: "exercise",
    sourceId: exercise.id,
    content,
    embedding,
    metadata: {
      name: exercise.name,
      category: exercise.category,
      difficulty: exercise.difficulty,
      durationMinutes: exercise.durationMinutes,
    },
  });
}

export async function embedSession(sessionId: string, userId: string) {
  const [session] = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      description: sessions.description,
      objective: sessions.objective,
      durationMinutes: sessions.durationMinutes,
      intensity: sessions.intensity,
      tags: sessions.tags,
      location: sessions.location,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) return;

  const exerciseRows = await db
    .select({
      name: exercises.name,
      durationMinutes: sessionExercises.durationMinutes,
      notes: sessionExercises.notes,
    })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(asc(sessionExercises.orderIndex));

  const content = buildSessionEmbeddingText({
    ...session,
    exercises: exerciseRows.map((e) => ({
      name: e.name,
      durationMinutes: e.durationMinutes ?? undefined,
      notes: e.notes ?? undefined,
    })),
  });

  const embedding = await createTextEmbedding(content);
  if (!embedding) return;

  await upsertAiDocumentEmbedding({
    ownerId: userId,
    source: "session",
    sourceId: sessionId,
    content,
    embedding,
    metadata: {
      title: session.title,
      durationMinutes: session.durationMinutes,
      objective: session.objective ?? undefined,
    },
  });
}
