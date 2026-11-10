import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  sessions as sessionsTable,
  exercises as exercisesTable,
  users as usersTable,
  clubs,
  clubMembers,
} from "@/db/schema";
import { and, eq, count, or, sql } from "drizzle-orm";
import { ProfileClient } from "./profile-client";
import { OwnCoachProfile } from "./own-coach-profile";
import { getOwnCoachProfiles } from "@/lib/club-coach-profiles";
import { WorkModeSwitcher } from "@/components/app/work-mode-switcher";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { SportSwitcher } from "@/components/app/sport-switcher";
import {
  getActiveWorkClubId,
  getClubAccountClubId,
  getClubOptionsForUser,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) redirect("/login");

  const [clubOptions, activeClubId, activeSport] = await Promise.all([
    getClubOptionsForUser(user.id),
    getActiveWorkClubId(user.id),
    getActiveSport(user.id),
  ]);

  const [sessionStatsRows, exerciseCountRows, dbUser] = await Promise.all([
    db
      .select({
        totalSessions: count(sessionsTable.id),
        totalMinutes: sql<number>`COALESCE(SUM(${sessionsTable.durationMinutes}), 0)`,
        upcomingSessions: sql<number>`COUNT(*) FILTER (WHERE ${sessionsTable.scheduledAt} >= now())`,
      })
      .from(sessionsTable)
      .where(
        sharedWithClubCondition(
          sessionsTable.userId,
          sessionsTable.clubId,
          user.id,
          activeClubId
        )
      ),
    db
      .select({ count: count() })
      .from(exercisesTable)
      .where(
        or(
          eq(exercisesTable.isGlobal, true),
          eq(exercisesTable.createdBy, user.id)
        )
      ),
    db
      .select({
        image: usersTable.image,
        isAdmin: usersTable.isAdmin,
        isPlatformAccount: usersTable.isPlatformAccount,
        adminMode: usersTable.adminMode,
        managementMode: usersTable.managementMode,
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1),
  ]);

  const clubAccountClubId = await getClubAccountClubId(user.id);

  // Perfil de monitor (su ficha): solo si es monitor de algún club y no es
  // la cuenta de un club. Lo controla él; el gestor lo ve en Gestión.
  const coachClubs = clubAccountClubId ? [] : clubOptions;
  const ownCoachProfile =
    coachClubs.length > 0 && user.email
      ? await (async () => {
          const { rows } = await getOwnCoachProfiles(user.id, user.email!);
          const latest = rows[0];
          return {
            clubNames: coachClubs.map((c) => c.name),
            initial: latest
              ? {
                  fullName: latest.fullName,
                  email: user.email!,
                  phone: latest.phone,
                  academicTraining: latest.academicTraining,
                  tennisTraining: latest.tennisTraining,
                  availability: latest.availability ?? null,
                  startedTeachingYear: latest.startedTeachingYear,
                  experience: latest.experience ?? [],
                }
              : {
                  fullName:
                    (user.user_metadata?.full_name as string | undefined) ?? "",
                  email: user.email!,
                },
          };
        })()
      : null;

  // Ficha de identificación del club con el que se trabaja (modo club).
  const [activeClub] = activeClubId
    ? await db.select().from(clubs).where(eq(clubs.id, activeClubId)).limit(1)
    : [];
  const activeClubIsOwner = activeClub
    ? (
        await db
          .select({ id: clubMembers.id })
          .from(clubMembers)
          .where(
            and(
              eq(clubMembers.clubId, activeClub.id),
              eq(clubMembers.userId, user.id),
              eq(clubMembers.role, "owner"),
              eq(clubMembers.status, "active")
            )
          )
          .limit(1)
      ).length > 0
    : false;

  const sessionStats = sessionStatsRows[0];
  const totalSessions = Number(sessionStats?.totalSessions ?? 0);
  const totalMinutes = Number(sessionStats?.totalMinutes ?? 0);
  const upcomingSessions = Number(sessionStats?.upcomingSessions ?? 0);

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            Cuenta
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Perfil
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Ajusta tus datos, apariencia, exportación y actividad desde un solo
            panel de trabajo.
          </p>
        </header>

        <SportSwitcher activeSport={activeSport} />

        {!dbUser[0]?.isPlatformAccount && (
          <WorkModeSwitcher
            key={
              dbUser[0]?.isAdmin && dbUser[0]?.adminMode
                ? "admin"
                : clubAccountClubId && dbUser[0]?.managementMode
                  ? "gestion"
                  : (activeClubId ?? "particular")
            }
            clubs={clubOptions}
            activeClubId={activeClubId}
            canUseTenPlanner={!!dbUser[0]?.isAdmin}
            tenPlannerActive={!!dbUser[0]?.isAdmin && !!dbUser[0]?.adminMode}
            clubAccountClubId={clubAccountClubId}
            managementActive={!!dbUser[0]?.managementMode}
          />
        )}

        {/* La ficha del club está en "Mi club"; el Espacio gestión solo
            muestra los datos de la persona gestora. */}
        {activeClub && !(clubAccountClubId && dbUser[0]?.managementMode) && (
          <Link
            href="/club"
            className="tp-panel flex items-center gap-3 p-5 transition-colors hover:border-brand/50"
          >
            <Building2 className="size-5 shrink-0 text-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black uppercase text-foreground">
                Ficha del club · {activeClub.name}
              </span>
              <span className="mt-1 block text-xs text-foreground/55">
                {activeClubIsOwner
                  ? "Datos, fotos, vídeos e instalaciones del club: edítalos en Mi club."
                  : "Datos, fotos, vídeos e instalaciones del club, en Mi club."}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-foreground/40" />
          </Link>
        )}

        {ownCoachProfile && (
          <OwnCoachProfile
            initial={ownCoachProfile.initial}
            clubNames={ownCoachProfile.clubNames}
          />
        )}

        <ProfileClient
          user={{
            id: user.id,
            email: user.email ?? null,
            full_name: user.user_metadata?.full_name ?? null,
            avatar_color: user.user_metadata?.avatar_color ?? null,
            avatar_url:
              dbUser[0]?.image ?? user.user_metadata?.avatar_url ?? null,
            provider: user.app_metadata?.provider ?? "email",
            created_at: user.created_at ?? "",
          }}
          stats={{
            totalSessions,
            totalMinutes,
            totalExercises: Number(exerciseCountRows[0]?.count ?? 0),
            upcomingSessions,
          }}
        />
      </div>
    </div>
  );
}
