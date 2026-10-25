"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Ejercicios", href: "/exercises" },
  { label: "Clases", href: "/classes" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#050505]/10 bg-[#f4f4f1]/94 px-5 py-5 backdrop-blur">
      <div className="mx-auto flex max-w-[1710px] items-center justify-between gap-4">
        <Link
          href="/"
          className="font-heading text-[22px] font-bold text-[#050505]"
          onClick={() => setOpen(false)}
        >
          Ten<span className="text-[#5f7000]">·</span>Planner
        </Link>
        <nav className="hidden items-center gap-10 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-[#4d4d45] transition hover:text-[#5f7000]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden min-h-11 items-center px-4 text-sm font-medium text-[#4d4d45] transition hover:text-[#5f7000] md:inline-flex"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="hidden min-h-11 items-center rounded-full bg-[#050505] px-6 text-sm font-bold text-white transition hover:bg-[#d6ff38] hover:text-[#050505] md:inline-flex"
          >
            Registrarse
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            className="grid size-11 place-items-center rounded-full border border-[#050505]/12 bg-white text-[#050505] transition hover:border-[#5f7000] md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={cn(
          "mx-auto mt-4 max-w-[1710px] origin-top overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out md:hidden",
          open ? "grid grid-rows-[1fr] opacity-100" : "grid grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-1 rounded-2xl border border-[#050505]/10 bg-white p-3 shadow-[0_24px_55px_rgba(5,5,5,0.08)]">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-[#050505] transition hover:bg-[#f4f4f1]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium text-[#050505] transition hover:bg-[#f4f4f1]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex justify-center rounded-full bg-[#050505] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#d6ff38] hover:text-[#050505]"
            >
              Registrarse →
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
