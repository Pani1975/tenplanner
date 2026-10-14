"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "cookie-consent";
const CURRENT_VERSION = "v2-essential-plus-cookieless-analytics";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function CookieBanner() {
  const stored = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [dismissed, setDismissed] = useState(false);

  let needsBanner = false;
  if (!dismissed) {
    if (!stored) {
      needsBanner = true;
    } else {
      try {
        const parsed = JSON.parse(stored) as { version?: string };
        needsBanner = parsed.version !== CURRENT_VERSION;
      } catch {
        needsBanner = true;
      }
    }
  }

  function acknowledge() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: CURRENT_VERSION,
          acknowledgedAt: new Date().toISOString(),
          level: "essential",
        })
      );
    } catch {
      // localStorage may be blocked; we still dismiss for the session.
    }
    setDismissed(true);
  }

  if (!needsBanner) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-copy"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-6 sm:pb-6"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-lg border border-[#050505]/10 bg-white p-4 text-[#050505] shadow-[0_24px_70px_-30px_rgba(5,5,5,0.55)] backdrop-blur dark:border-white/12 dark:bg-[#101010] dark:text-white sm:p-5">
        <div className="flex items-start gap-3">
          <div className="hidden size-9 shrink-0 items-center sm:flex justify-center rounded-lg border border-[#D6FF38]/60 bg-[#D6FF38] text-[#050505]">
            <Cookie className="size-4" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              id="cookie-banner-title"
              className="text-sm font-black uppercase tracking-[0.14em]"
            >
              Solo cookies técnicas
            </p>
            <p
              id="cookie-banner-copy"
              className="mt-1.5 text-[13px] font-medium leading-relaxed text-[#050505]/68 dark:text-white/62 sm:mt-2"
            >
              <span className="sm:hidden">
                Sin publicidad ni rastreo: solo lo necesario para que la app
                funcione y una analítica anónima. Más en la{" "}
              </span>
              <span className="hidden sm:inline">
                Usamos cookies y almacenamiento local estrictamente necesarios
                (sesión y preferencias). Además medimos las visitas de forma
                agregada y anónima con Vercel Analytics, que no usa cookies ni
                te identifica. No hay publicidad ni tracking entre sitios. Más
                info en la{" "}
              </span>
              <Link
                href="/cookies"
                className="font-bold underline decoration-[#050505]/24 underline-offset-4 hover:text-[#050505] dark:decoration-white/24 dark:hover:text-white"
              >
                política de cookies
              </Link>
              .
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-3">
              <button
                onClick={acknowledge}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#050505] px-4 text-[12px] font-black text-white transition-colors hover:bg-[#D6FF38] hover:text-[#050505] dark:bg-[#D6FF38] dark:text-[#050505] dark:hover:bg-white"
              >
                Entendido
              </button>
              <Link
                href="/privacidad"
                className="inline-flex min-h-11 items-center text-[12px] font-bold text-[#050505]/54 underline decoration-[#050505]/24 underline-offset-4 hover:text-[#050505] dark:text-white/52 dark:decoration-white/24 dark:hover:text-white"
              >
                Ver política de privacidad
              </Link>
            </div>
          </div>
          <button
            onClick={acknowledge}
            aria-label="Cerrar aviso"
            className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-[#050505]/46 transition-colors hover:bg-[#050505]/5 hover:text-[#050505] dark:text-white/46 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </div>
  );
}
