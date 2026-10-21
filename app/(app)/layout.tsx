import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import AppShell from "@/components/app/app-shell";
import { getAppSettings, type SettingKey } from "@/lib/app-settings";
import {
  getActiveWorkClubId,
  getClubOptionsForUser,
  getPendingInvitesForEmail,
} from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import { isFamilyOnlyUser } from "@/lib/family";
import { isFamilyAccountType } from "@/lib/family-account";
import { countUnreadMessages } from "@/lib/messages";

const APP_LAYOUT_SETTING_KEYS = [
  "feature.dr_planner_enabled",
  "feature.session_templates_enabled",
  "feature.exercise_creation_enabled",
  "feature.groups_enabled",
  "feature.calendar_enabled",
  "system.maintenance_banner",
  "brand.app_name",
] as const satisfies readonly SettingKey[];

type SettingsMap = Awaited<ReturnType<typeof getAppSettings>>;

function booleanSetting(
  settings: SettingsMap,
  key: SettingKey,
  fallback = false
) {
  const value = settings.get(key);
  return typeof value === "boolean" ? value : fallback;
}

function stringSetting(settings: SettingsMap, key: SettingKey, fallback = "") {
  const value = settings.get(key);
  return typeof value === "string" ? value : fallback;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    [row],
    appSettings,
    workModeClubs,
    activeWorkClubId,
    activeSport,
    familyOnly,
    pendingInvites,
    unreadMessages,
  ] = await Promise.all([
    db
      .select({
        isAdmin: users.isAdmin,
        image: users.image,
        tenPlannerMode: users.tenPlannerMode,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
    getAppSettings(APP_LAYOUT_SETTING_KEYS),
    getClubOptionsForUser(user.id),
    getActiveWorkClubId(user.id),
    getActiveSport(user.id),
    // Si falla (p. ej. sin tablas de mensajes), se muestra la app completa
    isFamilyOnlyUser(user.id, isFamilyAccountType(user.user_metadata)).catch(
      () => false
    ),
    // Invitaciones de club a su email: se avisan dentro de la app
    getPendingInvitesForEmail(user.id, user.email).catch(() => []),
    // Contador de mensajes nuevos junto a "Mensajes"
    countUnreadMessages(user.id).catch(() => 0),
  ]);

  const isAdmin = row?.isAdmin ?? false;
  const avatarUrl =
    row?.image ??
    (typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null);
  const drPlannerEnabled = booleanSetting(
    appSettings,
    "feature.dr_planner_enabled",
    false
  );
  const maintenanceBanner = stringSetting(
    appSettings,
    "system.maintenance_banner"
  );
  const appName = stringSetting(appSettings, "brand.app_name", "TenPlanner");

  return (
    <AppShell
      user={user}
      avatarUrl={avatarUrl}
      isAdmin={isAdmin}
      drPlannerEnabled={drPlannerEnabled}
      features={{
        sessionTemplates: booleanSetting(
          appSettings,
          "feature.session_templates_enabled",
          true
        ),
        exerciseCreation: booleanSetting(
          appSettings,
          "feature.exercise_creation_enabled",
          true
        ),
        groups: booleanSetting(appSettings, "feature.groups_enabled", true),
        calendar: booleanSetting(appSettings, "feature.calendar_enabled", true),
      }}
      maintenanceBanner={maintenanceBanner}
      appName={appName}
      workModeClubs={workModeClubs}
      activeWorkClubId={activeWorkClubId}
      tenPlannerMode={isAdmin && !!row?.tenPlannerMode}
      activeSport={activeSport}
      familyOnly={familyOnly}
      pendingInvites={pendingInvites}
      unreadMessages={unreadMessages}
    >
      {children}
    </AppShell>
  );
}
