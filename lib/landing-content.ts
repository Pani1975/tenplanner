import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { landingContent } from "@/db/schema";

export interface LandingContent {
  hero_badge: string;
  hero_title: string;
  hero_title_accent: string;
  hero_subtitle: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  problem_title: string;
  problem_accent: string;
  how_title: string;
  how_accent: string;
  prep_title: string;
  prep_accent: string;
  prep_description: string;
  features_title: string;
  features_accent: string;
  cta_title: string;
  cta_accent: string;
  footer_tagline: string;
}

// Deben coincidir con lo que muestra hoy la web pública sin filas en BD.
export const LANDING_DEFAULTS: LandingContent = {
  hero_badge: "Planificación inteligente para monitores de tenis",
  hero_title: "La clase la piensas tú.",
  hero_title_accent: "Ten Planner te ayuda.",
  hero_subtitle:
    "Explora ejercicios y clases etiquetados, construye desde cero con la biblioteca o recupera lo que ya funcionó. Tres caminos, siempre tu criterio.",
  hero_cta_primary: "Registrarse →",
  hero_cta_secondary: "Ver cómo funciona",
  problem_title: "¿Te suena esto?",
  problem_accent: "A todos los monitores les pasa.",
  how_title: "Tú decides.",
  how_accent: "En minutos.",
  prep_title: "Tú piensas la clase.",
  prep_accent: "Tres formas de prepararla.",
  prep_description:
    "No hay una única forma de planificar. Cada monitor trabaja diferente. Ten Planner se adapta a cómo quieres preparar cada sesión.",
  features_title: "Todo lo que necesita",
  features_accent: "un monitor de tenis",
  cta_title: "La próxima clase,",
  cta_accent: "lista en minutos.",
  footer_tagline:
    "Planificación profesional para entrenadores de deportes de raqueta.",
};

export type LandingStringKey = keyof LandingContent;

export type LandingFieldGroup = "Hero" | "Secciones" | "Cierre";

export interface LandingFieldDefinition {
  key: LandingStringKey;
  label: string;
  group: LandingFieldGroup;
  multiline?: boolean;
  maxLength: number;
}

export const LANDING_FIELD_DEFINITIONS: LandingFieldDefinition[] = [
  { key: "hero_badge", label: "Hero - Etiqueta superior", group: "Hero", maxLength: 80 },
  { key: "hero_title", label: "Hero - Título", group: "Hero", maxLength: 80 },
  {
    key: "hero_title_accent",
    label: "Hero - Título (línea en cursiva)",
    group: "Hero",
    maxLength: 80,
  },
  {
    key: "hero_subtitle",
    label: "Hero - Subtítulo",
    group: "Hero",
    multiline: true,
    maxLength: 420,
  },
  { key: "hero_cta_primary", label: "Hero - CTA primario", group: "Hero", maxLength: 40 },
  {
    key: "hero_cta_secondary",
    label: "Hero - CTA secundario",
    group: "Hero",
    maxLength: 60,
  },
  { key: "problem_title", label: "El problema - Título", group: "Secciones", maxLength: 80 },
  {
    key: "problem_accent",
    label: "El problema - Línea en cursiva",
    group: "Secciones",
    maxLength: 80,
  },
  { key: "how_title", label: "Cómo funciona - Título", group: "Secciones", maxLength: 80 },
  {
    key: "how_accent",
    label: "Cómo funciona - Línea de acento",
    group: "Secciones",
    maxLength: 80,
  },
  { key: "prep_title", label: "Preparación - Título", group: "Secciones", maxLength: 80 },
  {
    key: "prep_accent",
    label: "Preparación - Línea de acento",
    group: "Secciones",
    maxLength: 80,
  },
  {
    key: "prep_description",
    label: "Preparación - Descripción",
    group: "Secciones",
    multiline: true,
    maxLength: 360,
  },
  {
    key: "features_title",
    label: "Funcionalidades - Título",
    group: "Secciones",
    maxLength: 80,
  },
  {
    key: "features_accent",
    label: "Funcionalidades - Línea de acento",
    group: "Secciones",
    maxLength: 80,
  },
  { key: "cta_title", label: "CTA final - Título", group: "Cierre", maxLength: 80 },
  {
    key: "cta_accent",
    label: "CTA final - Línea en cursiva",
    group: "Cierre",
    maxLength: 80,
  },
  {
    key: "footer_tagline",
    label: "Pie - Tagline",
    group: "Cierre",
    multiline: true,
    maxLength: 180,
  },
];

export const LANDING_STRING_KEYS = LANDING_FIELD_DEFINITIONS.map(
  (field) => field.key
) as LandingStringKey[];

function landingString(
  map: Record<string, unknown>,
  key: LandingStringKey
): string {
  const value = map[key];
  if (typeof value !== "string" || /[ÃÂâ]/.test(value)) {
    return LANDING_DEFAULTS[key];
  }
  return value;
}

async function fetchLandingContent(): Promise<LandingContent> {
  try {
    const rows = await db.select().from(landingContent);
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }

    return Object.fromEntries(
      LANDING_STRING_KEYS.map((key) => [key, landingString(map, key)])
    ) as unknown as LandingContent;
  } catch {
    return LANDING_DEFAULTS;
  }
}

export const getLandingContent = unstable_cache(
  fetchLandingContent,
  ["landing-content-v2"],
  { tags: ["landing"], revalidate: 3600 }
);
