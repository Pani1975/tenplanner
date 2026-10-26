import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import AppShell from "@/components/app/app-shell";
import { getAppSettings } from "@/lib/app-settings";
import {
  getActiveWorkClubId,
  getClubAccountClubId,
  getClubOptionsForUser,
} from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    adminRows,
    appSettings,
    workModeClubs,
    activeWorkClubId,
    activeSport,
    clubAccountClubId,
  ] = await Promise.all([
    user
      ? db
          .select({
            isAdmin: users.isAdmin,
            image: users.image,
            isPlatformAccount: users.isPlatformAccount,
            adminMode: users.adminMode,
            managementMode: users.managementMode,
          })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1)
      : Promise.resolve(
          [] as {
            isAdmin: boolean | null;
            image: string | null;
            isPlatformAccount: boolean | null;
            adminMode: boolean | null;
            managementMode: boolean | null;
          }[]
        ),
    getAppSettings(["system.maintenance_banner", "feature.dr_planner_enabled"]),
    user ? getClubOptionsForUser(user.id) : Promise.resolve([]),
    user ? getActiveWorkClubId(user.id) : Promise.resolve(null),
    user ? getActiveSport(user.id) : Promise.resolve(undefined),
    user ? getClubAccountClubId(user.id) : Promise.resolve(null),
  ]);

  const isAdmin = adminRows[0]?.isAdmin ?? false;
  const row = adminRows[0];
  const avatarUrl =
    adminRows[0]?.image ??
    (typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null);
  const maintenanceBanner =
    typeof appSettings.get("system.maintenance_banner") === "string"
      ? String(appSettings.get("system.maintenance_banner"))
      : "";
  const drPlannerEnabled =
    appSettings.get("feature.dr_planner_enabled") === true;

  return (
    <AppShell
      user={user}
      avatarUrl={avatarUrl}
      isAdmin={isAdmin}
      drPlannerEnabled={drPlannerEnabled}
      maintenanceBanner={maintenanceBanner}
      workModeClubs={workModeClubs}
      activeWorkClubId={activeWorkClubId}
      activeSport={activeSport}
      tenPlannerMode={!!row?.isPlatformAccount || (isAdmin && !!row?.adminMode)}
      platformAccount={!!row?.isPlatformAccount}
      clubAccountClubId={clubAccountClubId}
      managementMode={!!clubAccountClubId && !!row?.managementMode}
    >
      {children}
    </AppShell>
  );
}
