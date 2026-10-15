import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { and, asc, eq, or } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  classes,
  classBlocks,
  classBlockExercises,
  exercises,
  users,
} from "@/db/schema";
import { ClassForm } from "@/components/app/class-form";
import { resolveItemKind, type StationItemJson } from "@/lib/block-items";
import { exerciseOwnOrClubCondition } from "@/lib/exercise-access";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditClassPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, id), eq(classes.createdBy, user.id)))
    .limit(1);
  if (!cls) notFound();

  const [adminRow] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const blocks = await db
    .select()
    .from(classBlocks)
    .where(eq(classBlocks.classId, id))
    .orderBy(asc(classBlocks.orderIndex));

  const items = blocks.length
    ? await db
        .select({
          blockId: classBlockExercises.blockId,
          exerciseId: classBlockExercises.exerciseId,
          freeText: classBlockExercises.freeText,
          title: classBlockExercises.title,
          orderIndex: classBlockExercises.orderIndex,
          durationMinutes: classBlockExercises.durationMinutes,
          kind: classBlockExercises.kind,
          stations: classBlockExercises.stations,
          exerciseName: exercises.name,
        })
        .from(classBlockExercises)
        .leftJoin(exercises, eq(exercises.id, classBlockExercises.exerciseId))
        .where(or(...blocks.map((b) => eq(classBlockExercises.blockId, b.id)))!)
        .orderBy(
          asc(classBlockExercises.blockId),
          asc(classBlockExercises.orderIndex)
        )
    : [];

  const availableExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      category: exercises.category,
      description: exercises.description,
      nivel: exercises.nivel,
      niveles: exercises.niveles,
      phase: exercises.phase,
      aspectoJuego: exercises.aspectoJuego,
      aspectosJuego: exercises.aspectosJuego,
      golpes: exercises.golpes,
    })
    .from(exercises)
    .where(
      and(
        or(eq(exercises.isGlobal, true), exerciseOwnOrClubCondition(user.id)),
        eq(exercises.sport, cls.sport)
      )
    )
    .orderBy(exercises.name)
    .limit(2000);

  const initialData = {
    name: cls.name,
    duracionMinutes: cls.duracionMinutes,
    alumnosTipo: cls.alumnosTipo as "individual" | "grupal" | null,
    numAlumnos: cls.numAlumnos,
    nivel: cls.nivel,
    niveles:
      Array.isArray(cls.niveles) && cls.niveles.length > 0
        ? cls.niveles
        : cls.nivel
          ? [cls.nivel]
          : null,
    aspectoJuego: cls.aspectoJuego,
    aspectosJuego:
      Array.isArray(cls.aspectosJuego) && cls.aspectosJuego.length > 0
        ? cls.aspectosJuego
        : cls.aspectoJuego
          ? [cls.aspectoJuego]
          : null,
    golpes: Array.isArray(cls.golpes) ? cls.golpes : null,
    objetivos: cls.objetivos,
    material: cls.material,
    videoUrl: cls.videoUrl,
    aspectosImportantes: cls.aspectosImportantes,
    isLibrary: cls.isLibrary,
    autoria: cls.autoria,
    status: (cls.status === "draft" ? "draft" : "published") as
      | "draft"
      | "published",
    blocks: blocks.map((b) => ({
      orderIndex: b.orderIndex,
      title: b.title,
      notes: b.notes,
      items: items
        .filter((it) => it.blockId === b.id)
        .map((it) => {
          const itemKind = resolveItemKind(it);
          if (itemKind === "warmup") {
            return {
              kind: "warmup" as const,
              durationMinutes: it.durationMinutes,
            };
          }
          if (itemKind === "stations") {
            const stations = (it.stations as StationItemJson[] | null) ?? [];
            return {
              kind: "stations" as const,
              introText: it.freeText ?? "",
              durationMinutes: it.durationMinutes,
              stations: stations.map((s) => ({
                kind: s.kind,
                exerciseId: s.exerciseId,
                name: s.exerciseName ?? "",
                freeText: s.freeText ?? "",
                durationMinutes: s.durationMinutes,
              })),
            };
          }
          return it.exerciseId && it.exerciseName
            ? {
                kind: "exercise" as const,
                exerciseId: it.exerciseId,
                name: it.exerciseName,
                durationMinutes: it.durationMinutes,
              }
            : {
                kind: "text" as const,
                freeText: it.freeText ?? "",
                title: it.title ?? "",
                durationMinutes: it.durationMinutes,
              };
        }),
    })),
  };

  return (
    <div className="px-4 py-8 sm:px-6 md:px-10">
      <div className="mb-6 flex items-start gap-4 border-b border-foreground/10 pb-5">
        <Link
          href={`/classes/${cls.id}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505]"
          aria-label="Volver a la clase"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#D6FF38]">
            Plantilla de clase
          </p>
          <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Editar clase
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{cls.name}</p>
        </div>
      </div>

      <ClassForm
        mode="edit"
        classId={cls.id}
        availableExercises={availableExercises}
        isAdmin={adminRow?.isAdmin ?? false}
        initialData={initialData}
        sport={cls.sport}
      />
    </div>
  );
}
