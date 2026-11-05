import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { landingContent } from "@/db/schema";

/**
 * Textos editables de la landing pública (/). Las claves llevan prefijo
 * "home_" para que filas antiguas del editor (diseño anterior) no puedan
 * pisar estos textos. Los títulos multilínea se dividen en dos partes:
 * la primera línea va en normal y el resto en cursiva de acento.
 */
export interface LandingContent {
  home_meta_title: string;
  home_meta_description: string;
  home_hero_badge: string;
  home_hero_title: string;
  home_hero_subtitle: string;
  home_hero_cta_primary: string;
  home_hero_cta_secondary: string;
  home_hero_proof: string;
  home_problem_title: string;
  home_how_title: string;
  home_prep_title: string;
  home_prep_text: string;
  home_features_title: string;
  home_sports_title: string;
  home_sports_text: string;
  home_final_title: string;
  home_final_text: string;
  home_final_cta: string;
  home_final_note: string;
  home_footer_tagline: string;
}

export const LANDING_DEFAULTS: LandingContent = {
  home_meta_title: "TenPlanner - Planificación de clases deportivas",
  home_meta_description:
    "Planifica clases deportivas con biblioteca de ejercicios, alumnos, grupos y calendario. Para monitores, clubes y academias.",
  home_hero_badge: "Planificación de clases para monitores deportivos",
  home_hero_title: "La clase la piensas tú.\nTen Planner te ayuda.",
  home_hero_subtitle:
    "Explora ejercicios y clases etiquetados, construye desde cero con la biblioteca o recupera lo que ya funcionó. Clases en grupo o individuales, siempre tu criterio.",
  home_hero_cta_primary: "Regístrate",
  home_hero_cta_secondary: "Ver cómo funciona",
  home_hero_proof: "Para monitores, clubes y academias de cualquier deporte",
  home_problem_title: "¿Te suena esto?\nA todos los monitores les pasa.",
  home_how_title: "Tú decides.\nEn minutos.",
  home_prep_title: "Tú piensas la clase.\nTres formas de prepararla.",
  home_prep_text:
    "No hay una única forma de planificar. Cada monitor trabaja diferente. Ten Planner se adapta a cómo quieres preparar cada sesión.",
  home_features_title: "Todo lo que necesita\nun monitor",
  home_sports_title: "Un espacio por deporte.\nTodos en una cuenta.",
  home_sports_text:
    "Al registrarte eliges tu deporte y entras directamente a tu espacio. Cuando quieras, añade otros deportes y trabaja cada uno en su propia zona.",
  home_final_title: "La próxima clase,\nlista en minutos.",
  home_final_text: "Crea tu cuenta, elige tu deporte y empieza a planificar.",
  home_final_cta: "Regístrate",
  home_final_note: "Elige tu deporte al registrarte",
  home_footer_tagline:
    "Planificación profesional para monitores y clubes deportivos.",
};

export type LandingStringKey = keyof LandingContent;

export type LandingFieldGroup =
  | "Hero"
  | "Secciones"
  | "Cierre"
  | "Footer y SEO";

export interface LandingFieldDefinition {
  key: LandingStringKey;
  label: string;
  group: LandingFieldGroup;
  multiline?: boolean;
  maxLength: number;
}

export const LANDING_FIELD_DEFINITIONS: LandingFieldDefinition[] = [
  {
    key: "home_hero_badge",
    label: "Hero - Etiqueta superior",
    group: "Hero",
    maxLength: 80,
  },
  {
    key: "home_hero_title",
    label: "Hero - Título (línea 1 normal, línea 2 en cursiva)",
    group: "Hero",
    multiline: true,
    maxLength: 120,
  },
  {
    key: "home_hero_subtitle",
    label: "Hero - Subtítulo",
    group: "Hero",
    multiline: true,
    maxLength: 320,
  },
  {
    key: "home_hero_cta_primary",
    label: "Hero - Botón principal (lleva a registro)",
    group: "Hero",
    maxLength: 40,
  },
  {
    key: "home_hero_cta_secondary",
    label: "Hero - Enlace «cómo funciona»",
    group: "Hero",
    maxLength: 40,
  },
  {
    key: "home_hero_proof",
    label: "Hero - Texto bajo los botones",
    group: "Hero",
    maxLength: 100,
  },
  {
    key: "home_problem_title",
    label: "El problema - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 120,
  },
  {
    key: "home_how_title",
    label: "Cómo funciona - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 80,
  },
  {
    key: "home_prep_title",
    label: "Preparar la clase - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 100,
  },
  {
    key: "home_prep_text",
    label: "Preparar la clase - Texto",
    group: "Secciones",
    multiline: true,
    maxLength: 260,
  },
  {
    key: "home_features_title",
    label: "Funcionalidades - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 80,
  },
  {
    key: "home_sports_title",
    label: "Deportes - Título",
    group: "Secciones",
    multiline: true,
    maxLength: 100,
  },
  {
    key: "home_sports_text",
    label: "Deportes - Texto",
    group: "Secciones",
    multiline: true,
    maxLength: 260,
  },
  {
    key: "home_final_title",
    label: "Cierre - Título",
    group: "Cierre",
    multiline: true,
    maxLength: 80,
  },
  {
    key: "home_final_text",
    label: "Cierre - Texto",
    group: "Cierre",
    multiline: true,
    maxLength: 180,
  },
  {
    key: "home_final_cta",
    label: "Cierre - Botón",
    group: "Cierre",
    maxLength: 40,
  },
  {
    key: "home_final_note",
    label: "Cierre - Nota bajo el botón",
    group: "Cierre",
    maxLength: 80,
  },
  {
    key: "home_footer_tagline",
    label: "Footer - Descripción",
    group: "Footer y SEO",
    multiline: true,
    maxLength: 180,
  },
  {
    key: "home_meta_title",
    label: "SEO - Título de la página",
    group: "Footer y SEO",
    maxLength: 70,
  },
  {
    key: "home_meta_description",
    label: "SEO - Descripción",
    group: "Footer y SEO",
    multiline: true,
    maxLength: 200,
  },
];

export const LANDING_STRING_KEYS = LANDING_FIELD_DEFINITIONS.map(
  (field) => field.key
) as LandingStringKey[];

/** Divide un título multilínea: primera línea normal, resto como acento. */
export function splitTitle(value: string): { main: string; accent: string } {
  const [main = "", ...rest] = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { main, accent: rest.join(" ") };
}

function landingString(
  map: Record<string, unknown>,
  key: LandingStringKey
): string {
  const value = map[key];
  if (typeof value !== "string" || value.trim() === "" || /[ÃÂâ]/.test(value)) {
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
