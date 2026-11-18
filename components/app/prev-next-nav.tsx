import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface PrevNextNavProps {
  prevHref: string | null;
  nextHref: string | null;
  /** 1-based position of the current item within the filtered list, if known. */
  position?: number | null;
  total?: number | null;
  className?: string;
}

/**
 * Next/Previous navigation between detail pages of a filtered list
 * (exercises, classes, sessions). Renders disabled arrows at either end.
 */
export function PrevNextNav({
  prevHref,
  nextHref,
  position,
  total,
  className,
}: PrevNextNavProps) {
  const tx = useTranslations("ui.s_app_prevnextnav");
  const btnBase =
    "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm transition-colors";
  const enabled =
    "border-[#050505]/12 bg-white text-muted-foreground hover:border-[#D6FF38] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]";
  const disabled =
    "border-transparent text-foreground/15 cursor-not-allowed dark:text-white/10";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {prevHref ? (
        <Link
          href={prevHref}
          title={tx("anterior")}
          aria-label={tx("elementoAnterior")}
          className={cn(btnBase, enabled)}
        >
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(btnBase, disabled)}>
          <ChevronLeft className="size-4" />
        </span>
      )}

      {!!position && !!total && (
        <span className="px-0.5 font-sans text-[10px] tabular-nums text-foreground/45 whitespace-nowrap">
          {position} / {total}
        </span>
      )}

      {nextHref ? (
        <Link
          href={nextHref}
          title={tx("siguiente")}
          aria-label={tx("siguienteElemento")}
          className={cn(btnBase, enabled)}
        >
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(btnBase, disabled)}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </div>
  );
}
