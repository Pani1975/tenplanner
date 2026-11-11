"use client";

import { useSyncExternalStore } from "react";
import { greetingForHour } from "@/lib/time-greeting";

export function TimeGreeting({
  name,
  initialGreeting,
}: {
  name: string;
  initialGreeting: string;
}) {
  const greeting = useSyncExternalStore(
    (notify) => {
      const interval = window.setInterval(notify, 60_000);
      window.addEventListener("focus", notify);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener("focus", notify);
      };
    },
    () => greetingForHour(new Date().getHours()),
    () => initialGreeting
  );

  return (
    <h1 className="font-heading text-3xl font-semibold text-white sm:text-4xl">
      {greeting}, <span className="text-brand">{name}</span>
    </h1>
  );
}
