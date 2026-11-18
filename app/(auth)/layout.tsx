import Image from "next/image";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/app/language-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tx = await getTranslations("ui.s_auth_layout");
  const t = await getTranslations("auth.layout");
  return (
    <div className="min-h-screen bg-[#F4F4F1] text-[#050505] dark:bg-[#050505] dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
        <aside className="relative hidden overflow-hidden border-r border-[#050505]/10 bg-[#050505] text-white dark:border-white/10 lg:block">
          <Image
            src="/landing/racket-motion.jpg"
            alt={t("imageAlt")}
            fill
            priority
            sizes="42vw"
            className="object-cover opacity-58 saturate-125"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,5,0.16),rgba(5,5,5,0.88))]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(214,255,56,0.18)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:52px_52px] opacity-30" />

          <div className="relative z-10 flex h-full flex-col justify-between p-8 xl:p-10">
            <Link href="/" className="flex w-fit items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-[#D6FF38] text-[#050505]">
                <NotebookPen className="size-4" strokeWidth={2} />
              </span>
              <span className="text-lg font-black tracking-tight">
                {tx("tenplanner")}
              </span>
            </Link>

            <div className="max-w-xl pb-4">
              <span className="inline-flex rounded-lg bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#050505]">
                {t("badge")}
              </span>
              <h2 className="mt-5 text-5xl font-black leading-[0.92] xl:text-6xl">
                {t("headline")}
              </h2>
              <p className="mt-5 max-w-md text-sm font-semibold leading-7 text-white/66">
                {t("tagline")}
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between border-b border-[#050505]/10 bg-white/70 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-white/[0.04] lg:justify-end lg:border-0 lg:bg-transparent lg:px-6 lg:pt-5">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="grid size-9 place-items-center rounded-lg bg-[#D6FF38] text-[#050505]">
                <NotebookPen className="size-4" strokeWidth={2} />
              </span>
              <span className="text-sm font-black tracking-tight">
                {tx("tenplanner")}
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle compact />
            </div>
          </header>

          <main
            id="main"
            className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-10"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(5,5,5,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(5,5,5,.45) 1px, transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />
            <div className="relative w-full max-w-md">{children}</div>
          </main>

          <footer className="px-4 pb-6 text-center text-xs font-medium text-[#050505]/46 dark:text-white/40">
            {t("termsBefore")}{" "}
            <Link
              href="/terminos"
              className="font-bold underline decoration-[#050505]/20 underline-offset-4 transition-colors hover:text-[#050505] dark:decoration-white/20 dark:hover:text-white"
            >
              {t("termsLink")}
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
