import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { splitFullName } from "@/lib/students/names";
import { db } from "@/db";
import {
  users,
  sessions,
  sessionExercises,
  exercises,
  students,
  sessionStudents,
  groups,
  groupStudents,
} from "@/db/schema";
import {
  eq,
  count,
  isNull,
  inArray,
  and,
  or,
  ilike,
  desc,
  gte,
  lte,
} from "drizzle-orm";
import { z } from "zod";
import {
  listCoachStudentsSummary,
  findInactiveStudents,
  getStudentAnalytics,
  detectTrainingGaps,
  getStudentProgress,
  recommendNextSession,
  getCoachStats,
} from "@/lib/dr-planner/insights";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { getAccessibleExerciseDurationMap } from "@/lib/exercise-access";
import {
  getBooleanSetting,
  getNumberSetting,
  isDrPlannerEnabled,
} from "@/lib/app-settings";
import { searchAiDocumentsByText } from "@/lib/ai/semantic-search";
import {
  getAiAccessForUser,
  getAiRuntimeConfig,
  recordAiUsageEvent,
} from "@/lib/ai/usage";
import { embedExercise, embedSession } from "@/lib/ai/semantic-search";

export const maxDuration = 300;

const anthropic = createAnthropic({
  apiKey: process.env.NEXT_ANTHROPIC_API_KEY,
});

const EXERCISE_FIELDS = {
  id: exercises.id,
  name: exercises.name,
  category: exercises.category,
  difficulty: exercises.difficulty,
  durationMinutes: exercises.durationMinutes,
  description: exercises.description,
  objectives: exercises.objectives,
  isAiGenerated: exercises.isAiGenerated,
};

function buildUserContext(
  profile: {
    name: string;
    role: string | null;
    playerLevel: string | null;
    yearsExperience: number | null;
    city: string | null;
    goals: string | null;
  },
  sessionCount: number
) {
  const parts: string[] = [];
  if (profile.name) parts.push(`Nombre: ${profile.name}`);
  if (profile.role) parts.push(`Rol: ${profile.role}`);
  if (profile.playerLevel) parts.push(`Nivel propio: ${profile.playerLevel}`);
  if (profile.yearsExperience)
    parts.push(`Experiencia: ${profile.yearsExperience} años`);
  if (profile.city) parts.push(`Ciudad: ${profile.city}`);
  if (profile.goals) parts.push(`Objetivos: ${profile.goals}`);
  parts.push(`Sesiones planificadas: ${sessionCount}`);
  return parts.join(" | ");
}

type CoachStudent = {
  id: string;
  name: string;
  playerLevel: string | null;
  dominantHand: string | null;
  gender: string | null;
};

type SessionMetaDraft = {
  objective?: string;
  intensity?: number;
  location?: string;
  tags?: string[];
  scheduledAt?: string;
};

type ConversationState = {
  lastUserText: string;
  requestedDurationMinutes: number | null;
  objectiveFromHistory: string | null;
  selectedStudentIds: string[];
  selectedStudents: CoachStudent[];
  hasExplicitSessionConfirmation: boolean;
  confirmedSessionMeta: SessionMetaDraft;
  hasExerciseCreationConsent: boolean;
  hasDurationDeviationConsent: boolean;
  hasExercisePlanConfirmed: boolean;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isSimpleNegative(text: string): boolean {
  const normalized = normalizeText(text).replace(/[.!?]+$/g, "");
  return [
    "no",
    "nop",
    "negativo",
    "mejor no",
    "todavia no",
    "todavía no",
  ].includes(normalized);
}

function getMessageText(message: UIMessage): string {
  const parts = (message.parts ?? []) as Array<{
    type?: string;
    text?: string;
  }>;
  return parts
    .map((part) =>
      part.type === "text" && typeof part.text === "string" ? part.text : ""
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

function getUserTexts(messages: UIMessage[]): string[] {
  return messages
    .filter((message) => message.role === "user")
    .map(getMessageText)
    .filter((text) => text.length > 0);
}

function extractLastRequestedDurationMinutes(
  userTexts: string[]
): number | null {
  let found: number | null = null;
  const patterns = [
    /(\d{2,3})\s*(?:min|mins|minuto|minutos)\b/gi,
    /duraci[oó]n(?:\s+de)?\s*(\d{2,3})\b/gi,
  ];

  for (const text of userTexts) {
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const value = Number(match[1]);
        if (Number.isFinite(value) && value >= 20 && value <= 240) {
          found = value;
        }
      }
    }
  }

  return found;
}

function extractObjectiveFromHistory(userTexts: string[]): string | null {
  for (const text of [...userTexts].reverse()) {
    const match = text.match(
      /objetivo(?:\s+principal)?(?:\s+de\s+la\s+sesi[oó]n)?\s*:\s*(.+)/i
    );
    if (match?.[1]) {
      const objective = match[1].trim();
      if (objective.length > 0) return objective;
    }
  }
  return null;
}

function normalizeHour(value: string): string {
  const [h = "", m = "00"] = value.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

function normalizeDateTimeInput(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  const isoWithWords = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})\s*(?:a\s+las\s+)?(\d{1,2}:\d{2})$/i
  );
  if (isoWithWords)
    return `${isoWithWords[1]}T${normalizeHour(isoWithWords[2])}`;

  const esFormat = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*(\d{1,2}:\d{2}))?$/
  );
  if (esFormat) {
    const [, day, month, year, hourRaw] = esFormat;
    if (!hourRaw) return undefined;
    return `${year}-${month}-${day}T${normalizeHour(hourRaw)}`;
  }

  return undefined;
}

function hasSessionConfirmationPhrase(text: string): boolean {
  if (text.includes("[FORM_META_CONFIRMED]")) return true;

  const normalized = normalizeText(text);
  if (!normalized) return false;

  if (
    /(?:\bno\b|todavia no|todavía no).*(?:confirmo|confirmar|crea|crear).*(?:sesion|sesión)/.test(
      normalized
    )
  ) {
    return false;
  }

  return (
    normalized.includes("confirmo los datos de la sesion") ||
    normalized.includes("confirmo la creacion de la sesion") ||
    /\bconfirmo\b.*\b(?:sesion|sesión)\b/.test(normalized) ||
    /\b(?:crea|crear|creala|crealo|hazlo|adelante)\b.*\b(?:sesion|sesión)\b/.test(
      normalized
    ) ||
    /\b(?:puedes|podemos)\b.*\b(?:crear|crea)\b.*\b(?:sesion|sesión)\b/.test(
      normalized
    )
  );
}

function extractLastAssistantText(messages: UIMessage[]): string {
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  return lastAssistant ? normalizeText(getMessageText(lastAssistant)) : "";
}

function assistantAskedToCreateSession(messages: UIMessage[]): boolean {
  const assistantText = extractLastAssistantText(messages);
  if (!assistantText) return false;

  return (
    /necesito que confirmes.*(?:crear|creo|crea).*(?:sesion|sesión)/.test(
      assistantText
    ) ||
    /(?:puedo|puedes|quieres?(?: que)?).*(?:crear|creo|crea).*(?:sesion|sesión)/.test(
      assistantText
    ) ||
    /responde exactamente.*confirmo/.test(assistantText) ||
    /revisa y pulsa.*confirmar.*crear la sesion/.test(assistantText) ||
    /confirmar.*(?:crear|sesion)/.test(assistantText) ||
    /falta confirmacion explicita/.test(assistantText)
  );
}

