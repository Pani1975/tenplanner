import type { User } from "@supabase/supabase-js";
import { MaintenanceBanner } from "./maintenance-banner";
import { SidebarNav } from "./sidebar-nav";
import type { ClubOption } from "./club-context-select";
import type { Sport } from "@/lib/sport-constants";

interface AppShellProps {
  children: React.ReactNode;
  user: User | null;
  avatarUrl: string | null;
  isAdmin?: boolean;
  drPlannerEnabled?: boolean;
  features?: {
    sessionTemplates?: boolean;
    exerciseCreation?: boolean;
    groups?: boolean;
    calendar?: boolean;
  };
  maintenanceBanner?: string;
  appName?: string;
  workModeClubs?: ClubOption[];
  activeWorkClubId?: string | null;
  activeSport?: Sport;
  /** Vista simplificada para familias: solo Mensajes (ver lib/family.ts) */
  familyOnly?: boolean;
}

export default function AppShell({
  children,
  user,
  avatarUrl,
  isAdmin = false,
  drPlannerEnabled = true,
  features,
  maintenanceBanner,
  appName,
  workModeClubs = [],
  activeWorkClubId = null,
  activeSport = "tenis",
  familyOnly = false,
}: AppShellProps) {
  return (
    <div className="app-shell relative flex h-dvh flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-px bg-brand"
      />
      <SidebarNav
        user={user}
        avatarUrl={avatarUrl}
        isAdmin={isAdmin}
        drPlannerEnabled={drPlannerEnabled}
        features={features}
        appName={appName}
        workModeClubs={workModeClubs}
        activeWorkClubId={activeWorkClubId}
        activeSport={activeSport}
        familyOnly={familyOnly}
      />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.028] dark:opacity-[0.055]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(5,5,5,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(5,5,5,.45) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <MaintenanceBanner message={maintenanceBanner} />
        <main
          id="main"
          className="relative min-w-0 flex-1 overflow-y-auto w-full"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
