import type { Metadata } from "next";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { TenPlannerLanding } from "@/components/landing/tenplanner-landing";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";
import { siteUrl } from "@/lib/site";
import { getLandingContent } from "@/lib/landing-content";
import { getLandingStats } from "@/lib/landing-stats";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { LandingContent } from "@/lib/landing-content";

// En inglés los textos de la portada salen de messages/en.json; en español
// siguen siendo los editables de la base de datos.
async function getLocalizedContent(): Promise<LandingContent> {
  if ((await getLocale()) !== "en") return getLandingContent();
  const messages = (await getMessages()) as {
    landing: { content: LandingContent };
  };
  return messages.landing.content;
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await getLocalizedContent();
  return {
    title: content.home_meta_title,
    description: content.home_meta_description,
    alternates: { canonical: "/" },
    openGraph: {
      title: content.home_meta_title,
      description: content.home_meta_description,
      url: "/",
      type: "website",
      locale: (await getLocale()) === "en" ? "en_US" : "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title: "TenPlanner",
      description: content.home_meta_description,
    },
  };
}

const buildStructuredData = (lang: string, description: string) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "TenPlanner",
      url: siteUrl,
      logo: `${siteUrl}/icon-512x512.png`,
      sameAs: ["https://www.instagram.com/tenplanner/"],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "TenPlanner",
      url: siteUrl,
      inLanguage: lang,
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "TenPlanner",
      url: siteUrl,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      inLanguage: lang,
      description,
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
});

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const locale = await getLocale();
  const softwareDescription = (await getTranslations("meta"))("softwareDescription");
  const [content, stats, exerciseCards, classCards] = await Promise.all([
    getLocalizedContent(),
    getLandingStats(),
    db
      .select({
        id: exercises.id,
        name: exercises.name,
        durationMinutes: exercises.durationMinutes,
        nivel: exercises.nivel,
        aspectoJuego: exercises.aspectoJuego,
      })
      .from(exercises)
      .where(
        and(
          or(eq(exercises.isGlobal, true), isNull(exercises.createdBy)),
          eq(exercises.isPublished, true)
        )
      )
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(
            buildStructuredData(
              locale === "en" ? "en" : "es-ES",
              softwareDescription
            )
          ) }}
      />
      <TenPlannerLanding
        exerciseCards={exerciseCards}
        classCards={classCards}
        content={content}
        stats={stats}
      />
    </>
  );
}
