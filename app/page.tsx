import type { Metadata } from "next";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { TenPlannerLanding } from "@/components/landing/tenplanner-landing";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "TenPlanner - Planificación para deportes de raqueta",
  description:
    "Planifica sesiones de deportes de raqueta con biblioteca, alumnos, grupos y calendario en un sistema profesional para entrenadores.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "TenPlanner - Planificación para deportes de raqueta",
    description:
      "Prepara sesiones, gestiona alumnos, organiza pistas o canchas y mantiene un método de entrenamiento.",
    url: "/",
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenPlanner",
    description: "Sistema digital para entrenadores de deportes de raqueta.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "TenPlanner",
      url: siteUrl,
      logo: `${siteUrl}/icon-512x512.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "TenPlanner",
      url: siteUrl,
      inLanguage: "es-ES",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "TenPlanner",
      url: siteUrl,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      inLanguage: "es-ES",
      description:
        "Planificador de clases para monitores de tenis: biblioteca de ejercicios y clases, calendario, grupos y pase de lista.",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [exerciseCards, classCards] = await Promise.all([
    db
      .select({
        id: exercises.id,
        name: exercises.name,
        durationMinutes: exercises.durationMinutes,
        nivel: exercises.nivel,
        aspectoJuego: exercises.aspectoJuego,
      })
      .from(exercises)
      .where(or(eq(exercises.isGlobal, true), isNull(exercises.createdBy)))
      .orderBy(desc(exercises.createdAt))
      .limit(3),
    db
      .select({
        id: classes.id,
        name: classes.name,
        duracionMinutes: classes.duracionMinutes,
        nivel: classes.nivel,
        objetivos: classes.objetivos,
        numAlumnos: classes.numAlumnos,
      })
      .from(classes)
      .where(and(eq(classes.isLibrary, true), eq(classes.status, "published")))
      .orderBy(desc(classes.createdAt))
      .limit(3),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <TenPlannerLanding
        exerciseCards={exerciseCards}
        classCards={classCards}
      />
    </>
  );
}
