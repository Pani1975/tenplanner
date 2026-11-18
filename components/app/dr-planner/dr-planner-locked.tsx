import Link from "next/link";
import { Bot, Lock, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

export function DrPlannerLocked({ isAdmin = false }: { isAdmin?: boolean }) {
  const tx = useTranslations("ui.s_drplanner_drplannerlocked");
  return (
    <div className="relative px-4 py-10 sm:px-6 md:px-10">
      <div className="mx-auto flex min-h-[52vh] max-w-2xl flex-col items-center justify-center gap-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-xl border border-foreground/12 bg-card text-foreground/45">
          <Lock className="size-7" strokeWidth={1.6} />
        </div>
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-foreground/40">
            {tx("drPlanner")}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
            {tx("iaProximamente")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/58">
            {tx("elAsistenteEstaDesactivado")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href="/sessions"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-foreground/15 px-4 text-sm font-medium text-foreground/65 transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <Bot className="size-4" />
            {tx("volverASesiones")}
          </Link>
          {isAdmin && (
            <Link
              href="/admin/settings"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-4 text-sm font-semibold text-brand transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              <SlidersHorizontal className="size-4" />
              {tx("activarEnAjustes")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
