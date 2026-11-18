"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useCallback, useRef } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";

export function SessionsSearchInput({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const tx = useTranslations("ui.s_app_sessionssearchinput");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (q) {
          params.set("q", q);
        } else {
          params.delete("q");
        }
        startTransition(() => {
          router.replace(`/sessions?${params.toString()}`);
        });
      }, 300);
    },
    [router, searchParams]
  );

  return (
    <div className="relative">
      <Search
        className={`pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 transition-colors ${
          isPending ? "text-brand/60 animate-pulse" : "text-foreground/40"
        }`}
        strokeWidth={1.6}
      />
      <input
        type="search"
        placeholder={tx("buscarPorTituloObjetivo")}
        defaultValue={defaultValue}
        onChange={handleChange}
        className="h-10 w-full rounded-md border border-foreground/20 bg-transparent pl-9 pr-4 text-[13px] text-foreground placeholder:text-foreground/40 transition-colors focus:border-brand/60 focus:outline-none"
      />
    </div>
  );
}
