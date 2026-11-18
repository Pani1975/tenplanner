"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyAccentColor } from "@/lib/accent-colors";
import { useTranslations } from "next-intl";

type VTDocument = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

function getTimeBasedDarkMode() {
  const hour = new Date().getHours();
  return hour < 7 || hour >= 21;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const tx = useTranslations("ui.s_app_themetoggle");
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    function syncThemeState() {
      const autoTheme = localStorage.getItem("theme-auto") !== "false";
      const stored = localStorage.getItem("theme");
      const nextDark = autoTheme
        ? getTimeBasedDarkMode()
        : stored
          ? stored === "dark"
          : getTimeBasedDarkMode();

      setIsDark(nextDark);
      document.documentElement.classList.toggle("dark", nextDark);
      applyAccentColor(localStorage.getItem("accent") ?? "blue");
    }

    /* eslint-disable react-hooks/set-state-in-effect -- hydration-safe read from localStorage */
    setMounted(true);
    syncThemeState();
    /* eslint-enable react-hooks/set-state-in-effect */

    window.addEventListener("storage", syncThemeState);
    window.addEventListener("theme-auto-change", syncThemeState);
    return () => {
      window.removeEventListener("storage", syncThemeState);
      window.removeEventListener("theme-auto-change", syncThemeState);
    };
  }, []);

  function applyTheme(next: boolean) {
    setIsDark(next);
    localStorage.setItem("theme-auto", "false");
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    const accent = localStorage.getItem("accent") ?? "blue";
    applyAccentColor(accent);
    window.dispatchEvent(new Event("theme-auto-change"));
  }

  async function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !isDark;
    const vtDoc = document as VTDocument;

    if (!vtDoc.startViewTransition) {
      applyTheme(next);
      return;
    }

    const { clientX: x, clientY: y } = e;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = vtDoc.startViewTransition(() => applyTheme(next));

    try {
      await transition.ready;
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 420,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    } catch {
      // Transición interrumpida o no compatible
    }
  }

  if (!mounted) return <div className={compact ? "size-9" : "h-10"} />;

  return (
    <button
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? tx("cambiarAModoClaro") : tx("cambiarAModoOscuro")}
      className={cn(
        "group border font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6FF38] disabled:pointer-events-none disabled:opacity-50",
        compact
          ? "flex size-9 items-center justify-center rounded-lg border-[#050505]/10 bg-white text-[#050505] shadow-sm hover:bg-[#D6FF38] dark:border-white/10 dark:bg-white/[0.08] dark:text-white dark:hover:bg-[#D6FF38] dark:hover:text-[#050505]"
          : "flex h-10 w-full items-center justify-between gap-3 rounded-lg border-border bg-card px-3 text-sm text-foreground hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505] dark:border-white/10 dark:bg-white/[0.05] dark:text-white"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {isDark ? (
          <Sun className="size-4 shrink-0" />
        ) : (
          <Moon className="size-4 shrink-0" />
        )}
        {!compact && <span>{isDark ? "Modo claro" : "Modo oscuro"}</span>}
      </span>
      {!compact && (
        <span className="size-2 rounded-full bg-[#D6FF38] shadow-[0_0_0_4px_rgba(214,255,56,0.16)]" />
      )}
    </button>
  );
}
