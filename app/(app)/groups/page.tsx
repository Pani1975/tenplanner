import { redirect } from "next/navigation";
import { getWorkMode, personalTitle } from "@/lib/work-mode";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { groups, groupStudents, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { Users, ChevronRight, Shield, Plus } from "lucide-react";
import { GroupCreateForm } from "./group-create-form";
import { FeatureLocked } from "@/components/app/feature-locked";
import { getBooleanSetting } from "@/lib/app-settings";
import {
  getActiveWorkClubId,
  getClubMembersDirectory,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { cn } from "@/lib/utils";
import { listCoachesByGroupIds } from "@/lib/club-coaches";

interface PageProps {
  searchParams: Promise<{ monitor?: string }>;
}

export default async function GroupsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { monitor } = await searchParams;

  const groupsEnabled = await getBooleanSetting("feature.groups_enabled");
  if (!groupsEnabled) {
    return (
      <FeatureLocked
        title="Grupos desactivados"
        description="El administrador ha pausado temporalmente la organización por grupos."
        href="/students"
        cta="Volver a alumnos"
      />
    );
  }

  const activeClubId = await getActiveWorkClubId(user.id);
  const clubMembers = activeClubId
    ? await getClubMembersDirectory([activeClubId])
    : [];
  const monitorFilter =
    monitor && clubMembers.some((m) => m.id === monitor) ? monitor : null;
  const visibility = sharedWithClubCondition(
    groups.coachId,
    groups.clubId,
    user.id,
    activeClubId
  );

  const allRows = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdAt: groups.createdAt,
      memberCount: count(groupStudents.id),
      coachId: groups.coachId,
      authorName: users.name,
    })
    .from(groups)
    .leftJoin(groupStudents, eq(groupStudents.groupId, groups.id))
    .leftJoin(users, eq(users.id, groups.coachId))
    .where(visibility)
    .groupBy(groups.id, users.name)
    .orderBy(groups.name)
    .catch(
      () =>
        [] as {
          id: string;
          name: string;
          description: string | null;
          createdAt: Date;
          memberCount: number;
          coachId: string;
          authorName: string | null;
        }[]
    );

  // Monitores asignados por el gestor (solo en el espacio de un club).
  const coachesByGroup = activeClubId
    ? await listCoachesByGroupIds(allRows.map((r) => r.id)).catch(
        () => new Map<string, { id: string; name: string }[]>()
      )
    : new Map<string, { id: string; name: string }[]>();

  // El filtro por monitor incluye los grupos que creó y los que tiene asignados.
  const rows = monitorFilter
    ? allRows.filter(
        (r) =>
          r.coachId === monitorFilter ||
          (coachesByGroup.get(r.id) ?? []).some((c) => c.id === monitorFilter)
      )
    : allRows;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel flex flex-col gap-5 p-6 text-white sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
              <Users className="size-3.5" />
              Cohortes
            </div>
            <h1 className="break-words text-4xl font-black leading-tight sm:text-5xl">
              {personalTitle("Grupos", await getWorkMode(user.id))}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
              {rows.length} {rows.length === 1 ? "grupo" : "grupos"} para
              organizar alumnos, niveles y sesiones colectivas.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-3">
            <p className="text-[11px] font-black uppercase text-white/45">
              Total alumnos agrupados
            </p>
            <p className="mt-1 text-3xl font-black text-[#D6FF38]">
              {rows.reduce((sum, group) => sum + Number(group.memberCount), 0)}
            </p>
          </div>
        </header>

        {clubMembers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#050505]/10 bg-white p-2 shadow-[0_12px_40px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]">
            <span className="pl-2 text-[11px] font-bold uppercase tracking-wide text-foreground/45">
              Monitor
            </span>
            <Link
              href="/groups"
              className={cn(
                "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold transition-colors",
                !monitorFilter
                  ? "bg-[#050505] text-white dark:bg-[#D6FF38] dark:text-[#050505]"
                  : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
              )}
            >
              Todos
            </Link>
            {clubMembers.map((m) => (
              <Link
                key={m.id}
                href={`/groups?monitor=${m.id}`}
                className={cn(
                  "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold transition-colors",
                  monitorFilter === m.id
                    ? "bg-[#050505] text-white dark:bg-[#D6FF38] dark:text-[#050505]"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                )}
              >
                {m.id === user.id ? "Yo" : m.name}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
          {/* Groups grid */}
          <div>
            {rows.length === 0 ? (
              <div className="tp-panel flex flex-col items-center justify-center gap-4 border-dashed py-20 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border border-[#050505]/10 bg-[#F4F4F1] dark:border-white/10 dark:bg-white/[0.04]">
                  <Shield className="size-7 text-foreground/25" />
                </div>
                <div>
                  <p className="text-base font-black text-foreground/58">
                    Sin grupos todavía
                  </p>
                  <p className="mt-1 text-sm text-foreground/42">
                    Crea tu primer grupo para empezar.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {rows.map((g, i) => (
                  <Link
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className="group relative flex min-h-[220px] flex-col gap-4 rounded-[28px] border border-[#050505]/10 bg-white p-5 shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-[0_28px_90px_-60px_rgba(5,5,5,0.75)] dark:border-white/10 dark:bg-[#10100e]"
                  >
                    {/* Index badge */}
                    <span className="absolute top-4 right-4 font-mono text-[10px] text-foreground/20 tabular-nums">
                      {(i + 1).toString().padStart(2, "0")}
                    </span>

                    {/* Icon + count */}
                    <div className="flex items-start justify-between">
                      <div className="flex size-12 items-center justify-center rounded-full border border-brand/20 bg-brand/15">
                        <Users className="size-5 text-foreground" />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 rounded-full bg-[#F4F4F1] px-3 py-1 dark:bg-white/[0.06]">
                        <span className="text-[11px] font-black tabular-nums text-foreground/70">
                          {g.memberCount}
                        </span>
                        <span className="text-[10px] text-foreground/35">
                          {Number(g.memberCount) === 1 ? "alumno" : "alumnos"}
                        </span>
                      </div>
                    </div>

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[18px] font-black leading-tight text-foreground transition-colors group-hover:text-brand">
                        {g.name}
                        {g.coachId !== user.id && g.authorName && (
                          <span className="inline-flex items-center rounded-full border border-[#050505]/10 bg-[#F4F4F1] px-2 py-0.5 text-[10px] font-bold uppercase text-foreground/50 dark:border-white/10 dark:bg-white/[0.06]">
                            {g.authorName}
                          </span>
                        )}
                      </p>
                      {g.description ? (
                        <p className="text-[12px] text-foreground/45 mt-1.5 line-clamp-2 leading-relaxed">
                          {g.description}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[12px] italic text-foreground/30">
                          Sin descripción
                        </p>
                      )}
                    </div>

                    {(coachesByGroup.get(g.id) ?? []).length > 0 && (
                      <p className="truncate text-[11px] font-semibold text-foreground/55">
                        Monitores:{" "}
                        {(coachesByGroup.get(g.id) ?? [])
                          .map((c) => c.name)
                          .join(", ")}
                      </p>
                    )}

                    {/* CTA arrow */}
                    <div className="flex items-center justify-between border-t border-[#050505]/10 pt-3 dark:border-white/10">
                      <span className="text-[11px] font-black uppercase text-foreground/40">
                        Ver grupo
                      </span>
                      <ChevronRight className="size-4 text-foreground/25 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Create form sidebar */}
          <div className="lg:sticky lg:top-6">
            <div className="tp-panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-[#050505]/10 px-5 py-4 dark:border-white/10">
                <div className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Plus className="size-4" />
                </div>
                <h2 className="text-[13px] font-black uppercase text-foreground">
                  Nuevo grupo
                </h2>
              </div>
              <div className="p-5">
                <GroupCreateForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
