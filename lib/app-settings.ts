import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { isAllowedImageUrl } from "@/lib/url-safety";

export type SettingType = "boolean" | "string" | "number";
export type SettingCategory = "Funciones" | "IA" | "Sistema" | "Marca";

export interface SettingDefinition<T = unknown> {
  key: string;
  defaultValue: T;
  type: SettingType;
  label: string;
  description: string;
  category: SettingCategory;
  isPublic: boolean;
}

export const SETTING_DEFINITIONS = [
  {
    key: "feature.dr_planner_enabled",
    defaultValue: false,
    type: "boolean",
    label: "Dr. Planner",
    description:
      "Activa o bloquea el asistente IA en navegación, páginas y API.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "feature.ai_insights_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Insights IA en dashboard",
    description: "Muestra el bloque de insights proactivos en el inicio.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "feature.session_templates_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Plantillas de sesión",
    description: "Permite mostrar y usar la biblioteca de plantillas.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "feature.public_exercises_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Biblioteca global",
    description: "Permite que los usuarios vean ejercicios globales.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "feature.exercise_creation_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Crear ejercicios",
    description: "Permite crear ejercicios manualmente desde la aplicación.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "feature.session_creation_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Crear sesiones",
    description: "Permite crear sesiones manualmente desde la aplicación.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "feature.groups_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Grupos de alumnos",
    description:
      "Activa la sección de grupos para organizar alumnos por equipo o nivel.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "feature.calendar_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Calendario",
    description: "Muestra la vista de calendario en la navegación principal.",
    category: "Funciones",
    isPublic: true,
  },
  {
    key: "system.registration_enabled",
    defaultValue: true,
    type: "boolean",
    label: "Registro de nuevos usuarios",
    description:
      "Desactiva para cerrar el registro público. Los usuarios existentes siguen pudiendo iniciar sesión.",
    category: "Sistema",
    isPublic: true,
  },
  {
    key: "system.max_sessions_per_user",
    defaultValue: 0,
    type: "number",
    label: "Límite de sesiones por usuario",
    description:
      "Número máximo de sesiones que puede crear un usuario. Usa 0 para ilimitado.",
    category: "Sistema",
    isPublic: false,
  },
  {
    key: "ai.semantic_search_enabled",
    defaultValue: false,
    type: "boolean",
    label: "Búsqueda semántica IA",
    description:
      "Activa recuperación por embeddings cuando el índice esté poblado.",
    category: "IA",
    isPublic: true,
  },
  {
    key: "ai.chat_provider",
    defaultValue: "anthropic",
    type: "string",
    label: "Proveedor IA",
    description:
      "Proveedor usado por Dr. Planner. Actualmente Anthropic; queda preparado para otros proveedores.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.dr_planner_model",
    defaultValue: "claude-haiku-4-5",
    type: "string",
    label: "Modelo Dr. Planner",
    description:
      "Modelo principal del chat. Usa Haiku para reducir coste o Sonnet para más calidad.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.reasoning_model",
    defaultValue: "claude-sonnet-4-6",
    type: "string",
    label: "Modelo análisis profundo",
    description:
      "Modelo usado en insights internos, recomendaciones y análisis que requieren más criterio.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.fallback_model",
    defaultValue: "claude-haiku-4-5",
    type: "string",
    label: "Modelo fallback",
    description:
      "Modelo económico de reserva para degradar calidad cuando haga falta contener costes.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.max_output_tokens",
    defaultValue: 2400,
    type: "number",
    label: "Salida máxima",
    description: "Máximo de tokens de salida por turno de Dr. Planner.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.default_temperature",
    defaultValue: 0.4,
    type: "number",
    label: "Temperatura Dr. Planner",
    description:
      "Creatividad del modelo principal. Valores bajos dan respuestas más estables.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.monthly_budget_usd",
    defaultValue: 50,
    type: "number",
    label: "Presupuesto mensual IA",
    description:
      "Presupuesto mensual orientativo para mostrar presión de gasto en el panel.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.default_daily_token_limit",
    defaultValue: 0,
    type: "number",
    label: "Límite diario por defecto",
    description:
      "Tokens diarios por usuario. Usa 0 para ilimitado salvo restricciones individuales.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.default_monthly_token_limit",
    defaultValue: 0,
    type: "number",
    label: "Límite mensual por defecto",
    description:
      "Tokens mensuales por usuario. Usa 0 para ilimitado salvo restricciones individuales.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.restriction_default_message",
    defaultValue:
      "Dr. Planner está temporalmente limitado para tu cuenta. Contacta con soporte si necesitas ampliarlo.",
    type: "string",
    label: "Mensaje restricción IA",
    description:
      "Mensaje por defecto para usuarios bloqueados o que superan límites.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.pricing_json",
    defaultValue:
      '{"claude-haiku-4-5":{"input":1,"output":5,"cacheWrite":1.25,"cacheRead":0.1},"claude-sonnet-4-6":{"input":3,"output":15,"cacheWrite":3.75,"cacheRead":0.3},"claude-sonnet-4-5":{"input":3,"output":15,"cacheWrite":3.75,"cacheRead":0.3},"claude-opus-4-6":{"input":5,"output":25,"cacheWrite":6.25,"cacheRead":0.5},"claude-opus-4-5":{"input":5,"output":25,"cacheWrite":6.25,"cacheRead":0.5}}',
    type: "string",
    label: "Precios IA JSON",
    description:
      "Coste por millón de tokens en USD. Edita este JSON si el proveedor cambia precios.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.embedding_model",
    defaultValue: "voyage-3.5",
    type: "string",
    label: "Modelo de embeddings",
    description: "Modelo usado por los jobs que generen embeddings.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "ai.embedding_dimensions",
    defaultValue: 1024,
    type: "number",
    label: "Dimensiones embeddings",
    description: "Debe coincidir con la dimensión de la columna vectorial.",
    category: "IA",
    isPublic: false,
  },
  {
    key: "system.maintenance_banner",
    defaultValue: "",
    type: "string",
    label: "Aviso global",
    description:
      "Texto corto para comunicar cambios o mantenimiento. Vacío para ocultarlo.",
    category: "Sistema",
    isPublic: true,
  },
  {
    key: "brand.app_name",
    defaultValue: "TenPlanner",
    type: "string",
    label: "Nombre de la app",
    description: "Nombre que aparece en el sidebar, cabecera y correos.",
    category: "Marca",
    isPublic: true,
  },
  {
    key: "brand.app_tagline",
    defaultValue: "Planificador de deportes de raqueta",
    type: "string",
    label: "Subtítulo de la app",
    description: "Frase corta bajo el nombre en el sidebar.",
    category: "Marca",
    isPublic: true,
  },
  {
    key: "brand.support_email",
    defaultValue: "",
    type: "string",
    label: "Email de soporte",
    description:
      "Dirección mostrada en mensajes de restricción y ayuda. Vacío para omitirlo.",
    category: "Marca",
    isPublic: true,
  },
  {
    key: "brand.default_accent",
    defaultValue: "blue",
    type: "string",
    label: "Color de marca por defecto",
    description:
      "Color accent que se aplica cuando el usuario no ha elegido uno. Opciones: blue, green, violet, amber, rose.",
    category: "Marca",
    isPublic: true,
  },
  {
    key: "brand.og_image_url",
    defaultValue: "",
    type: "string",
    label: "OG Image URL",
    description:
      "URL absoluta de la imagen para compartir en redes sociales (1200×630 px). Vacío usa el default.",
    category: "Marca",
    isPublic: true,
  },
] as const satisfies readonly SettingDefinition[];

