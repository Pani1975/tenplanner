import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { reportTemplates } from "@/db/schema";
import { normalizeMetricIds, type ReportMetricId } from "./catalog";

// Plantillas del informe de gestión: un diseño guardado (nombre + datos)
// que se genera después con el periodo que se elija. Son del club.

export interface ReportTemplate {
  id: string;
  name: string;
  metrics: ReportMetricId[];
  updatedAt: string;
}

export const templateInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ponle un nombre a la plantilla")
    .max(120, "Máximo 120 caracteres"),
  metrics: z
    .array(z.string())
    .max(200)
    .transform((values) => normalizeMetricIds(values))
    .refine((values) => values.length > 0, {
      message: "Elige al menos un dato",
    }),
});

export const templateUpdateSchema = templateInputSchema
  .partial()
  .refine((v) => v.name !== undefined || v.metrics !== undefined, {
    message: "Nada que cambiar",
  });

function toTemplate(row: typeof reportTemplates.$inferSelect): ReportTemplate {
  return {
    id: row.id,
    name: row.name,
    metrics: normalizeMetricIds(row.metrics ?? []),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listReportTemplates(
  clubId: string
): Promise<ReportTemplate[]> {
  const rows = await db
    .select()
    .from(reportTemplates)
    .where(eq(reportTemplates.clubId, clubId))
    .orderBy(asc(reportTemplates.name));
  return rows.map(toTemplate);
}

/**
 * Como listReportTemplates, pero si la tabla aún no existe (migración sin
 * aplicar) devuelve [] para que la página de gestión siga funcionando.
 */
export async function listReportTemplatesSafe(
  clubId: string
): Promise<{ templates: ReportTemplate[]; available: boolean }> {
  try {
    return { templates: await listReportTemplates(clubId), available: true };
  } catch (err) {
    console.error("[report templates] list failed", err);
    return { templates: [], available: false };
  }
}

export async function getReportTemplate(
  clubId: string,
  id: string
): Promise<ReportTemplate | null> {
  const [row] = await db
    .select()
    .from(reportTemplates)
    .where(and(eq(reportTemplates.id, id), eq(reportTemplates.clubId, clubId)))
    .limit(1);
  return row ? toTemplate(row) : null;
}

export async function createReportTemplate(
  clubId: string,
  userId: string,
  input: { name: string; metrics: ReportMetricId[] }
): Promise<ReportTemplate> {
  const [row] = await db
    .insert(reportTemplates)
    .values({
      clubId,
      createdBy: userId,
      name: input.name,
      metrics: input.metrics,
    })
    .returning();
  return toTemplate(row);
}

export async function updateReportTemplate(
  clubId: string,
  id: string,
  input: { name?: string; metrics?: ReportMetricId[] }
): Promise<ReportTemplate | null> {
  const [row] = await db
    .update(reportTemplates)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.metrics !== undefined ? { metrics: input.metrics } : {}),
    })
    .where(and(eq(reportTemplates.id, id), eq(reportTemplates.clubId, clubId)))
    .returning();
  return row ? toTemplate(row) : null;
}

export async function deleteReportTemplate(
  clubId: string,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(reportTemplates)
    .where(and(eq(reportTemplates.id, id), eq(reportTemplates.clubId, clubId)))
    .returning({ id: reportTemplates.id });
  return rows.length > 0;
}
