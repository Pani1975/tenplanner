"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  FileText,
  GraduationCap,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  MapPin,
  Menu,
  NotebookPen,
  Plus,
  ShieldCheck,
  UserCircle,
  Users,
  Users2,
  X,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { WorkModeBadge } from "./work-mode-badge";
import { spaceLabels } from "@/lib/space-labels";
import { SportBadge } from "./sport-badge";
import type { ClubOption } from "./club-context-select";
import type { Sport } from "@/lib/sport-constants";

type FeatureKey =
  | "drPlanner"
  | "sessionTemplates"
  | "exerciseCreation"
  | "groups"
  | "calendar";

type FeatureMap = Record<FeatureKey, boolean>;

interface SubItem {
  href: string;
  label: string;
  accent?: boolean;
  icon?: React.ElementType;
  feature?: FeatureKey;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  publicAccess?: boolean;
  feature?: FeatureKey;
  submenu?: SubItem[];
  /** Etiqueta usada para el primer item auto-generado del submenu (default "Ver todas") */
  allLabel?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  {
    href: "/exercises",
    label: "Ejercicios",
    icon: Dumbbell,
    publicAccess: true,
    allLabel: "Ver todos",
    submenu: [
      { href: "/exercises", label: "Biblioteca", icon: BookOpen },
      { href: "/exercises?tab=mine", label: "Mis ejercicios", icon: Dumbbell },
      { href: "/exercises?tab=favorites", label: "Favoritos", icon: Heart },
      { href: "/exercises?tab=drafts", label: "Borradores", icon: FileText },
      {
        href: "/exercises/new",
        label: "Nuevo ejercicio",
        icon: Plus,
        feature: "exerciseCreation",
      },
    ],
  },
  {
    href: "/classes",
    label: "Clases",
    icon: GraduationCap,
    publicAccess: true,
    allLabel: "Ver todas",
    submenu: [
      { href: "/classes", label: "Biblioteca", icon: BookOpen },
      { href: "/classes?tab=mine", label: "Mis clases", icon: GraduationCap },
      { href: "/classes?tab=favorites", label: "Mis listas", icon: Heart },
      { href: "/classes?tab=drafts", label: "Borradores", icon: FileText },
      { href: "/classes/new", label: "Nueva clase", icon: Plus },
    ],
  },
  {
    href: "/sessions",
    label: "Sesiones",
    icon: ClipboardList,
    allLabel: "Ver todas",
    submenu: [
      { href: "/sessions", label: "Mis sesiones", icon: ClipboardList },
      { href: "/sessions/favorites", label: "Listas", icon: Heart },
      { href: "/sessions?filter=drafts", label: "Borradores", icon: FileText },
      {
        href: "/sessions?filter=cancelled",
        label: "Canceladas",
        icon: XCircle,
      },
      { href: "/sessions/new", label: "Nueva sesión", icon: Plus },
    ],
  },
  {
    href: "/calendar",
    label: "Calendario",
    icon: CalendarDays,
    feature: "calendar",
  },
  {
    href: "/students",
    label: "Alumnos",
    icon: Users,
    allLabel: "Ver todos",
    submenu: [
      { href: "/students", label: "Lista de alumnos", icon: Users },
      { href: "/groups", label: "Grupos", icon: Users2, feature: "groups" },
    ],
  },
  { href: "/places", label: "Lugares", icon: MapPin },
  { href: "/resources", label: "Mis recursos", icon: BookMarked },
  { href: "/club", label: "Mi club", icon: Building2 },
  { href: "/profile", label: "Perfil", icon: UserCircle },
  { href: "/ayuda", label: "Ayuda", icon: LifeBuoy, publicAccess: true },
];

// En modo club, los apartados propios se nombran como del club ("Clases
// club"…) en vez de "Mis…" — ver lib/space-labels.ts.
function navItemsForSpace(inClub: boolean): NavItem[] {
  const labels = spaceLabels(inClub);
  const bySubHref: Record<string, string> = {
    "/exercises?tab=mine": labels.exercises,
    "/exercises?tab=favorites": labels.favorites,
    "/classes?tab=mine": labels.classes,
    "/classes?tab=favorites": labels.lists,
  };
  return navItems.map((item) =>
    item.submenu
      ? {
          ...item,
          submenu: item.submenu.map((sub) =>
            bySubHref[sub.href] ? { ...sub, label: bySubHref[sub.href] } : sub
          ),
        }
      : item
  );
}

