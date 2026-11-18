"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Bot, UserPlus, Dumbbell, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerm } from "@/lib/i18n-terms";

type IconName = "plus" | "bot" | "user-plus" | "dumbbell" | "calendar-plus";

const ICONS: Record<
  IconName,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  plus: Plus,
  bot: Bot,
  "user-plus": UserPlus,
  dumbbell: Dumbbell,
  "calendar-plus": CalendarPlus,
};

function IconFor({
  name,
  className,
  strokeWidth,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const C = ICONS[name] ?? Plus;
  return <C className={className} strokeWidth={strokeWidth} />;
}

export type FabAction = {
  href: string;
  label: string;
  icon: IconName;
};

export function MobileFab({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: IconName;
}) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
      className="md:hidden fixed z-30 bottom-[max(1rem,env(safe-area-inset-bottom))] right-4"
    >
      <Link
        href={href}
        aria-label={label}
        className="group inline-flex items-center gap-2 border border-brand bg-brand text-brand-foreground pl-3 pr-4 py-3 shadow-lg shadow-brand/20 hover:bg-brand/90 active:scale-95 transition-all uppercase text-[11px] font-semibold tracking-[0.18em]"
      >
        <IconFor name={icon} className="size-4" strokeWidth={2} />
        {label}
      </Link>
    </motion.div>
  );
}

export function MobileFabSpeedDial({
  actions,
  primaryLabel = "Crear",
}: {
  actions: FabAction[];
  primaryLabel?: string;
}) {
  const term = useTerm();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden fixed z-30 bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open &&
          actions.map((action, i) => (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={action.href}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 border border-foreground/20 bg-background text-foreground pl-3 pr-4 py-2.5 shadow-lg shadow-foreground/10 hover:border-brand/40 transition-all uppercase text-[11px] font-semibold tracking-[0.18em]"
              >
                <IconFor
                  name={action.icon}
                  className="size-4 text-brand"
                  strokeWidth={1.8}
                />
                {term(action.label)}
              </Link>
            </motion.div>
          ))}
      </AnimatePresence>
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Cerrar acciones" : primaryLabel}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.15,
        }}
        className={cn(
          "size-14 border border-brand flex items-center justify-center shadow-lg shadow-brand/25 active:scale-95 transition-all",
          open
            ? "bg-background text-foreground"
            : "bg-brand text-brand-foreground"
        )}
      >
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex"
        >
          {open ? (
            <X className="size-5" strokeWidth={1.8} />
          ) : (
            <Plus className="size-5" strokeWidth={2} />
          )}
        </motion.span>
      </motion.button>
    </div>
  );
}
