"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

/**
 * Número que sube desde 0 al entrar en pantalla. El HTML del servidor ya
 * lleva el valor final (para buscadores y sin JavaScript).
 */
export function CountUp({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, reduced, value]);

  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString(intlLocale)}
    </span>
  );
}