function hasSessionConfirmation(
  lastUserText: string,
  messages: UIMessage[]
): boolean {
  if (hasSessionConfirmationPhrase(lastUserText)) return true;

  if (
    isSimpleAffirmation(lastUserText) &&
    assistantAskedToCreateSession(messages)
  ) {
    return true;
  }

  // Sticky: once the user has confirmed with the form marker or an explicit phrase,
  // keep confirmation valid even after follow-up messages (e.g. resolving a duration
  // mismatch with "sí"). Retraction only via explicit negation of creating the session.
  const userTexts = getUserTexts(messages);
  const hasPriorConfirmation = userTexts.some((text) =>
    hasSessionConfirmationPhrase(text)
  );

  // Simple negative ("no", "nop", etc.): without prior confirmation → no confirmation.
  // With prior confirmation → only retract if the AI was explicitly asking about creating/canceling the session.
  // Otherwise "no" is answering a different question and the prior confirmation must remain sticky.
  if (isSimpleNegative(lastUserText)) {
    if (!hasPriorConfirmation) return false;
    return !assistantAskedToCreateSession(messages);
  }

  if (!hasPriorConfirmation) return false;

  const normalizedLast = normalizeText(lastUserText);
  const retracted =
    /\b(?:no|cancela|cancelar|anula|anular|para|detente)\b.*\b(?:crear|crea|cree|cree?la|sesion|sesión)\b/.test(
      normalizedLast
    ) ||
    normalizedLast === "cancela" ||
    normalizedLast === "cancelar";

  return !retracted;
}

function parseConfirmedSessionMeta(text: string): SessionMetaDraft {
  if (!hasSessionConfirmationPhrase(text)) return {};

  // Form marker format: [FORM_META_CONFIRMED] | objetivo=... | intensidad=3 | ubicacion=... | etiquetas=a,b | fecha=2026-04-26T22:52
  const kv = (key: string) => {
    const re = new RegExp(
      `${key}\\s*[:=]\\s*([^|]+?)(?=\\s*[|,]\\s*(?:objetivo|intensidad|ubicaci[oó]n|etiquetas?|fecha)\\s*[:=]|$)`,
      "i"
    );
    return text.match(re)?.[1]?.trim();
  };

  const objective = kv("objetivo");
  const intensityRaw = text.match(/intensidad\s*[:=]\s*(\d)/i)?.[1];
  const location = kv("ubicaci[oó]n");
  const tagsRaw = kv("etiquetas?");
  const scheduledRaw = kv("fecha(?:\\s+y\\s+hora)?");
  const scheduledAt = normalizeDateTimeInput(scheduledRaw) ?? scheduledRaw;

  const intensity = intensityRaw ? Number(intensityRaw) : undefined;
  const tags = tagsRaw
    ?.split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    ...(objective ? { objective } : {}),
    ...(intensity && intensity >= 1 && intensity <= 5 ? { intensity } : {}),
    ...(location ? { location } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(scheduledAt ? { scheduledAt } : {}),
  };
}

function mapStudentNameToId(
  name: string,
  coachStudents: CoachStudent[]
): string | null {
  const target = normalizeText(name);
  const exact = coachStudents.find(
    (student) => normalizeText(student.name) === target
  );
  if (exact) return exact.id;

  const partial = coachStudents.find(
    (student) =>
      normalizeText(student.name).includes(target) ||
      target.includes(normalizeText(student.name))
  );
  return partial?.id ?? null;
}

function inferSelectedStudentIds(
  userTexts: string[],
  coachStudents: CoachStudent[]
): string[] {
  for (const text of [...userTexts].reverse()) {
    const normalized = normalizeText(text);
    if (normalized.includes("continuar sin seleccionar alumnos")) {
      return [];
    }

    const match = text.match(/he seleccionado a:\s*(.+)$/i);
    if (!match?.[1]) continue;

    const names = match[1]
      .split(",")
      .map((chunk) => chunk.replace(/\([^)]*\)/g, "").trim())
      .filter((chunk) => chunk.length > 0);

    const ids = names
      .map((name) => mapStudentNameToId(name, coachStudents))
      .filter((id): id is string => Boolean(id));

    return Array.from(new Set(ids));
  }

  return [];
}

function isSimpleAffirmation(text: string): boolean {
  const normalized = normalizeText(text).replace(/[.!?]+$/g, "");
  return [
    "si",
    "sí",
    "ok",
    "vale",
    "dale",
    "adelante",
    "hazlo",
    "de acuerdo",
    "perfecto",
    "acepto",
    "listo",
    "confirmado",
    "confirmo",
  ].includes(normalized);
}

function getPreviousAssistantText(
  messages: UIMessage[],
  userIndex: number
): string {
  for (let i = userIndex - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "assistant") {
      return normalizeText(getMessageText(messages[i]));
    }
  }
  return "";
}

function assistantAskedToCreateExercises(messages: UIMessage[]): boolean {
  const assistantText = extractLastAssistantText(messages);
  return (
    /quieres que (?:cree|genere)/.test(assistantText) ||
    /crear ejercicios?/.test(assistantText) ||
    /generar ejercicios?/.test(assistantText) ||
    /crear nuevos ejercicios?/.test(assistantText)
  );
}

function assistantTextAsksToAllowDurationDeviation(
  assistantText: string
): boolean {
  if (!assistantText) return false;

  return (
    /(te (?:vale|va bien|parece bien)|aceptas|confirmas).*(?:\d{2,3}\s*(?:min|minutos)?|pasarnos|pasarse|mas|minutos|min)/.test(
      assistantText
    ) ||
    /(?:podemos|puedo).*(?:pasarnos|pasarse|irnos).*(?:min|minutos)/.test(
      assistantText
    ) ||
    /la propuesta suma.*objetivo era/.test(assistantText)
  );
}

function hasExerciseCreationConsent(
  lastUserText: string,
  messages: UIMessage[]
): boolean {
  const normalized = normalizeText(lastUserText);
  if (!normalized) return false;
  if (/\bno\b.*\b(crea|crear|genera|generar)\b/.test(normalized)) return false;

  if (
    isSimpleAffirmation(lastUserText) &&
    assistantAskedToCreateExercises(messages)
  ) {
    return true;
  }

  return (
    /\b(crea|crear|genera|generar)\b.*\b(ejercicio|ejercicios)\b/.test(
      normalized
    ) ||
    /\b(puedes|podemos|ok|vale|dale|si|sí)\b.*\b(crea|crear|genera|generar)\b/.test(
      normalized
    ) ||
    /\b(autorizo|apruebo|acepto)\b.*\b(crear|generar)\b/.test(normalized)
  );
}

function extractLatestConfirmedSessionMeta(
  userTexts: string[]
): SessionMetaDraft {
  for (const text of [...userTexts].reverse()) {
    if (!hasSessionConfirmationPhrase(text)) continue;
    return parseConfirmedSessionMeta(text);
  }

  return {};
}

