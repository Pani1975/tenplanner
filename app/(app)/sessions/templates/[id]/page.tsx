import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  exercises,
  sessionTemplateExercises,
  sessionTemplates,
  users,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Clock, Zap, MapPin, Download } from "lucide-react";
import { AdoptTemplateButton } from "@/components/app/session-templates/adopt-template-button";
import { PublishTemplateActions } from "@/components/app/session-templates/publish-template-actions";
import { FeatureLocked } from "@/components/app/feature-locked";
import { getBooleanSetting } from "@/lib/app-settings";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{ id: string }>;
}

const PHASE_LABEL: Record<string, string> = {
  activation: "Activación",
  main: "Principal",
  cooldown: "Vuelta a la calma",
};

const CATEGORY_LABEL: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

export default async function SessionTemplatePage({ params }: PageProps) {
  const tx = await getTranslations("ui.s_id_page");
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const templatesEnabled = await getBooleanSetting(
    "feature.session_templates_enabled"
  );
  if (!templatesEnabled) {
    return (
      <FeatureLocked
        title={tx("plantillasDesactivadas")}
        description={tx("elAdministradorHaPausado")}
        href="/sessions"
        cta="Volver a sesiones"
      />
    );
  }

  const { id } = await params;

  const [template] = await db
    .select({
      id: sessionTemplates.id,
      authorId: sessionTemplates.authorId,
      authorName: users.name,
      title: sessionTemplates.title,
      description: sessionTemplates.description,
      objective: sessionTemplates.objective,
      durationMinutes: sessionTemplates.durationMinutes,
      intensity: sessionTemplates.intensity,
      tags: sessionTemplates.tags,
      location: sessionTemplates.location,
      adoptionsCount: sessionTemplates.adoptionsCount,
      createdAt: sessionTemplates.createdAt,
    })
    .from(sessionTemplates)
    .leftJoin(users, eq(sessionTemplates.authorId, users.id))
    .where(eq(sessionTemplates.id, id))
    .limit(1);

  if (!template) notFound();

  const templateExercises = await db
    .select({
      id: sessionTemplateExercises.id,
      orderIndex: sessionTemplateExercises.orderIndex,
      durationMinutes: sessionTemplateExercises.durationMinutes,
      notes: sessionTemplateExercises.notes,
      phase: sessionTemplateExercises.phase,
      intensity: sessionTemplateExercises.intensity,
      exercise: {
        id: exercises.id,
        name: exercises.name,
        category: exercises.category,
        difficulty: exercises.difficulty,
        durationMinutes: exercises.durationMinutes,
        imageUrl: exercises.imageUrl,
      },
    })
    .from(sessionTemplateExercises)
    .leftJoin(exercises, eq(sessionTemplateExercises.exerciseId, exercises.id))
    .where(eq(sessionTemplateExercises.templateId, id))
    .orderBy(asc(sessionTemplateExercises.orderIndex));

  const isAuthor = template.authorId === user.id;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-8">
        {/* Back */}
        <Link
          href="/sessions/templates"
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-[#050505]/10 bg-white px-4 text-[12px] font-black text-foreground/60 transition-colors hover:text-foreground dark:border-white/10 dark:bg-[#10100e]"
        >
          <ArrowLeft className="size-3.5" />{" "}{tx("plantillas")}
        </Link>

        {/* Masthead */}
        <header className="tp-hero-panel space-y-6 p-6 text-white sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
              {tx("plantilla")}
            </p>
            {template.adoptionsCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[10px] font-black text-white">
                <Download className="size-3" />
                {template.adoptionsCount}{" "}{tx("adopciones")}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-3">
              <h1 className="text-4xl font-black leading-tight text-white md:text-5xl">
                {template.title}
              </h1>
              {template.objective && (
                <p className="text-sm font-semibold leading-6 text-white/62">
                  {template.objective}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[12px] font-bold text-white/70">
                  <Clock className="size-3.5" /> {template.durationMinutes}{" "}{tx("min")}
                </span>
                {template.intensity != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[12px] font-bold text-white/70">
                    <Zap className="size-3.5" />{" "}{tx("intensidad")}{" "}{template.intensity}
                    /5
                  </span>
                )}
                {template.location && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[12px] font-bold text-white/70">
                    <MapPin className="size-3.5" /> {template.location}
                  </span>
                )}
                {template.authorName && (
                  <span className="text-[12px] font-semibold text-white/45">
                    {tx("porV1", { v1: template.authorName })}
                  </span>
                )}
              </div>
              {Array.isArray(template.tags) &&
                (template.tags as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(template.tags as string[]).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[#D6FF38]/35 bg-[#D6FF38]/15 px-2.5 py-0.5 text-[11px] font-black text-[#D6FF38]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto md:shrink-0">
              {isAuthor ? (
                <PublishTemplateActions templateId={template.id} />
              ) : (
                <AdoptTemplateButton templateId={template.id} />
              )}
            </div>
          </div>
        </header>

        {/* Exercise list */}
        <section className="tp-panel space-y-4 p-5 sm:p-6">
          <p className="tp-kicker">
            {tx("v1Ejercicios", { v1: templateExercises.length.toString().padStart(2, "0") })}</p>

          {templateExercises.length === 0 ? (
            <p className="text-[14px] text-foreground/45">
              {tx("estaPlantillaNoTiene")}
            </p>
          ) : (
            <div className="space-y-2">
              {templateExercises.map((te, i) => (
                <div
                  key={te.id}
                  className="flex items-start gap-4 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="font-sans text-[10px] tabular-nums text-foreground/30 mt-0.5 shrink-0">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-[15px] font-black leading-snug text-foreground">
                      {te.exercise?.name ?? "Ejercicio eliminado"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {te.exercise?.category && (
                        <span className="text-[11px] text-foreground/45">
                          {CATEGORY_LABEL[te.exercise.category] ??
                            te.exercise.category}
                        </span>
                      )}
                      {te.phase && (
                        <span className="text-[11px] text-foreground/45">
                          · {PHASE_LABEL[te.phase] ?? te.phase}
                        </span>
                      )}
                    </div>
                    {te.notes && (
                      <p className="text-[12px] text-foreground/50 leading-relaxed pt-0.5">
                        {te.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-foreground/40 tabular-nums shrink-0">
                    {tx("v1Min", { v1: te.durationMinutes ?? te.exercise?.durationMinutes ?? "—" })}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