interface WorkModeProps {
  workModeClubs?: ClubOption[];
  activeWorkClubId?: string | null;
  activeSport?: Sport;
}

interface SidebarNavProps extends WorkModeProps {
  user: {
    email?: string | null;
    user_metadata?: { full_name?: string };
  } | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  drPlannerEnabled?: boolean;
  features?: Partial<FeatureMap>;
  appName?: string;
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg bg-[#D6FF38] text-[#050505] shadow-[0_14px_40px_rgba(214,255,56,0.24)]",
        className
      )}
    >
      <NotebookPen className="size-4" strokeWidth={2} />
    </span>
  );
}

function NavContent({
  pathname,
  onNavigate,
  user,
  avatarUrl,
  isAdmin,
  features,
  onSignOut,
  appName,
  workModeClubs = [],
  activeWorkClubId = null,
  activeSport = "tenis",
}: {
  pathname: string;
  onNavigate?: () => void;
  user: SidebarNavProps["user"];
  avatarUrl?: string | null;
  isAdmin?: boolean;
  features: FeatureMap;
  onSignOut: () => void;
  appName?: string;
} & WorkModeProps) {
  const items = navItemsForSpace(!!activeWorkClubId);
  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Coach";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [submenuOpen, setSubmenuOpen] = useState<Record<string, boolean>>(
    () => {
      if (!user) return {};
      const initial: Record<string, boolean> = {};
      for (const item of items) {
        if (item.submenu && pathname.startsWith(item.href)) {
          initial[item.href] = true;
        }
      }
      return initial;
    }
  );

  function toggleSubmenu(href: string) {
    setSubmenuOpen((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent"
          onClick={onNavigate}
        >
          <BrandMark />
          <div className="min-w-0">
            <p className="truncate text-base font-black tracking-tight text-sidebar-foreground">
              {appName && appName !== "TenPlanner" ? appName : "TenPlanner"}
            </p>
          </div>
        </Link>
      </div>

      {user && (
        <div className="border-b border-sidebar-border px-3 py-3 space-y-2">
          <SportBadge activeSport={activeSport} />
          {workModeClubs.length > 0 && (
            <WorkModeBadge
              clubs={workModeClubs}
              activeClubId={activeWorkClubId}
            />
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {items.map(
            ({
              href,
              label,
              icon: Icon,
              submenu,
              publicAccess,
              feature,
              allLabel,
            }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + "/");
              const isOpen = !!submenuOpen[href];
              const isLocked = !user && !publicAccess;
              const featureLocked = feature ? !features[feature] : false;

              if (isLocked) {
                return (
                  <li key={href}>
                    <Link
                      href="/login"
                      onClick={onNavigate}
                      className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sidebar-foreground/46 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground/78"
                    >
                      <Icon className="size-4" strokeWidth={1.6} />
                      <span className="flex-1 truncate text-[13px] font-semibold">
                        {label}
                      </span>
                      <Lock
                        className="size-3 text-sidebar-foreground/34"
                        strokeWidth={1.8}
                      />
                    </Link>
                  </li>
                );
              }

              if (featureLocked) {
                return (
                  <li key={href}>
                    <span className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sidebar-foreground/38">
                      <Icon className="size-4" strokeWidth={1.6} />
                      <span className="flex-1 truncate text-[13px] font-semibold">
                        {label}
                      </span>
                      <Lock
                        className="size-3 text-sidebar-foreground/32"
                        strokeWidth={1.8}
                      />
                    </span>
                  </li>
                );
              }

              if (submenu) {
                return (
                  <li key={href}>
                    <button
                      type="button"
                      onClick={() => toggleSubmenu(href)}
                      className={cn(
                        "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4",
                          isActive ? "text-brand" : "text-sidebar-foreground/52"
                        )}
                        strokeWidth={1.6}
                      />
                      <span
                        className={cn(
                          "flex-1 truncate text-[13px] font-semibold",
                          isActive && "text-sidebar-foreground"
                        )}
                      >
                        {label}
                      </span>
                      <ChevronRight
                        className={cn(
                          "size-3.5 text-sidebar-foreground/38 transition-transform",
                          isOpen && "rotate-90 text-brand"
                        )}
                        strokeWidth={1.8}
                      />
                    </button>

                    {isOpen && (
                      <ul className="ml-5 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pb-2 pl-4 pr-1">
                        <li>
                          <Link
                            href={href}
                            onClick={onNavigate}
                            className={cn(
                              "block rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
                              pathname === href
                                ? "bg-brand text-brand-foreground"
                                : "text-sidebar-foreground/58 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            {allLabel ?? "Ver todas"}
                          </Link>
                        </li>
                        {submenu.map(
                          ({
                            href: subHref,
                            label: subLabel,
                            accent,
                            feature,
                            icon: SubIcon,
                          }) => {
                            const isSubActive =
                              pathname === subHref ||
                              pathname.startsWith(subHref + "/");
                            const featureLocked = feature
                              ? !features[feature]
                              : false;

                            if (featureLocked) {
                              return (
                                <li key={subHref}>
                                  <span className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] text-sidebar-foreground/38">
                                    <span>{subLabel}</span>
                                    <Lock className="size-3 text-sidebar-foreground/32" />
                                  </span>
                                </li>
                              );
                            }

                            return (
                              <li key={subHref}>
                                <Link
                                  href={subHref}
                                  onClick={onNavigate}
                                  className={cn(
                                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
                                    isSubActive
                                      ? "bg-brand text-brand-foreground"
                                      : accent
                                        ? "text-brand hover:bg-sidebar-accent"
                                        : "text-sidebar-foreground/58 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                  )}
                                >
                                  {SubIcon && (
                                    <SubIcon
                                      className="size-3.5 shrink-0"
                                      strokeWidth={1.7}
                                    />
                                  )}
                                  <span className="truncate">{subLabel}</span>
                                </Link>
                              </li>
                            );
                          }
                        )}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-lg px-3 transition-colors",
                      isActive
                        ? "bg-brand text-brand-foreground shadow-[0_12px_32px_color-mix(in_oklab,var(--brand)_26%,transparent)]"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4",
                        isActive
                          ? "text-brand-foreground"
                          : "text-sidebar-foreground/52"
                      )}
                      strokeWidth={1.6}
                    />
                    <span
                      className={cn(
                        "flex-1 truncate text-[13px] font-semibold",
                        isActive && "font-black text-brand-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </Link>
                </li>
              );
            }
          )}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border bg-sidebar-accent/45">
        {isAdmin && (
          <div className="px-4 pt-3">
            <Link
              href="/admin"
              onClick={onNavigate}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-bold transition-colors",
                pathname.startsWith("/admin")
                  ? "border-brand/70 bg-brand text-brand-foreground"
                  : "border-sidebar-border text-sidebar-foreground/64 hover:border-sidebar-ring/45 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <ShieldCheck className="size-3.5 shrink-0" strokeWidth={1.8} />
              Panel de administración
            </Link>
          </div>
        )}
        {user ? (
          <>
            <div className="px-4 pt-4 pb-3">
              <p className="mb-2.5 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                Cuenta
              </p>
              <Link
                href="/profile"
                onClick={onNavigate}
                className="group grid grid-cols-[auto_1fr] items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/70 px-3 py-3 transition-colors hover:border-sidebar-ring/50 hover:bg-sidebar-accent"
              >
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border bg-sidebar transition-colors group-hover:border-sidebar-ring/70">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={displayName}
                      width={36}
                      height={36}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-black text-sidebar-foreground">
                      {initials}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold leading-tight text-sidebar-foreground">
                    {displayName}
                  </p>
                  <p className="mt-px truncate text-[11px] tabular-nums text-sidebar-foreground/50">
                    {user.email}
                  </p>
                </div>
              </Link>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={onSignOut}
                className="group flex items-center gap-2 rounded-lg py-2 text-left text-[12px] font-semibold text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
              >
                <LogOut className="size-3.5" strokeWidth={1.6} />
                Cerrar sesión
              </button>
              <ThemeToggle compact />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-4">
            <Link
              href="/login"
              onClick={onNavigate}
              className="flex min-h-9 items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/70 px-3 text-[12px] font-bold text-sidebar-foreground transition-colors hover:border-sidebar-ring hover:bg-brand hover:text-brand-foreground"
            >
              <Lock className="size-3.5" strokeWidth={1.8} />
              Iniciar sesión
            </Link>
            <ThemeToggle compact />
          </div>
        )}
      </div>
    </div>
  );
}

export function SidebarNav({
  user,
  avatarUrl,
  isAdmin = false,
  drPlannerEnabled = true,
  features,
  appName,
  workModeClubs = [],
  activeWorkClubId = null,
  activeSport = "tenis",
}: SidebarNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(false);

  const activeLabel =
    navItems.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    )?.label ?? "TenPlanner";
  const resolvedFeatures: FeatureMap = {
    drPlanner: drPlannerEnabled,
    sessionTemplates: features?.sessionTemplates ?? true,
    exerciseCreation: features?.exerciseCreation ?? true,
    groups: features?.groups ?? true,
    calendar: features?.calendar ?? true,
  };

  useEffect(() => {
    if (mobileOpen) {
      prevOpenRef.current = true;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      closeButtonRef.current?.focus();

      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          setMobileOpen(false);
          return;
        }
        if (e.key !== "Tab" || !drawerRef.current) return;
        const focusable = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }

      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = previousOverflow;
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    if (prevOpenRef.current) {
      triggerRef.current?.focus();
      prevOpenRef.current = false;
    }
  }, [mobileOpen]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[18.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <NavContent
          pathname={pathname}
          user={user}
          avatarUrl={avatarUrl}
          isAdmin={isAdmin}
          features={resolvedFeatures}
          onSignOut={handleSignOut}
          appName={appName}
          workModeClubs={workModeClubs}
          activeWorkClubId={activeWorkClubId}
          activeSport={activeSport}
        />
      </aside>

      <header className="sticky top-0 z-40 flex flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/dashboard"
              className="flex min-w-0 shrink items-center gap-2.5"
            >
              <BrandMark className="size-9" />
              <span className="truncate text-sm font-black tracking-tight">
                {appName && appName !== "TenPlanner" ? appName : "TenPlanner"}
              </span>
            </Link>
            <span className="text-sidebar-foreground/24" aria-hidden>
              /
            </span>
            <span className="truncate text-xs font-bold uppercase tracking-[0.14em] text-sidebar-foreground/54">
              {activeLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle compact />
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Abrir menú"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
            >
              <Menu className="size-5" strokeWidth={1.8} />
            </button>
          </div>
        </div>
        {user && (
          <div className="px-4 pb-3 space-y-2">
            <SportBadge activeSport={activeSport} />
            {workModeClubs.length > 0 && (
              <WorkModeBadge
                clubs={workModeClubs}
                activeClubId={activeWorkClubId}
              />
            )}
          </div>
        )}
      </header>

      {mobileOpen && (
        <div
          ref={drawerRef}
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className="fixed inset-0 z-50 flex md:hidden"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-[#050505]/68 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú de navegación"
            tabIndex={-1}
          />
          <aside className="relative flex h-full w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[24px_0_80px_rgba(0,0,0,0.32)]">
            <div className="absolute right-3 top-3 z-10">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                aria-label="Cerrar menú"
              >
                <X className="size-4" strokeWidth={1.8} />
              </button>
            </div>
            <NavContent
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              user={user}
              avatarUrl={avatarUrl}
              isAdmin={isAdmin}
              features={resolvedFeatures}
              onSignOut={handleSignOut}
              appName={appName}
              workModeClubs={workModeClubs}
              activeWorkClubId={activeWorkClubId}
              activeSport={activeSport}
            />
          </aside>
        </div>
      )}
    </>
  );
}
