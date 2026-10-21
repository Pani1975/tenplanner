import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import {
  sessions as sessionsTable,
  exercises as exercisesTable,
  users as usersTable,
} from "@/db/schema";
import { eq, count, or, sql } from "drizzle-orm";
import { ProfileClient } from "./profile-client";
import { WorkModeSwitcher } from "@/components/app/work-mode-switcher";
import { SportSwitcher } from "@/components/app/sport-switcher";
import {
  getActiveWorkClubId,
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
      })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1),
  ]);

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
          <WorkModeSwitcher clubs={clubOptions} activeClubId={activeClubId} />
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