export type SettingKey = (typeof SETTING_DEFINITIONS)[number]["key"];

type SettingValue = (typeof SETTING_DEFINITIONS)[number]["defaultValue"];

const definitionByKey = new Map<string, SettingDefinition>(
  SETTING_DEFINITIONS.map((definition) => [definition.key, definition])
);

function getDbErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

function valueMatchesType(value: unknown, type: SettingType) {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number")
    return typeof value === "number" && Number.isFinite(value);
  return typeof value === "string";
}

export function getSettingDefinition(key: string) {
  return definitionByKey.get(key) ?? null;
}

export function normalizeSettingValue(key: string, value: unknown) {
  const definition = getSettingDefinition(key);
  if (!definition) return null;
  if (!valueMatchesType(value, definition.type)) return null;
  if (definition.type === "string" && typeof value === "string") {
    const trimmed = value.trim();
    if (key === "brand.support_email" && trimmed.length > 0) {
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
      if (!validEmail) return null;
    }
    if (
      key === "brand.og_image_url" &&
      trimmed.length > 0 &&
      !isAllowedImageUrl(trimmed)
    ) {
      return null;
    }
    if (
      key === "brand.default_accent" &&
      !["blue", "green", "violet", "amber", "rose"].includes(trimmed)
    ) {
      return null;
    }
    return trimmed;
  }
  return value;
}

export async function getAppSettings(keys?: readonly SettingKey[]) {
  const definitions = keys
    ? SETTING_DEFINITIONS.filter((definition) => keys.includes(definition.key))
    : SETTING_DEFINITIONS;
  const values = new Map<string, SettingValue>(
    definitions.map((definition) => [definition.key, definition.defaultValue])
  );

  try {
    const rows =
      definitions.length === SETTING_DEFINITIONS.length
        ? await db.select().from(appSettings)
        : await db
            .select()
            .from(appSettings)
            .where(
              inArray(
                appSettings.key,
                definitions.map((d) => d.key)
              )
            );

    for (const row of rows) {
      const definition = getSettingDefinition(row.key);
      if (!definition) continue;
      if (valueMatchesType(row.value, definition.type)) {
        values.set(row.key, row.value as SettingValue);
      }
    }
  } catch (error) {
    if (getDbErrorCode(error) !== "42P01") throw error;
  }

  return values;
}

export async function getSettingValue<T extends SettingKey>(key: T) {
  const values = await getAppSettings([key]);
  return values.get(key);
}

export async function getBooleanSetting(key: SettingKey) {
  const value = await getSettingValue(key);
  return typeof value === "boolean" ? value : true;
}

export async function getNumberSetting(key: SettingKey, fallback = 0) {
  const value = await getSettingValue(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function getStringSetting(key: SettingKey, fallback = "") {
  const value = await getSettingValue(key);
  return typeof value === "string" ? value : fallback;
}

export async function isDrPlannerEnabled() {
  return getBooleanSetting("feature.dr_planner_enabled");
}

export async function areAiInsightsEnabled() {
  return getBooleanSetting("feature.ai_insights_enabled");
}
