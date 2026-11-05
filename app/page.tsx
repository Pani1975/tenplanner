import type { Metadata } from "next";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { TenPlannerLanding } from "@/components/landing/tenplanner-landing";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";
import { getLandingContent } from "@/lib/landing-content";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getLandingContent();
  return {
    title: content.home_meta_title,
    description: content.home_meta_description,
    alternates: { canonical: "/" },
    openGraph: {
      title: content.home_meta_title,
      description: content.home_meta_description,
      url: "/",
      type: "website",
      locale: "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title: "TenPlanner",
      description: content.home_meta_description,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [content, exerciseCards, classCards] = await Promise.all([
    getLandingContent(),
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
    <TenPlannerLanding
      exerciseCards={exerciseCards}
      classCards={classCards}
      content={content}
    />
  );
}
