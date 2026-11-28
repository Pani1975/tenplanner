"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string; date?: string };
type Kind = "exercise" | "class" | "session";

const SECTIONS: { kind: Kind; title: string; empty: string }[] = [
  {
    kind: "exercise",
    title: "Ejercicios",
    empty: "No tienes ejercicios propios en tu entorno particular.",
  },
  {
    kind: "class",
    title: "Clases",
    empty: "No tienes clases en tu entorno particular.",
  },
  {
    kind: "session",
    title: "Sesiones",
    empty: "No tienes sesiones en tu entorno particular.",
  },
];

function request(kind: Kind, id: string, clubId: string) {
  if (kind === "session")
    return fetch(`/api/sessions/${id}/send-to-club`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId }),
    });
  const base = kind === "exercise" ? "/api/exercises" : "/api/classes";
  return fetch(`${base}/${id}/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target: "club", clubId }),
  });
}

export function TransferClient({
  clubs,
  exercises,
  classes,
  sessions,
}: {
  clubs: { id: string; name: string }[];
  exercises: Item[];
  classes: Item[];
  sessions: Item[];
}) {
  const router = useRouter();
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; failed: string[] } | null>(
    null
  );

  const lists: Record<Kind, Item[]> = useMemo(
    () => ({ exercise: exercises, class: classes, session: sessions }),
    [exercises, classes, sessions]
  );
  const key = (kind: Kind, id: string) => `${kind}:${id}`;
  const club = clubs.find((c) => c.id === clubId);

  function toggle(k: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleAll(kind: Kind) {
    const keys = lists[kind].map((i) => key(kind, i.id));
    const all = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (all) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  }

  async function transfer() {
    if (!club || selected.size === 0) return;
    setBusy(true);
    setResult(null);
    setProgress(0);
    let ok = 0;
    const failed: string[] = [];
    let done = 0;
    for (const section of SECTIONS) {
      for (const item of lists[section.kind]) {
        if (!selected.has(key(section.kind, item.id))) continue;
        try {
          const res = await request(section.kind, item.id, club.id);
          if (res.ok) ok++;
          else failed.push(item.label);
        } catch {
          failed.push(item.label);
        }
        done++;
        setProgress(done);
      }
    }
    setResult({ ok, failed });
    setSelected(new Set());
    setBusy(false);
    router.refresh();
  }

  const dateFmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6 pb-28">
      {clubs.length > 1 && (
        <div className="tp-panel p-5">
          <p className="text-xs font-black uppercase text-foreground/60">
            Club de destino
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {clubs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClubId(c.id)}
                aria-pressed={c.id === clubId}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-bold transition-colors",
                  c.id === clubId
                    ? "border-brand bg-brand/15 text-foreground"
                    : "border-foreground/15 text-foreground/70 hover:bg-foreground/5"
                )}
              >
                Entorno {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div
          role="status"
          className={cn(
            "tp-panel p-4 text-sm font-semibold",
            result.failed.length > 0 ? "border-destructive/50" : "border-brand/50"
          )}
        >
          {result.ok > 0 && (
            <p>
              Pasados a {club?.name}: {result.ok}.
            </p>
          )}
          {result.failed.length > 0 && (
            <p className="text-destructive">
              No se pudieron pasar: {result.failed.join(", ")}.
            </p>
          )}
        </div>
      )}

      {SECTIONS.map((section) => {
        const items = lists[section.kind];
        const count = items.filter((i) =>
          selected.has(key(section.kind, i.id))
        ).length;
        return (
          <section key={section.kind} className="tp-panel p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-foreground">
                {section.title}{" "}
                <span className="text-sm font-bold text-foreground/50">
                  ({items.length})
                </span>
              </h2>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggleAll(section.kind)}
                  disabled={busy}
                  className="text-xs font-bold text-foreground/70 underline-offset-2 hover:underline"
                >
                  {count === items.length ? "Quitar todos" : "Marcar todos"}
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-foreground/55">{section.empty}</p>
            ) : (
              <ul className="mt-3 max-h-80 divide-y divide-foreground/10 overflow-y-auto">
                {items.map((item) => {
                  const k = key(section.kind, item.id);
                  const on = selected.has(k);
                  return (
                    <li key={item.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={busy}
                          onChange={() => toggle(k)}
                          className="size-4 accent-[#D6FF38]"
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                          {item.label}
                        </span>
                        {item.date && (
                          <span className="shrink-0 text-xs text-foreground/50">
                            {dateFmt.format(new Date(item.date))}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/10 bg-background/95 p-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground/70">
            {busy
              ? `Pasando ${progress} de ${selected.size}…`
              : `${selected.size} seleccionados`}
          </p>
          <button
            type="button"
            onClick={transfer}
            disabled={busy || selected.size === 0 || !club}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : result && selected.size === 0 ? (
              <Check className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            Pasar a {club?.name ?? "club"}
          </button>
        </div>
      </div>
    </div>
  );
}
