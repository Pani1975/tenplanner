import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { landingContent } from "@/db/schema";

// Textos de la landing editables desde /admin/landing.
// Cada valor por defecto es exactamente el texto que se muestra en la web.
// Los saltos de línea ("\n") separan el titular en dos líneas en la página.
export interface LandingContent {
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  problem_heading: string;
  how_heading: string;
  prep_heading: string;
  prep_description: string;
  features_heading: string;
  final_cta_heading: string;
  final_cta_button: string;
  footer_tagline: string;
}

export const LANDING_DEFAULTS: LandingContent = {
  hero_eyebrow: "Planificación inteligente para monitores de tenis",
  hero_title: "La clase la piensas tú.\nTen Planner te ayuda.",
  hero_subtitle:
    "Explora ejercicios y clases etiquetados, construye desde cero con la biblioteca o recupera lo que ya funcionó. Tres caminos, siempre tu criterio.",
  hero_cta_primary: "Registrarse",
  hero_cta_secondary: "Ver cómo funciona",
  problem_heading: "¿Te suena esto?\nA todos los monitores les pasa.",
  how_heading: "Tú decides.\nEn minutos.",
  prep_heading: "Tú piensas la clase.\nTres formas de prepararla.",
  prep_description:
    "No hay una única forma de planificar. Cada monitor trabaja diferente. Ten Planner se adapta a cómo quieres preparar cada sesión.",
  features_heading: "Todo lo que necesita\nun monitor de tenis",
  final_cta_heading: "La próxima clase,\nlista en minutos.",
  final_cta_button: "Registrarse",
  footer_tagline:
    "Planificación profesional para entrenadores de deportes de raqueta.",
};

export type LandingStringKey = keyof LandingContent;

export type LandingFieldGroup = "Hero" | "Secciones" | "Footer";

export interface LandingFieldDefinition {
  key: LandingStringKey;
  label: string;
  group: LandingFieldGroup;
  multiline?: boolean;
  maxLength: number;
}

export const LANDING_FIELD_DEFINITIONS: LandingFieldDefinition[] = [
  {
    key: "hero_eyebrow",
    label: "Hero - Etiqueta superior",
    group: "Hero",
    maxLength: 120,
  },
  {
    key: "hero_title",
    label: "Hero - Título (salto de línea = segunda línea en cursiva)",
    group: "Hero",
    multiline: true,
    maxLength: 180,
  },
  {
    key: "hero_subtitle",
    label: "Hero - Subtítulo",
    group: "Hero",
    multiline: true,
    maxLength: 420,
  },
  {
    key: "hero_cta_primary",
    label: "Hero - Botón principal",
    group: "Hero",
    maxLength: 40,
  },
  {
    key: "hero_cta_secondary",
    label: "Hero - Botón secundario",
    group: "Hero",
    maxLength: 60,
  },
  {
    key: "problem_heading",
    label: "El problema - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 160,
  },
  {
    key: "how_heading",
    label: "Cómo funciona - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 120,
  },
  {
    key: "prep_heading",
    label: "Preparación - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 160,
  },
  {
    key: "prep_description",
    label: "Preparación - Descripción",
    group: "Secciones",
    multiline: true,
    maxLength: 360,
  },
  {
    key: "features_heading",
    label: "Funcionalidades - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 160,
  },
  {
    key: "final_cta_heading",
    label: "CTA final - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 160,
  },
  {
    key: "final_cta_button",
    label: "CTA final - Botón",
    group: "Secciones",
    maxLength: 40,
  },
  {
    key: "footer_tagline",
    label: "Pie - Descripción",
    group: "Footer",
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
  // Descarta valores no textuales o con mojibake (UTF-8 leído como Latin-1).
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

    const content = {} as LandingContent;
    for (const key of LANDING_STRING_KEYS) {
      content[key] = landingString(map, key);
    }
    return content;
  } catch {
    return LANDING_DEFAULTS;
  }
}

export const getLandingContent = unstable_cache(
  fetchLandingContent,
  ["landing-content"],
  { tags: ["landing"], revalidate: 3600 }
);
