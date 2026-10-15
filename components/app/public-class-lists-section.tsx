"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { nivelLabel } from "@/lib/exercise-taxonomy";

interface PublicList {
  id: string;
  name: string;
  emoji: string | null;
  items: Array<{
    id: string;
    name: string;
    duracionMinutes: number;
    nivel: string | null;
  }>;
}

/**
 * Listas públicas de la Biblioteca (p. ej. "Lista clases bola roja"). Con
 * sesión iniciada, cada una se puede copiar a "Mis listas" del espacio en
 * el que se trabaja (particular o club).
 */
export function PublicClassListsSection({
  sport,
  loggedIn,
}: {
  sport: string;
  loggedIn: boolean;
}) {
  const [lists, setLists] = useState<PublicList[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/class-lists/public?sport=${encodeURIComponent(sport)}`, {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((json: { data?: PublicList[] }) => {
        if (!cancelled) setLists(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sport]);

  async function copyList(list: PublicList) {
    setCopyingId(list.id);
    try {
      const res = await fetch(`/api/class-lists/${list.id}/copy`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("No se pudo copiar la lista. Inténtalo de nuevo.");
        return;
      }
      toast.success(`"${list.name}" copiada a Mis listas`, {
        action: {
          label: "Ver",
          onClick: () => {
            window.location.href = "/classes?tab=favorites";
          },
        },
      });
    } finally {
      setCopyingId(null);
    }
  }

  if (lists.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.24em] text-foreground/45">
        <ListChecks className="size-3.5" /> Listas de la biblioteca
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {lists.map((list) => {
          const open = openId === list.id;
          return (
            <article
              key={list.id}
              className="overflow-hidden rounded-lg border border-[#050505]/10 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : list.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="text-lg">
                    {list.emoji && list.emoji.length <= 2 ? list.emoji : "🎓"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading text-[15px] text-foreground">
                      {list.name}
                    </span>
                    <span className="text-[11px] tabular-nums text-foreground/50">
                      {list.items.length} clase
                      {list.items.length !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-foreground/40 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </button>
                {loggedIn && (
                  <button
                    type="button"
                    onClick={() => void copyList(list)}
                    disabled={copyingId !== null}
                    title="Copiar a Mis listas"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#D6FF38] px-3 py-1.5 text-[12px] font-semibold text-[#050505] transition hover:bg-[#c8f52e] disabled:opacity-60"
                  >
                    {copyingId === list.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    Copiar
                  </button>
                )}
              </div>
              {open && (
                <ul className="divide-y divide-foreground/8 border-t border-foreground/8">
                  {list.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/classes/${item.id}`}
                        className="flex items-center gap-2 px-4 py-2 text-[13px] text-foreground transition-colors hover:bg-foreground/[0.03] hover:text-brand"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {item.name}
                        </span>
                        {item.nivel && (
                          <span className="shrink-0 text-[10px] text-foreground/45">
                            {nivelLabel(item.nivel)}
                          </span>
                        )}
                        <span className="shrink-0 text-[10px] tabular-nums text-foreground/45">
                          {item.duracionMinutes}′
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
