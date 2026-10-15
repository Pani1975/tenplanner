import Link from "next/link";
import { ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackToSearchLinkProps {
  /** Route back to the filtered search the coach configured, or null/empty when there isn't one active. */
  href: string | null;
  className?: string;
}

/**
 * Secondary "back" link shown on a detail page (exercise/class/session)
 * reached from a filtered list, alongside the regular "back to all" link.
 * Renders nothing when there's no active filter to go back to.
 */
export function BackToSearchLink({ href, className }: BackToSearchLinkProps) {
  if (!href) return null;
  return (
    <Link
      href={href}
      title="Volver a la búsqueda"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#050505]/12 bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]",
        className
      )}
    >
      <ListFilter className="size-3.5" />
      <span>Volver a la búsqueda</span>
    </Link>
  );
}
