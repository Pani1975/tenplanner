"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LandingScreen } from "@/lib/landing-screens";

const INTERVAL_MS = 4500;

/**
 * Marco de móvil con capturas reales de la app que se van alternando.
 * Se pausa al pasar el ratón o el dedo, y respeta "reducir movimiento".
 */
export function AppScreensPhone({ screens }: { screens: LandingScreen[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (screens.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % screens.length),
      INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, [screens.length, paused]);

  return (
    <div
      className="mx-auto w-[282px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="relative w-[282px] rounded-[42px] bg-[#050505] p-[9px] shadow-[0_45px_100px_rgba(5,5,5,0.22)] ring-1 ring-black/10">
        {/* Las capturas son 1080×1917: el hueco de pantalla mantiene esa forma. */}
        <div className="relative aspect-[1080/1917] w-full overflow-hidden rounded-[34px] bg-[#eeeee8]">
          {screens.map((screen, i) => (
            <Image
              key={screen.src}
              src={screen.src}
              alt={screen.alt}
              fill
              sizes="264px"
              priority={i === 0}
              className={cn(
                "object-cover object-top transition-opacity duration-700",
                i === index ? "opacity-100" : "opacity-0"
              )}
              aria-hidden={i !== index}
            />
          ))}
          {/* Isla del teléfono, para que se lea como un móvil */}
          <span
            aria-hidden
            className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-[#050505]"
          />
        </div>
      </div>

      {screens.length > 1 && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <p className="min-h-5 text-sm font-semibold text-[#4d4d45]">
            {screens[index]?.label}
          </p>
          <div className="flex items-center gap-2">
            {screens.map((screen, i) => (
              <button
                key={screen.src}
                type="button"
                onClick={() => {
                  setIndex(i);
                  setPaused(true);
                }}
                aria-label={`Ver ${screen.label}`}
                aria-current={i === index}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index
                    ? "w-6 bg-[#050505]"
                    : "w-2 bg-[#050505]/20 hover:bg-[#050505]/40"
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