function inferDurationDeviationConsentFromHistory(
  messages: UIMessage[]
): boolean {
  // Token-based check: button in the UI sends this explicit marker
  for (const m of messages) {
    if (
      m.role === "user" &&
      getMessageText(m).includes("[DURATION_CONSENT_GRANTED]")
    )
      return true;
    if (
      m.role === "user" &&
      getMessageText(m).includes("[DURATION_CONSENT_DECLINED]")
    )
      return false;
  }

  let consent = false;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message.role !== "user") continue;

    const text = getMessageText(message);
    const normalized = normalizeText(text);
    if (!normalized) continue;

    if (
      /\bno\b.*\b(pasarse|pasar|mas|minutos|min|acepto|autorizo|permito)\b/.test(
        normalized
      )
    ) {
      consent = false;
      continue;
    }

    if (
      /\b(acepto|autorizo|permito|me vale|esta bien|sin problema|puede ser|adelante)\b.*\b(pasarse|pasar|mas|minutos|min)\b/.test(
        normalized
      ) ||
      /\b(acepto|me vale|esta bien|ok|vale)\b.*\b\d{1,3}\s*(?:min|minutos)?\b/.test(
        normalized
      )
    ) {
      consent = true;
      continue;
    }

    if (isSimpleNegative(text)) {
      const previousAssistantText = getPreviousAssistantText(messages, i);
      if (assistantTextAsksToAllowDurationDeviation(previousAssistantText)) {
        consent = false;
      }
      continue;
    }

    if (isSimpleAffirmation(text)) {
      const previousAssistantText = getPreviousAssistantText(messages, i);
      if (assistantTextAsksToAllowDurationDeviation(previousAssistantText)) {
        consent = true;
      }
    }
  }

  return consent;
}

