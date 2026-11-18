"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { greetingKeyForHour } from "@/lib/time-greeting";

export function TimeGreeting({
  name,
  initialGreeting,
}: {
  name: string;
  initialGreeting: string;
}) {
  const t = useTranslations("dashboard.greeting");
  const greeting = useSyncExternalStore(
    (notify) => {
      const interval = window.setInterval(notify, 60_000);
      window.addEventListener("focus", notify);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener("focus", notify);
      };
    },
    () => t(greetingKeyForHour(new Date().getHours())),
    () => initialGreeting
  );

  return (
    <h1 className="font-heading text-3xl font-semibold text-white sm:text-4xl">
      {greeting}, <span className="text-brand">{name}</span>
    </h1>
  );
}
