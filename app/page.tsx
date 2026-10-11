import type { Metadata } from "next";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { TenPlannerLanding } from "@/components/landing/tenplanner-landing";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";

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
    <TenPlannerLanding exerciseCards={exerciseCards} classCards={classCards} />
  );
}