function inferConversationState(
  messages: UIMessage[],
  coachStudents: CoachStudent[]
): ConversationState {
  const userTexts = getUserTexts(messages);
  const lastUserText = userTexts[userTexts.length - 1] ?? "";
  const selectedStudentIds = inferSelectedStudentIds(userTexts, coachStudents);
  const selectedStudents = coachStudents.filter((student) =>
    selectedStudentIds.includes(student.id)
  );

  return {
    lastUserText,
    requestedDurationMinutes: extractLastRequestedDurationMinutes(userTexts),
    objectiveFromHistory: extractObjectiveFromHistory(userTexts),
    selectedStudentIds,
    selectedStudents,
    hasExplicitSessionConfirmation: hasSessionConfirmation(
      lastUserText,
      messages
    ),
    confirmedSessionMeta: extractLatestConfirmedSessionMeta(userTexts),
    hasExerciseCreationConsent: hasExerciseCreationConsent(
      lastUserText,
      messages
    ),
    hasDurationDeviationConsent:
      inferDurationDeviationConsentFromHistory(messages),
    hasExercisePlanConfirmed: userTexts.some((t) =>
      t.includes("[EXERCISES_CONFIRMED]")
    ),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const drPlannerEnabled = await isDrPlannerEnabled();
  if (!drPlannerEnabled) {
    return NextResponse.json(
      { error: "Dr. Planner está desactivado." },
      { status: 403 }
    );
  }

  const aiAccess = await getAiAccessForUser(userId);
  if (!aiAccess.allowed) {
    return NextResponse.json(
      {
        error: aiAccess.message,
        reason: aiAccess.reason,
        dailyTokens: aiAccess.dailyTokens,
        monthlyTokens: aiAccess.monthlyTokens,
      },
      { status: 403 }
    );
  }

  const aiRuntime = await getAiRuntimeConfig(
    aiAccess.restriction?.modelOverride
  );

  // Rate limit: 30 chat turns/min per user (prevents credit drain)
  const rl = await rateLimit(`dr-planner:${userId}`, 30, 60_000);
  if (!rl.ok) return tooManyRequestsResponse(rl);

  const [
    profileRows,
    countRows,
    personalExerciseCountRows,
    globalExerciseCountRows,
    coachStudents,
  ] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select({ total: count() })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    db
      .select({ total: count() })
      .from(exercises)
      .where(eq(exercises.createdBy, userId)),
    db
      .select({ total: count() })
      .from(exercises)
      .where(or(eq(exercises.isGlobal, true), isNull(exercises.createdBy))),
    db
      .select({
        id: students.id,
        name: students.name,
        playerLevel: students.playerLevel,
        dominantHand: students.dominantHand,
        gender: students.gender,
      })
      .from(students)
      .where(eq(students.coachId, userId)),
  ]);

  const personalExerciseCount = Number(
    personalExerciseCountRows[0]?.total ?? 0
  );
  const globalExerciseCount = Number(globalExerciseCountRows[0]?.total ?? 0);

  const profile = profileRows[0];
  const sessionCount = Number(countRows[0]?.total ?? 0);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowISO = tomorrow.toISOString().slice(0, 16);
  const todayStr = today.toISOString().slice(0, 10);

  const hasStudents = coachStudents.length > 0;
  const requestBody = (await request.json()) as {
    messages: UIMessage[];
    chatId?: string;
    modelMode?: string;
  };
  const { messages } = requestBody;
  const chatIdResult = z.string().uuid().safeParse(requestBody.chatId);
  const chatId = chatIdResult.success ? chatIdResult.data : null;

  const MODEL_MODE_MAP: Record<string, string> = {
    reasoning: "claude-sonnet-4-6",
    rapido: "claude-haiku-4-5",
  };
  const userModelOverride = requestBody.modelMode
    ? (MODEL_MODE_MAP[requestBody.modelMode] ?? null)
    : null;
  const activeDrPlannerModel = userModelOverride ?? aiRuntime.drPlannerModel;
  const conversationState = inferConversationState(
    messages,
    coachStudents as CoachStudent[]
  );
  const semanticSearchEnabled = await getBooleanSetting(
    "ai.semantic_search_enabled"
  );
  const sessionCreationEnabled = await getBooleanSetting(
    "feature.session_creation_enabled"
  );
  const exerciseCreationEnabled = await getBooleanSetting(
    "feature.exercise_creation_enabled"
  );
  const publicExercisesEnabled = await getBooleanSetting(
    "feature.public_exercises_enabled"
  );

  async function generateTrackedInsight({
    prompt,
    operation,
    maxOutputTokens = 220,
    temperature = 0.35,
  }: {
    prompt: string;
    operation: string;
    maxOutputTokens?: number;
    temperature?: number;
  }) {
    const result = await generateText({
      model: anthropic(aiRuntime.reasoningModel),
      maxOutputTokens,
      temperature,
      prompt,
    });

    await recordAiUsageEvent({
      userId,
      chatId,
      provider: aiRuntime.provider,
      model: aiRuntime.reasoningModel,
      operation,
      usage: result.usage,
      pricingJson: aiRuntime.pricingJson,
      finishReason: result.finishReason,
      metadata: { source: "dr_planner_tool" },
    });

    return result.text;
  }

  const selectedStudentsSummary =
    conversationState.selectedStudents.length > 0
      ? conversationState.selectedStudents
          .map(
            (student) =>
              `${student.name}${student.playerLevel ? ` (${student.playerLevel})` : ""}`
          )
          .join(", ")
      : "No confirmados todavía";

  const confirmedObjective =
    conversationState.confirmedSessionMeta.objective ??
    conversationState.objectiveFromHistory;

  const isFirstTurn = messages.filter((m) => m.role === "user").length <= 1;

  // Split stable vs dynamic so Anthropic prompt caching can hit the long static part.
  const systemStable = `Eres Dr. Planner, asistente experto en diseño de sesiones para deportes de raqueta. Hablas español, directo y breve. Sin emojis.

## Estilo
- Máximo 3-4 frases por turno. El plan va en \`mostrar_ejercicios\` + \`configurar_sesion_meta\`, NO en texto.
- Markdown ligero: **negrita** para énfasis. Nada de recuentos ni resúmenes de lo hecho.
- Si no hace falta escribir, no escribas.
- Nunca vuelques en texto datos que una tool puede renderizar como tarjeta.

## Casos típicos (mapa entrada → acción)
Usa esta tabla como guía rápida. Si la petición encaja con un caso, dispara las tools que indica sin preguntar cosas obvias.

| Entrada del usuario | Qué haces |
|---|---|
| Solo saluda ("hola", "buenas") en turno inicial | Paralelo: \`estadisticas_globales\` + \`alumnos_inactivos\`. Renderiza con \`mostrar_insights\` (máx 4 items accionables). Una sola línea final: "Dime en qué te ayudo". |
| Pide algo concreto desde el primer turno ("diseña sesión para X", "busca ejercicios de volea") | Responde directo a esa petición. **NO** metas insights genéricos de relleno. |
| Menciona un alumno por nombre | \`analizar_alumno\` con su id. Muestra el resultado como tarjeta — no lo resumas. |
| "¿A quién llevo más tiempo sin entrenar?" / "¿Qué alumnos están parados?" | \`alumnos_inactivos\` → \`mostrar_insights\`. |
| "¿Qué tal voy este mes?" / "Dame mis números" | \`estadisticas_globales\` → \`mostrar_insights\` con 2-3 stats clave. |
| "¿Qué debería entrenar con X?" / "Proponme algo para X" | \`recomendar_proxima_sesion\` con studentIds. Si quieres justificación, pide \`generarInsight: true\`. |
| "¿En qué falla X?" / "¿Qué le falta a X?" | \`gaps_de_entrenamiento\` con su studentId. |
| "¿Cómo va X estos meses?" / "Progreso de X" | \`progreso_alumno\` con su studentId. |
| "Como la sesión de la semana pasada pero..." / "Hicimos algo parecido" | \`buscar_sesiones_similares\` (query/duracionMinutos) — usa el mejor match como plantilla. |
| "Ejercicios de [categoría/nivel/duración]" | \`buscar_ejercicios_avanzado\` con los filtros → \`mostrar_ejercicios\` con resultados. |
| No conoce el nombre del ejercicio pero lo describe | \`buscar_contexto\` libre, luego \`mostrar_ejercicios\`. |
| "Diseña una sesión" sin alumnos seleccionados | Si la lista de alumnos tiene elementos → \`seleccionar_alumnos\` ya. Si está vacía → ofrece crear uno o diseñar genérica. |

## Flujo (diseño de sesión)
1. Si hay alumnos y aún no se han seleccionado → \`seleccionar_alumnos\`. No preguntes en texto.
2. Recopila lo que falte (nivel, duración, objetivo) con \`<preguntas>\`. Nada de preguntas repetidas.
3. Diseña el plan. Muéstralo con \`mostrar_ejercicios\`. Escribe solo: "Revisa el plan y pulsa **Confirmar plan** cuando estés listo." Y PARA — **NO llames a \`configurar_sesion_meta\` ni a ninguna otra tool en este mismo turno.**
4. Cuando el usuario envíe \`[EXERCISES_CONFIRMED]\` → \`configurar_sesion_meta\` con TODOS los campos ya conocidos prellenados. Escribe solo: "Revisa y pulsa **Confirmar** para crear la sesión." Y PARA.
5. Cuando el usuario envíe \`[FORM_META_CONFIRMED]\` → \`crear_sesion\` inmediatamente.
6. Tras \`crear_sesion\` exitoso: una sola frase de cierre ("Creada. Suerte con la pista.") — sin recapitular nada.

**PROHIBIDO**: \`configurar_sesion_meta\` en el mismo turno que \`mostrar_ejercicios\`. Son pasos distintos con confirmación del usuario entre medias.

## Datos: dónde buscar qué
| Necesitas | Tool |
|---|---|
| Lista resumida de alumnos | \`listar_alumnos_resumen\` |
| Perfil profundo de un alumno | \`analizar_alumno\` |
| Huecos en las últimas 8 semanas | \`gaps_de_entrenamiento\` |
| Serie temporal (6 meses) | \`progreso_alumno\` |
| Alumnos sin entrenar (≥N días) | \`alumnos_inactivos\` |
| Numeritos del coach | \`estadisticas_globales\` |
| Sesiones previas como plantilla | \`buscar_sesiones_similares\` |
| Biblioteca personal + global | \`buscar_ejercicios_avanzado\` (filtros) o \`buscar_contexto\` (libre) |
| Propuesta razonada | \`recomendar_proxima_sesion\` |
| Panel visual de observaciones | \`mostrar_insights\` |

El contexto inyectado en este prompt ya te dice número total de alumnos y tamaño de biblioteca. **NO llames a tools para reconfirmar esos conteos.**

## Reglas estrictas (no negociables)
- NO llames a \`crear_sesion\` sin confirmación explícita del usuario en su último mensaje.
- \`[FORM_META_CONFIRMED]\` ES confirmación explícita.
- Un "sí" breve cuenta solo si acabas de preguntar directamente.
- NO llames a \`crear_ejercicio\` sin haber mostrado antes la spec y recibido aprobación.
- NO vuelvas a llamar a \`seleccionar_alumnos\` si ya hay alumnos seleccionados.
- Si la duración del plan difiere de la pedida y no hay permiso → ajusta o pregunta.
- Máx. 3 \`crear_ejercicio\` por turno.
- Para alumnos: usa \`<preguntas>\` (nombre, nivel) antes de \`crear_alumno\`. Nunca inventes nombres.
- En \`crear_sesion\`: cada ejercicio DEBE llevar \`phase\` (activation/main/cooldown) e \`intensity\` (1-5). Guía: activación 1-2, principal 3-5 (pico y bajada), cooldown 1-2.
- Si una tool devuelve pocos/ningún resultado, dilo y sugiere alternativa (ampliar filtros, crear ejercicio nuevo…). No inventes datos.

## Preguntas interactivas
Cuando necesites datos, añade al FINAL del mensaje:
\`<preguntas>[{"id":"duracion","label":"Duración (min)","tipo":"numero"},{"id":"nivel","label":"Nivel","tipo":"select","opciones":["principiante","amateur","intermedio","avanzado","competición"]}]</preguntas>\``;

  const systemDynamic = `## Estado actual
- Turno inicial: ${isFirstTurn ? "SÍ (muestra insights proactivos si no hay petición concreta)" : "no"}
- Duración objetivo: ${conversationState.requestedDurationMinutes ?? "—"}
- Objetivo: ${confirmedObjective ?? "—"}
- Alumnos seleccionados: ${selectedStudentsSummary}
- Confirmación crear sesión: ${conversationState.hasExplicitSessionConfirmation ? "SÍ → llama ya a crear_sesion" : "NO"}
- Plan de ejercicios confirmado: ${conversationState.hasExercisePlanConfirmed ? "SÍ → llama ya a configurar_sesion_meta" : "NO (espera [EXERCISES_CONFIRMED])"}
- Aprobación ejercicios pendiente: ${conversationState.hasExerciseCreationConsent ? "SÍ" : "NO"}
- Permiso desviar duración: ${conversationState.hasDurationDeviationConsent ? "SÍ" : "NO"}
- Fecha de hoy: ${todayStr} · Fecha por defecto: ${tomorrowISO}
- Meta ya confirmada del formulario: ${JSON.stringify(conversationState.confirmedSessionMeta)}

## Perfil del entrenador
${profile ? buildUserContext(profile, sessionCount) : "Sin datos"}

## Contexto agregado (pide detalles por tool cuando los necesites)
- Alumnos registrados: ${coachStudents.length}${hasStudents ? "" : " (sin alumnos — puedes ofrecer crear uno)"}
- Ejercicios en biblioteca personal: ${personalExerciseCount}
- Ejercicios en biblioteca global: ${globalExerciseCount}
- Búsqueda semántica con embeddings: ${semanticSearchEnabled ? "ACTIVA" : "desactivada"}
- Creación de sesiones: ${sessionCreationEnabled ? "ACTIVA" : "bloqueada por administración"}
- Creación de ejercicios: ${exerciseCreationEnabled ? "ACTIVA" : "bloqueada por administración"}
- Biblioteca global: ${publicExercisesEnabled ? "ACTIVA" : "bloqueada por administración"}
- Modelo principal IA: ${activeDrPlannerModel}
- Modelo análisis IA: ${aiRuntime.reasoningModel}
- Uso del usuario hoy: ${aiAccess.dailyTokens.toLocaleString("es-ES")} tokens${aiAccess.dailyLimit > 0 ? ` / límite ${aiAccess.dailyLimit.toLocaleString("es-ES")}` : ""}
- Uso del usuario este mes: ${aiAccess.monthlyTokens.toLocaleString("es-ES")} tokens${aiAccess.monthlyLimit > 0 ? ` / límite ${aiAccess.monthlyLimit.toLocaleString("es-ES")}` : ""}`;

  let createExerciseCalls = 0;

  const result = streamText({
    model: anthropic(activeDrPlannerModel),
    system: `${systemStable}\n\n${systemDynamic}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: aiRuntime.maxOutputTokens,
    temperature: aiRuntime.temperature,
    stopWhen: stepCountIs(20),
    onFinish: async (event) => {
      await recordAiUsageEvent({
        userId,
        chatId,
        provider: aiRuntime.provider,
        model: activeDrPlannerModel,
        operation: "dr_planner_chat",
        usage: event.totalUsage,
        pricingJson: aiRuntime.pricingJson,
        finishReason: event.finishReason,
        metadata: {
          steps: event.steps.length,
          requestedModel: activeDrPlannerModel,
        },
      });
    },
    tools: {
      mostrar_ejercicios: {
        description:
          "Presenta ejercicios como tarjetas interactivas. Usar siempre en lugar de listar ejercicios en texto.",
        inputSchema: z.object({
          ejercicios: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              category: z.enum(["technique", "tactics", "fitness", "warm-up"]),
              difficulty: z.enum(["beginner", "intermediate", "advanced"]),
              durationMinutes: z.number(),
              description: z.string().optional(),
              objectives: z.string().optional(),
              isAiGenerated: z.boolean().optional(),
              isPersonal: z.boolean().optional(),
            })
          ),
        }),
        execute: async (input) => input,
      },
      crear_ejercicio: {
        description:
          "Crea y guarda un ejercicio nuevo en la biblioteca personal del entrenador, marcado como generado por IA.",
        inputSchema: z.object({
          name: z.string(),
          description: z.string(),
          category: z.enum(["technique", "tactics", "fitness", "warm-up"]),
          difficulty: z.enum(["beginner", "intermediate", "advanced"]),
          durationMinutes: z.number().int().min(1),
          objectives: z.string().optional(),
          tips: z.string().optional(),
          materials: z.array(z.string()).optional(),
        }),
        execute: async ({
          name,
          description,
          category,
          difficulty,
          durationMinutes,
          objectives,
          tips,
          materials,
        }) => {
          if (createExerciseCalls >= 3) {
            return {
              ok: false,
              error:
                "Máximo de 3 ejercicios creados por turno. Continúa en el siguiente mensaje.",
            };
          }

          if (!exerciseCreationEnabled) {
            return {
              ok: false,
              error:
                "La creación de ejercicios está desactivada desde administración.",
            };
          }

          createExerciseCalls += 1;

          try {
            const [created] = await db
              .insert(exercises)
              .values({
                name,
                description,
                category,
                difficulty,
                durationMinutes,
                objectives: objectives ?? null,
                tips: tips ?? null,
                materials: materials ?? null,
                isAiGenerated: true,
                createdBy: user.id,
              })
              .returning({ id: exercises.id, name: exercises.name });
            void embedExercise({
              id: created.id,
              ownerId: user.id,
              name,
              category,
              difficulty,
              durationMinutes,
              description,
              objectives,
              tips,
              materials,
            }).catch(console.error);
            return { ok: true, id: created.id, name: created.name };
          } catch (err) {
            console.error("[Dr. Planner] crear_ejercicio:", err);
            return { ok: false, error: "No se pudo guardar el ejercicio" };
          }
        },
      },
      crear_sesion: {
        description:
          "Crea la sesión de entrenamiento completa en el sistema con título, fecha, hora y ejercicios.",
        inputSchema: z.object({
          title: z.string().describe("Título descriptivo de la sesión"),
          description: z
            .string()
            .optional()
            .describe("Descripción breve del objetivo de la sesión"),
          scheduledAt: z
            .string()
            .describe(
              `Fecha y hora en formato ISO, por defecto ${tomorrowISO}`
            ),
          objective: z
            .string()
            .optional()
            .describe("Objetivo principal de la sesión"),
          intensity: z
            .number()
            .int()
            .min(1)
            .max(5)
            .optional()
            .describe("Intensidad global 1-5"),
          tags: z
            .array(z.string())
            .optional()
            .describe("Etiquetas de la sesión"),
          location: z.string().optional().describe("Ubicación de la sesión"),
          studentIds: z
            .array(z.string())
            .optional()
            .describe("IDs de los alumnos asignados a esta sesión"),
          exercises: z
            .array(
              z.object({
                id: z.string().describe("ID del ejercicio de la biblioteca"),
                notes: z
                  .string()
                  .optional()
                  .describe(
                    "Notas específicas para este ejercicio en la sesión"
                  ),
                phase: z
                  .enum(["activation", "main", "cooldown"])
                  .optional()
                  .describe("Fase del entrenamiento"),
                intensity: z
                  .number()
                  .int()
                  .min(1)
                  .max(5)
                  .optional()
                  .describe("Intensidad específica del ejercicio"),
              })
            )
            .describe("Ejercicios en orden con sus IDs"),
        }),
        execute: async ({
          title,
          description,
          scheduledAt,
          objective,
          intensity,
          tags,
          location,
          studentIds,
          exercises: exerciseList,
        }) => {
          type ExerciseEntry = {
            id: string;
            notes?: string;
            phase?: "activation" | "main" | "cooldown";
            intensity?: number;
          };
          const typedList = exerciseList as ExerciseEntry[];

          if (!conversationState.hasExplicitSessionConfirmation) {
            return {
              ok: false,
              error:
                "Falta confirmación explícita del entrenador para crear la sesión.",
            };
          }

          if (!sessionCreationEnabled) {
            return {
              ok: false,
              error:
                "La creación de sesiones está desactivada desde administración.",
            };
          }

          if (typedList.length === 0) {
            return {
              ok: false,
              error: "La sesión debe incluir al menos un ejercicio.",
            };
          }

          try {
            const ids = typedList.map((e) => e.id);
            const { durationById: durMap, inaccessibleIds } =
              await getAccessibleExerciseDurationMap(user.id, ids);
            if (inaccessibleIds.length > 0) {
              return {
                ok: false,
                error:
                  "Hay ejercicios no válidos en el plan. Revisa los ejercicios seleccionados.",
              };
            }

            const totalDuration = ids.reduce(
              (sum: number, id: string) => sum + (durMap.get(id) ?? 0),
              0
            );

            if (
              conversationState.requestedDurationMinutes !== null &&
              totalDuration !== conversationState.requestedDurationMinutes &&
              !conversationState.hasDurationDeviationConsent
            ) {
              const delta =
                totalDuration - conversationState.requestedDurationMinutes;
              const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
              return {
                ok: false,
                code: "DURATION_MISMATCH",
                totalDuration,
                requestedDuration: conversationState.requestedDurationMinutes,
                delta,
                error: `Duración propuesta: ${totalDuration} min (objetivo: ${conversationState.requestedDurationMinutes} min, diferencia: ${deltaLabel} min). Confirma si el entrenador acepta la diferencia o ajusta los ejercicios.`,
              };
            }

            const finalStudentIds =
              conversationState.selectedStudentIds.length > 0
                ? conversationState.selectedStudentIds
                : (studentIds ?? []);

            const finalObjective =
              conversationState.confirmedSessionMeta.objective ??
              conversationState.objectiveFromHistory ??
              objective ??
              null;
            const finalIntensity =
              conversationState.confirmedSessionMeta.intensity ??
              intensity ??
              null;
            const finalTags =
              conversationState.confirmedSessionMeta.tags ?? tags ?? null;
            const finalLocation =
              conversationState.confirmedSessionMeta.location ??
              location ??
              null;
            const finalScheduledAt =
              conversationState.confirmedSessionMeta.scheduledAt ?? scheduledAt;
            const parsedScheduledAt = new Date(finalScheduledAt);

            if (Number.isNaN(parsedScheduledAt.getTime())) {
              return {
                ok: false,
                error:
                  "La fecha/hora de la sesión no es válida. Revisa el formulario y confirma de nuevo.",
              };
            }

            const maxSessionsPerUser = await getNumberSetting(
              "system.max_sessions_per_user",
              0
            );
            if (maxSessionsPerUser > 0) {
              const [currentCount] = await db
                .select({ total: count() })
                .from(sessions)
                .where(eq(sessions.userId, user.id));
              if (Number(currentCount?.total ?? 0) >= maxSessionsPerUser) {
                return {
                  ok: false,
                  error: "Has alcanzado el límite de sesiones de tu cuenta.",
                };
              }
            }

            const [session] = await db
              .insert(sessions)
              .values({
                createdVia: "dr_planner",
                title,
                description: description ?? null,
                scheduledAt: parsedScheduledAt,
                durationMinutes: totalDuration,
                userId: user.id,
                objective: finalObjective,
                intensity: finalIntensity,
                tags: finalTags,
                location: finalLocation,
              })
              .returning({ id: sessions.id, title: sessions.title });

            if (typedList.length > 0) {
              const phaseDefault = (
                phase?: "activation" | "main" | "cooldown"
              ) => {
                if (phase === "activation") return 2;
                if (phase === "cooldown") return 1;
                return finalIntensity ?? 3;
              };
              await db.insert(sessionExercises).values(
                typedList.map((e, i) => ({
                  sessionId: session.id,
                  exerciseId: e.id,
                  orderIndex: i,
                  durationMinutes: durMap.get(e.id) ?? null,
                  notes: e.notes ?? null,
                  phase: e.phase ?? null,
                  intensity: e.intensity ?? phaseDefault(e.phase),
                }))
              );
            }

            if (finalStudentIds.length > 0) {
              const validStudents = await db
                .select({ id: students.id })
                .from(students)
                .where(
                  and(
                    inArray(students.id, finalStudentIds),
                    eq(students.coachId, user.id)
                  )
                );
              const validIds = validStudents.map((s) => s.id);
              if (validIds.length > 0) {
                await db.insert(sessionStudents).values(
                  validIds.map((studentId) => ({
                    sessionId: session.id,
                    studentId,
                  }))
                );
              }
            }

            void embedSession(session.id, user.id).catch(console.error);
            return {
              ok: true,
              sessionId: session.id,
              title: session.title,
              totalDuration,
            };
          } catch (err) {
            console.error("[Dr. Planner] crear_sesion:", err);
            return { ok: false, error: "No se pudo crear la sesión" };
          }
        },
      },
      seleccionar_alumnos: {
        description:
          "Muestra un selector interactivo de alumnos en la UI. Llamar al inicio de una conversación de diseño de sesión cuando hay alumnos disponibles.",
        inputSchema: z.object({
          estudiantes: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              playerLevel: z.string().nullable().optional(),
              gender: z.string().nullable().optional(),
              dominantHand: z.string().nullable().optional(),
            })
          ),
          pregunta: z
            .string()
            .optional()
            .describe("Pregunta opcional para mostrar encima del selector"),
        }),
        execute: async (input) => input,
      },
      crear_alumno: {
        description:
          "Crea un perfil de alumno rápido con nombre y nivel. Usar solo cuando el entrenador confirme que quiere crear un alumno.",
        inputSchema: z.object({
          name: z.string().describe("Nombre del alumno"),
          // Códigos de skill_levels (antes solo admitía la escala antigua,
          // que la FK de la migración 0094 ya no acepta).
          playerLevel: z
            .enum([
              "descubrimiento",
              "desarrollo",
              "consolidacion",
              "especializacion",
              "precompeticion",
              "competicion",
              "adultos_iniciacion",
              "adultos_medio_alto",
            ])
            .optional(),
          notes: z.string().optional(),
        }),
        execute: async ({ name, playerLevel, notes }) => {
          try {
            const [created] = await db
              .insert(students)
              .values({
                coachId: user.id,
                name,
                ...splitFullName(name),
                playerLevel: playerLevel ?? null,
                notes: notes ?? null,
              })
              .returning({ id: students.id, name: students.name });
            return { ok: true, id: created.id, name: created.name };
          } catch (err) {
            console.error("[Dr. Planner] crear_alumno:", err);
            return { ok: false, error: "No se pudo crear el alumno" };
          }
        },
      },
      configurar_sesion_meta: {
        description:
          "Muestra un formulario interactivo con los metadatos de la sesión para que el entrenador los revise antes de crear la sesión. Llamar ANTES de crear_sesion.",
        inputSchema: z.object({
          objective: z
            .string()
            .optional()
            .describe("Objetivo principal de la sesión"),
          intensity: z
            .number()
            .int()
            .min(1)
            .max(5)
            .optional()
            .describe("Intensidad global 1-5"),
          tags: z.array(z.string()).optional().describe("Etiquetas"),
          location: z.string().optional().describe("Ubicación"),
          scheduledAt: z.string().optional().describe("Fecha y hora ISO"),
          durationMinutes: z
            .number()
            .optional()
            .describe("Duración estimada en minutos"),
        }),
        execute: async (input) => input,
      },
      buscar_contexto: {
        description:
          "Busca en la biblioteca de ejercicios, sesiones pasadas o alumnos del entrenador para referenciarlos. Llamar cuando el entrenador mencione algo con @ o cuando necesites datos de una sesión o alumno específico.",
        inputSchema: z.object({
          tipo: z
            .enum(["ejercicio", "sesion", "alumno", "todos"])
            .default("todos"),
          query: z.string().describe("Nombre o texto de búsqueda"),
        }),
        execute: async ({ tipo, query }) => {
          const q = query.toLowerCase();
          const semanticSources =
            tipo === "ejercicio"
              ? (["exercise"] as const)
              : tipo === "sesion"
                ? (["session"] as const)
                : tipo === "todos"
                  ? (["exercise", "session"] as const)
                  : ([] as const);
          const semanticResults = semanticSearchEnabled
            ? (
                await Promise.all(
                  semanticSources.map((source) =>
                    searchAiDocumentsByText({
                      userId: user.id,
                      query,
                      source,
                      limit: source === "exercise" ? 6 : 4,
                    }).catch(() => [])
                  )
                )
              ).flat()
            : [];

          if (tipo === "todos") {
            const [exResults, sesResults] = await Promise.all([
              db
                .select({
                  id: exercises.id,
                  name: exercises.name,
                  category: exercises.category,
                  difficulty: exercises.difficulty,
                  durationMinutes: exercises.durationMinutes,
                  isAiGenerated: exercises.isAiGenerated,
                })
                .from(exercises)
                .where(
                  publicExercisesEnabled
                    ? or(
                        eq(exercises.createdBy, user.id),
                        eq(exercises.isGlobal, true),
                        isNull(exercises.createdBy)
                      )
                    : eq(exercises.createdBy, user.id)
                )
                .limit(20),
              db
                .select({
                  id: sessions.id,
                  title: sessions.title,
                  scheduledAt: sessions.scheduledAt,
                  durationMinutes: sessions.durationMinutes,
                  objective: sessions.objective,
                })
                .from(sessions)
                .where(
                  and(
                    eq(sessions.userId, user.id),
                    ilike(sessions.title, `%${query}%`)
                  )
                )
                .orderBy(desc(sessions.scheduledAt))
                .limit(5),
            ]);
            const ejercicios = exResults
              .filter((e) => e.name.toLowerCase().includes(q))
              .slice(0, 3);
            const alumnos = coachStudents
              .filter((s) => s.name.toLowerCase().includes(q))
              .slice(0, 3);
            return {
              resultados: [
                ...ejercicios.map((e) => ({ tipo: "ejercicio", ...e })),
                ...sesResults.map((s) => ({ tipo: "sesion", ...s })),
                ...alumnos.map((a) => ({ tipo: "alumno", ...a })),
              ],
              resultados_semanticos: semanticResults.map((item) => ({
                tipo: item.source === "exercise" ? "ejercicio" : "sesion",
                id: item.sourceId,
                similarity: item.similarity,
                content: item.content,
                metadata: item.metadata,
              })),
            };
          }
          if (tipo === "ejercicio") {
            const results = await db
              .select({
                id: exercises.id,
                name: exercises.name,
                category: exercises.category,
                difficulty: exercises.difficulty,
                durationMinutes: exercises.durationMinutes,
                description: exercises.description,
                objectives: exercises.objectives,
                isAiGenerated: exercises.isAiGenerated,
              })
              .from(exercises)
              .where(
                publicExercisesEnabled
                  ? or(
                      eq(exercises.createdBy, user.id),
                      eq(exercises.isGlobal, true),
                      isNull(exercises.createdBy)
                    )
                  : eq(exercises.createdBy, user.id)
              )
              .limit(20);
            const filtered = results.filter((e) =>
              e.name.toLowerCase().includes(q)
            );
            return {
              tipo: "ejercicio",
              resultados: filtered.slice(0, 5),
              resultados_semanticos: semanticResults.map((item) => ({
                id: item.sourceId,
                similarity: item.similarity,
                content: item.content,
                metadata: item.metadata,
              })),
            };
          } else if (tipo === "sesion") {
            const results = await db
              .select({
                id: sessions.id,
                title: sessions.title,
                scheduledAt: sessions.scheduledAt,
                durationMinutes: sessions.durationMinutes,
                objective: sessions.objective,
              })
              .from(sessions)
              .where(
                and(
                  eq(sessions.userId, user.id),
                  ilike(sessions.title, `%${query}%`)
                )
              )
              .orderBy(desc(sessions.scheduledAt))
              .limit(5);
            return {
              tipo: "sesion",
              resultados: results,
              resultados_semanticos: semanticResults.map((item) => ({
                id: item.sourceId,
                similarity: item.similarity,
                content: item.content,
                metadata: item.metadata,
              })),
            };
          } else {
            const filtered = coachStudents
              .filter((s) => s.name.toLowerCase().includes(q))
              .slice(0, 5);
            return { tipo: "alumno", resultados: filtered };
          }
        },
      },
      analizar_alumno: {
        description:
          "Devuelve perfil analítico completo del alumno (KPIs, categorías trabajadas 60d, fases, gaps, progreso, últimas sesiones). La UI lo renderiza como StudentAnalyticsCard — NO lo resumas en texto, deja que la tarjeta lo muestre.",
        inputSchema: z.object({
          studentId: z.string().describe("ID del alumno a analizar"),
          generarInsight: z
            .boolean()
            .optional()
            .describe("Si true, añade un insight sintetizado por IA."),
        }),
        execute: async ({ studentId, generarInsight }) => {
          const analytics = await getStudentAnalytics(user.id, studentId);
          if (!analytics) return { ok: false, error: "Alumno no encontrado" };
          const gaps = await detectTrainingGaps(user.id, studentId);
          const progress = await getStudentProgress(user.id, studentId);

          let insight: string | null = null;
          if (generarInsight) {
            try {
              const text = await generateTrackedInsight({
                operation: "dr_planner_student_insight",
                temperature: 0.3,
                prompt: `Entrenador de deportes de raqueta. Alumno: ${analytics.student.name} (${analytics.student.playerLevel ?? "sin nivel"}).
Datos 60d: ${analytics.sessionsLast60d} sesiones, última hace ${analytics.daysSinceLast ?? "?"} días, intensidad media ${analytics.avgIntensity ?? "?"}.
Categorías: ${analytics.categoriesLast60d.map((c) => `${c.category} ${c.minutes}min`).join(", ") || "ninguna"}.
Gaps: ${gaps.map((g) => g.label).join(", ") || "ninguno"}.
En 2 frases (máx 40 palabras), diagnóstico accionable para la próxima sesión. Sin emojis, directo.`,
              });
              insight = text.trim();
            } catch (err) {
              console.error("[Dr. Planner] insight analizar_alumno:", err);
            }
          }

          return { ok: true, analytics, gaps, progress, insight };
        },
      },
      listar_alumnos_resumen: {
        description:
          "Lista resumida de todos los alumnos del entrenador con última sesión y frecuencia. Úsala para saber a quién tiene y elegir un foco.",
        inputSchema: z.object({}),
        execute: async () => {
          const summary = await listCoachStudentsSummary(user.id);
          return { alumnos: summary };
        },
      },
      alumnos_inactivos: {
        description:
          "Devuelve alumnos cuya última sesión fue hace ≥ diasUmbral (o que nunca tuvieron sesión). Úsala al inicio para detectar quién lleva tiempo parado.",
        inputSchema: z.object({
          diasUmbral: z
            .number()
            .int()
            .min(1)
            .max(365)
            .optional()
            .describe("Días desde última sesión; por defecto 14"),
        }),
        execute: async ({ diasUmbral }) => {
          const items = await findInactiveStudents(user.id, diasUmbral ?? 14);
          return { diasUmbral: diasUmbral ?? 14, alumnos: items };
        },
      },
      gaps_de_entrenamiento: {
        description:
          "Detecta categorías/fases con poco o nulo volumen en los últimos 60 días para un alumno. Útil para justificar una recomendación.",
        inputSchema: z.object({
          studentId: z.string(),
        }),
        execute: async ({ studentId }) => {
          const gaps = await detectTrainingGaps(user.id, studentId);
          return { gaps };
        },
      },
      progreso_alumno: {
        description:
          "Serie temporal mensual (últimos 6 meses) de nº de sesiones e intensidad media para un alumno. Para mini-charts.",
        inputSchema: z.object({
          studentId: z.string(),
        }),
        execute: async ({ studentId }) => {
          const progress = await getStudentProgress(user.id, studentId);
          return { progress };
        },
      },
      estadisticas_globales: {
        description:
          "Agregados del entrenador: sesiones este mes vs pasado, minutos, intensidad media, top ejercicios, distribución por categoría.",
        inputSchema: z.object({}),
        execute: async () => {
          const stats = await getCoachStats(user.id);
          return { stats };
        },
      },
      recomendar_proxima_sesion: {
        description:
          "Propuesta razonada de próxima sesión para uno o varios alumnos basada en sus gaps. La UI la renderiza como RecommendationCard.",
        inputSchema: z.object({
          studentIds: z.array(z.string()).min(1),
          generarInsight: z.boolean().optional(),
        }),
        execute: async ({ studentIds, generarInsight }) => {
          const rec = await recommendNextSession(user.id, studentIds);
          if (!rec)
            return { ok: false, error: "No se encontraron alumnos válidos" };

          let insight: string | null = null;
          if (generarInsight) {
            try {
              const text = await generateTrackedInsight({
                operation: "dr_planner_recommendation_insight",
                temperature: 0.4,
                prompt: `Entrenador de deportes de raqueta. Propuesta para ${rec.targetStudents.map((s) => s.name).join(", ")}.
Foco: ${rec.focus}. Duración: ${rec.durationSugerida}min, intensidad ${rec.intensitySugerida}/5.
Gaps detectados: ${rec.gaps.map((g) => g.label).join(", ") || "ninguno"}.
En 2 frases (máx 40 palabras), por qué esta propuesta tiene sentido ahora. Sin emojis, directo.`,
              });
              insight = text.trim();
            } catch (err) {
              console.error("[Dr. Planner] insight recomendar:", err);
            }
          }

          return { ok: true, recomendacion: { ...rec, insight } };
        },
      },
      mostrar_insights: {
        description:
          "Renderiza un panel visual de insights accionables (alertas, sugerencias, stats). Úsalo para la bienvenida proactiva y siempre que tengas varias observaciones que presentar juntas.",
        inputSchema: z.object({
          titulo: z
            .string()
            .optional()
            .describe("Título opcional del panel, ej: 'Resumen de tu semana'"),
          items: z
            .array(
              z.object({
                tipo: z.enum(["alerta", "sugerencia", "stat"]),
                titulo: z.string(),
                detalle: z.string(),
                metric: z
                  .string()
                  .optional()
                  .describe("Valor destacado a mostrar grande (opcional)"),
                accion: z
                  .object({
                    label: z.string(),
                    prompt: z
                      .string()
                      .describe(
                        "Texto que se enviará al chat si el usuario pulsa la acción"
                      ),
                  })
                  .optional(),
              })
            )
            .min(1)
            .max(6),
        }),
        execute: async (input) => input,
      },
      buscar_sesiones_similares: {
        description:
          "Busca sesiones pasadas del entrenador para usar como referencia o inspiración. Usar cuando el entrenador quiera basar una nueva sesión en algo previo.",
        inputSchema: z.object({
          query: z
            .string()
            .optional()
            .describe("Búsqueda por título u objetivo"),
          duracionMinutos: z
            .number()
            .optional()
            .describe("Duración aproximada para filtrar (±15 min)"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(8)
            .optional()
            .describe("Máx resultados"),
        }),
        execute: async ({ query, duracionMinutos, limit = 6 }) => {
          if (semanticSearchEnabled && query) {
            const semanticMatches = await searchAiDocumentsByText({
              userId: user.id,
              query,
              source: "session",
              limit,
            }).catch(() => []);

            if (semanticMatches.length > 0) {
              return {
                modo: "semantico",
                sesiones: semanticMatches.map((item) => ({
                  id: item.sourceId,
                  similarity: item.similarity,
                  content: item.content,
                  metadata: item.metadata,
                })),
              };
            }
          }

          const conditions = [eq(sessions.userId, user.id)];
          if (query) conditions.push(ilike(sessions.title, `%${query}%`));
          if (duracionMinutos !== undefined) {
            conditions.push(
              gte(sessions.durationMinutes, duracionMinutos - 15)
            );
            conditions.push(
              lte(sessions.durationMinutes, duracionMinutos + 15)
            );
          }

          const results = await db
            .select({
              id: sessions.id,
              title: sessions.title,
              scheduledAt: sessions.scheduledAt,
              durationMinutes: sessions.durationMinutes,
              objective: sessions.objective,
              intensity: sessions.intensity,
              tags: sessions.tags,
            })
            .from(sessions)
            .where(and(...conditions))
            .orderBy(desc(sessions.scheduledAt))
            .limit(limit);

          return { sesiones: results };
        },
      },
      buscar_ejercicios_avanzado: {
        description:
          "Búsqueda avanzada de ejercicios con filtros por categoría, dificultad y duración. Presentar siempre el resultado con mostrar_ejercicios, nunca en texto.",
        inputSchema: z.object({
          query: z
            .string()
            .optional()
            .describe("Texto libre en el nombre del ejercicio"),
          categoria: z
            .enum(["technique", "tactics", "fitness", "warm-up"])
            .optional(),
          dificultad: z
            .enum(["beginner", "intermediate", "advanced"])
            .optional(),
          duracionMin: z
            .number()
            .optional()
            .describe("Duración mínima en minutos"),
          duracionMax: z
            .number()
            .optional()
            .describe("Duración máxima en minutos"),
          soloPersonales: z
            .boolean()
            .optional()
            .describe("Solo ejercicios propios del entrenador"),
        }),
        execute: async ({
          query,
          categoria,
          dificultad,
          duracionMin,
          duracionMax,
          soloPersonales,
        }) => {
          const baseCondition = soloPersonales
            ? eq(exercises.createdBy, user.id)
            : publicExercisesEnabled
              ? or(
                  eq(exercises.createdBy, user.id),
                  eq(exercises.isGlobal, true),
                  isNull(exercises.createdBy)
                )
              : eq(exercises.createdBy, user.id);

          const conditions = [baseCondition!];
          if (categoria) conditions.push(eq(exercises.category, categoria));
          if (dificultad) conditions.push(eq(exercises.difficulty, dificultad));
          if (query) conditions.push(ilike(exercises.name, `%${query}%`));
          if (duracionMin !== undefined)
            conditions.push(gte(exercises.durationMinutes, duracionMin));
          if (duracionMax !== undefined)
            conditions.push(lte(exercises.durationMinutes, duracionMax));

          const results = await db
            .select(EXERCISE_FIELDS)
            .from(exercises)
            .where(and(...conditions))
            .limit(20);

          return { ejercicios: results };
        },
      },
      listar_grupos: {
        description:
          "Lista los grupos de alumnos del entrenador con sus miembros. Úsala cuando el usuario mencione un grupo con @ o cuando quiera planificar para un grupo concreto.",
        inputSchema: z.object({}),
        execute: async () => {
          type GroupRow = {
            groupId: string;
            groupName: string;
            description: string | null;
            studentId: string | null;
            studentName: string | null;
            playerLevel: string | null;
          };
          const rows: GroupRow[] = await db
            .select({
              groupId: groups.id,
              groupName: groups.name,
              description: groups.description,
              studentId: students.id,
              studentName: students.name,
              playerLevel: students.playerLevel,
            })
            .from(groups)
            .leftJoin(groupStudents, eq(groupStudents.groupId, groups.id))
            .leftJoin(students, eq(groupStudents.studentId, students.id))
            .where(eq(groups.coachId, user.id))
            .catch(() => [] as GroupRow[]);

          const map = new Map<
            string,
            {
              id: string;
              name: string;
              description: string | null;
              members: { id: string; name: string; level: string | null }[];
            }
          >();
          for (const row of rows) {
            if (!map.has(row.groupId)) {
              map.set(row.groupId, {
                id: row.groupId,
                name: row.groupName,
                description: row.description ?? null,
                members: [],
              });
            }
            if (row.studentId && row.studentName) {
              map.get(row.groupId)!.members.push({
                id: row.studentId,
                name: row.studentName,
                level: row.playerLevel ?? null,
              });
            }
          }
          return { grupos: Array.from(map.values()) };
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
