import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, or } from "drizzle-orm";
import {
  ArrowLeft,
  Clock,
  Users,
  Target,
  Package,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  classes,
  classBlocks,
  classBlockExercises,
  classFavorites,
  exercises,
  users,
} from "@/db/schema";
import { ClassActions } from "./class-actions";
import { resolveItemKind, type StationItemJson } from "@/lib/block-items";
import { PrevNextNav } from "@/components/app/prev-next-nav";
import { classNavQueryString, getFilteredClassIds } from "@/lib/nav/class-nav";
import { autoriaLabel, nivelLabel } from "@/lib/exercise-taxonomy";
import { getActiveWorkClubId } from "@/lib/clubs";
import { canSeeClassDraft } from "@/lib/classes/visibility";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function classValues(values: string[] | null, fallback: string | null) {
  return Array.isArray(values) && values.length > 0
    ? values
    : fallback
      ? [fallback]
      : [];
}

export default async function ClassDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const navParams = await searchParams;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const [cls] = await db
    .select()
    .from(classes)
    .where(eq(classes.id, id))
    .limit(1);
  if (!cls) notFound();

  const isOwner = !!user && cls.createdBy === user.id;
  let sharedViaClub = false;
  if (!cls.isLibrary && !isOwner && user && cls.clubId) {
    const activeClubId = await getActiveWorkClubId(user.id);
    sharedViaClub = cls.clubId === activeClubId;
  }
  if (!cls.isLibrary && !isOwner && !sharedViaClub) notFound();
  if (!canSeeClassDraft(cls, user?.id)) notFound();

  const authorName =
    sharedViaClub && cls.createdBy
      ? ((
          await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, cls.createdBy))
            .limit(1)
        )[0]?.name ?? null)
      : null;

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
          orderIndex: classBlockExercises.orderIndex,
          durationMinutes: classBlockExercises.durationMinutes,
          kind: classBlockExercises.kind,
          stations: classBlockExercises.stations,
          exerciseName: exercises.name,
          exerciseDescription: exercises.description,
        })
        .from(classBlockExercises)
        .leftJoin(exercises, eq(exercises.id, classBlockExercises.exerciseId))
        .where(or(...blocks.map((b) => eq(classBlockExercises.blockId, b.id)))!)
        .orderBy(
          asc(classBlockExercises.blockId),
          asc(classBlockExercises.orderIndex)
        )
    : [];

  const isFav = user
    ? !!(
        await db
          .select({ id: classFavorites.id })
          .from(classFavorites)
          .where(
            and(
              eq(classFavorites.userId, user.id),
              eq(classFavorites.classId, id)
            )
          )
          .limit(1)
      )[0]
    : false;

  const blockTitles = ["Bloque inicial", "Bloque principal", "Bloque final"];
  const classNiveles = classValues(cls.niveles, cls.nivel);
  const classAspectos = classValues(cls.aspectosJuego, cls.aspectoJuego);

  const navIds = await getFilteredClassIds(navParams, {
    userId: user?.id ?? null,
  });
  const navIdx = navIds.indexOf(id);
  const navQs = classNavQueryString(navParams);
  const navSuffix = navQs ? `?${navQs}` : "";
  const prevHref =
    navIdx > 0 ? `/classes/${navIds[navIdx - 1]}${navSuffix}` : null;
  const nextHref =
    navIdx >= 0 && navIdx < navIds.length - 1
      ? `/classes/${navIds[navIdx + 1]}${navSuffix}`
      : null;

  return (
    <div className="relative min-h-full overflow-hidden bg-[#F4F4F1] px-4 py-6 text-[#050505] dark:bg-[#050505] dark:text-[#F4F4F1] sm:px-6 md:px-10 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_78%_18%,rgba(214,255,56,0.22),transparent_34%),linear-gradient(180deg,rgba(5,5,5,0.06),transparent)] dark:bg-[radial-gradient(circle_at_78%_18%,rgba(214,255,56,0.16),transparent_34%)]" />
      <div className="relative flex items-center justify-between gap-3">
        <Link
          href="/classes"
          className="inline-flex items-center gap-2 rounded-full border border-[#050505]/12 bg-white px-3 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]"
        >
          <ArrowLeft className="size-4" /> Volver a clases
        </Link>
        <PrevNextNav
          prevHref={prevHref}
          nextHref={nextHref}
          position={navIdx >= 0 ? navIdx + 1 : null}
          total={navIds.length > 0 ? navIds.length : null}
        />
      </div>

      <div className="relative mt-6 overflow-hidden rounded-lg bg-[#050505] text-white shadow-[0_24px_80px_rgba(5,5,5,0.18)]">
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {cls.status === "draft" && (
                  <span className="rounded-full border border-amber-300/60 bg-amber-300/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                    Borrador
                  </span>
                )}
                {cls.isLibrary && (
                  <span className="rounded-full bg-[#D6FF38] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#050505]">
                    Biblioteca
                  </span>
                )}
                {cls.autoria && cls.autoria !== "libre" && (
                  <span className="rounded-full border border-white/14 bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/62">
                    {autoriaLabel(cls.autoria)}
                  </span>
                )}
                {classNiveles.map((nivel) => (
                  <span
                    key={nivel}
                    className="rounded-full border border-white/14 bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/62"
                  >
                    {nivelLabel(nivel)}
                  </span>
                ))}
                {classAspectos.map((aspecto) => (
                  <span
                    key={aspecto}
                    className="rounded-full border border-white/14 bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/62 capitalize"
                  >
                    {aspecto.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
              <h1 className="max-w-4xl font-heading text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
                {cls.name}
              </h1>
              {authorName && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/45">
                  Clase de {authorName}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/68">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {cls.duracionMinutes} min
                </span>
                {cls.alumnosTipo && (
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    <Users className="size-3.5" />{" "}
                    {cls.numAlumnos
                      ? `${cls.numAlumnos} alumnos`
                      : cls.alumnosTipo}
                  </span>
                )}
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-2 flex-wrap">
                {isOwner && (
                  <Link
                    href={`/classes/${cls.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/16 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-[#D6FF38] hover:text-[#D6FF38]"
                  >
                    {cls.status === "draft"
                      ? "Terminar y publicar"
                      : "Editar"}
                  </Link>
                )}
                <ClassActions
                  classId={cls.id}
                  initialFavorite={isFav}
                  className={cls.name}
                  canDelete={isOwner}
                />
              </div>
            )}
          </div>
        </div>
        <div className="h-2 bg-[#D6FF38]" />
      </div>

      {/* Objetivos / Material */}
      <div className="grid sm:grid-cols-2 gap-4">
        {cls.objetivos && (
          <div className="rounded-lg border border-[#050505]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <Target className="size-4 text-brand" />
              <h2 className="font-heading text-base text-foreground">
                Objetivos
              </h2>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
              {cls.objetivos}
            </p>
          </div>
        )}
        {cls.material && (
          <div className="rounded-lg border border-[#050505]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-2 mb-3">
              <Package className="size-4 text-brand" />
              <h2 className="font-heading text-base text-foreground">
                Material
              </h2>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
              {cls.material}
            </p>
          </div>
        )}
      </div>

      {/* Resumen de bloques */}
      {blocks.length > 0 && (
        <div className="rounded-lg border border-[#050505]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
          <h2 className="font-heading text-xl text-foreground mb-4">
            Índice de actividades
          </h2>
          <ol className="space-y-4">
            {blocks.map((block, idx) => {
              const blockItems = items.filter((i) => i.blockId === block.id);
              return (
                <li
                  key={block.id}
                  className="space-y-2 border-l-2 border-[#D6FF38] pl-4"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#6D7F00] dark:text-[#D6FF38]">
                    {String(idx + 1).padStart(2, "0")} ·{" "}
                    {block.title ??
                      blockTitles[block.orderIndex - 1] ??
                      "Bloque"}
                  </p>
                  <ul className="space-y-1.5">
                    {blockItems.length === 0 ? (
                      <li className="text-sm text-muted-foreground italic">
                        (sin ejercicios)
                      </li>
                    ) : (
                      blockItems.map((item, i) => {
                        const itemKind = resolveItemKind(item);
                        return (
                          <li
                            key={`${item.blockId}-${i}`}
                            className="text-sm text-foreground/85 flex items-start gap-2"
                          >
                            <span className="text-muted-foreground tabular-nums text-xs pt-0.5">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="flex-1">
                              {itemKind === "warmup" ? (
                                <span className="font-medium text-foreground">
                                  Descanso
                                </span>
                              ) : itemKind === "stations" ? (
                                <>
                                  <span className="font-medium text-foreground">
                                    Estaciones (
                                    {(item.stations as StationItemJson[])
                                      ?.length ?? 0}
                                    )
                                  </span>
                                  {item.freeText && (
                                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                      {item.freeText}
                                    </span>
                                  )}
                                  <ul className="mt-1.5 space-y-1 pl-4">
                                    {(
                                      (item.stations as StationItemJson[]) ?? []
                                    ).map((st, si) => (
                                      <li
                                        key={si}
                                        className="text-xs text-foreground/75"
                                      >
                                        {String(si + 1).padStart(2, "0")} ·{" "}
                                        {st.kind === "exercise" &&
                                        st.exerciseId &&
                                        st.exerciseName ? (
                                          <Link
                                            href={`/exercises/${st.exerciseId}?fromClass=${cls.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-foreground hover:text-brand"
                                          >
                                            {st.exerciseName}
                                          </Link>
                                        ) : (
                                          (st.freeText ?? "-")
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : item.exerciseId && item.exerciseName ? (
                                <Link
                                  href={`/exercises/${item.exerciseId}?fromClass=${cls.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-foreground hover:text-brand"
                                >
                                  {item.exerciseName}
                                </Link>
                              ) : (
                                (item.freeText ?? "-")
                              )}
                              {item.durationMinutes && (
                                <span className="text-muted-foreground ml-2 text-xs">
                                  · {item.durationMinutes} min
                                  {itemKind === "stations" ? "/estación" : ""}
                                </span>
                              )}
                              {itemKind === "exercise" &&
                                item.exerciseDescription && (
                                  <span className="mt-1 block text-xs leading-5 text-muted-foreground line-clamp-2">
                                    {item.exerciseDescription}
                                  </span>
                                )}
                            </span>
                          </li>
                        );
                      })
                    )}
                  </ul>
                  {block.notes && (
                    <p className="text-xs text-muted-foreground italic pl-6">
                      {block.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {cls.aspectosImportantes && (
        <div className="rounded-lg border border-[#050505]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h2 className="font-heading text-base text-foreground mb-3">
            Aspectos importantes
          </h2>
          <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
            {cls.aspectosImportantes}
          </p>
        </div>
      )}

      {!user && (
        <div className="rounded-lg border border-dashed border-[#050505]/18 bg-white/60 px-6 py-8 text-center dark:border-white/15 dark:bg-white/[0.04]">
          <GraduationCap
            className="size-8 text-muted-foreground/40 mx-auto mb-3"
            strokeWidth={1.4}
          />
          <p className="text-sm text-foreground/80">
            <Link
              href="/register"
              className="text-brand font-semibold hover:underline"
            >
              Crea una cuenta gratis
            </Link>{" "}
            para añadir esta clase a tus sesiones y a tus favoritos.
          </p>
        </div>
      )}
    </div>
  );
}
