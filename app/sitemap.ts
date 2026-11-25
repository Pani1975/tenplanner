import type { MetadataRoute } from "next";
import { db } from "@/db";
import { classes, exercises } from "@/db/schema";
import { siteUrl } from "@/lib/site";
import { publicClassCondition, publicExerciseCondition } from "@/lib/seo";

// Se regenera como mucho una vez al día.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/exercises`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/classes`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/register`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    ...["/terminos", "/privacidad", "/cookies", "/aviso-legal"].map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  // Fichas públicas: ejercicios de la biblioteca publicados y clases de la
  // biblioteca. Si la base falla, el sitemap sale igualmente con lo fijo.
  try {
    const [exerciseRows, classRows] = await Promise.all([
      db
        .select({ id: exercises.id, updatedAt: exercises.updatedAt })
        .from(exercises)
        .where(publicExerciseCondition),
      db
        .select({ id: classes.id, updatedAt: classes.updatedAt })
        .from(classes)
        .where(publicClassCondition),
    ]);
    return [
      ...fixed,
      ...exerciseRows.map((r) => ({
        url: `${siteUrl}/exercises/${r.id}`,
        lastModified: r.updatedAt ?? now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...classRows.map((r) => ({
        url: `${siteUrl}/classes/${r.id}`,
        lastModified: r.updatedAt ?? now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    console.error("sitemap: no se pudieron leer las fichas públicas", error);
    return fixed;
  }
}
