"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

interface ChatItem {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

function formatRelative(date: Date, loc: string = "es-ES"): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  return new Intl.DateTimeFormat(loc, {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function ChatListClient({ chats: initialChats }: { chats: ChatItem[] }) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_drplanner_chatlistclient");
  const router = useRouter();
  const [chats, setChats] = useState(initialChats);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleNewChat() {
    setCreating(true);
    try {
      const res = await fetch("/api/dr-planner/chats", { method: "POST" });
      const { data } = await res.json();
      router.push(`/sessions/dr-planner/${data.id}`);
    } catch {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`/api/dr-planner/chats/${id}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-8">
        {/* Masthead */}
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/sessions"
                className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-black uppercase text-white/70 transition-colors hover:text-white"
              >
                {tx("sesiones")}
              </Link>
              <span className="text-[11px] font-black uppercase text-white/25">
                /
              </span>
              <p className="rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
                {tx("drPlannerIa")}
              </p>
            </div>
            <p className="rounded-full border border-white/12 px-3 py-1 text-[11px] font-black tabular-nums text-white/45">
              № {String(chats.length).padStart(3, "0")}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-6">
            <h1 className="text-4xl font-black leading-tight text-white md:text-5xl">
              {tx("conversacionesConDrPlanner")}
            </h1>
            {chats.length > 0 && (
              <button
                onClick={handleNewChat}
                disabled={creating}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#D6FF38] px-4 text-[12px] font-black uppercase text-[#050505] transition-transform hover:-translate-y-0.5 disabled:opacity-50 sm:w-auto sm:shrink-0"
              >
                {creating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" strokeWidth={2} />
                )}
                {tx("nuevaConversacion")}
              </button>
            )}
          </div>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            {tx("asistenteDeDisenoDe")}
          </p>
        </header>

        {/* Body */}
        {chats.length === 0 ? (
          <div className="tp-panel border-dashed px-6 py-20 text-center">
            <p className="tp-kicker mb-4">{tx("archivoVacio")}</p>
            <h2 className="mb-3 text-3xl font-black text-foreground">
              {tx("aunNoHasHablado")}
            </h2>
            <p className="text-[13px] text-foreground/55 max-w-md mx-auto mb-6">
              {tx("iniciaUnaConversacionPara")}
            </p>
            <button
              onClick={handleNewChat}
              disabled={creating}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[12px] font-black uppercase text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" strokeWidth={2} />
              )}
              {tx("iniciarConversacion")}
            </button>
          </div>
        ) : (
          <section>
            <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 rounded-[24px] border border-[#050505]/10 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#10100e]">
              <p className="text-[10px] font-black tabular-nums text-brand">
                01
              </p>
              <p className="text-[10px] font-black uppercase text-foreground/50">
                {tx("historialOrdenadasPorUltima")}
              </p>
              <p className="text-[10px] font-black tabular-nums text-foreground/40">
                {chats.length}
              </p>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {chats.map((chat, idx) => (
                <li
                  key={chat.id}
                  className="group overflow-hidden rounded-[24px] border border-[#050505]/10 bg-white shadow-sm transition-colors hover:border-brand/40 dark:border-white/10 dark:bg-[#10100e]"
                >
                  <div className="relative">
                    <Link
                      href={`/sessions/dr-planner/${chat.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-5 px-4 py-4 transition-colors hover:bg-brand/[0.025]"
                    >
                      <span className="font-sans text-[10px] tabular-nums tracking-[0.18em] text-foreground/35 w-8">
                        {String(idx + 1).padStart(3, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-black text-foreground transition-colors group-hover:text-brand">
                          {chat.title}
                        </p>
                        <p className="text-[11px] text-foreground/45 mt-0.5 tabular-nums tracking-wide">
                          {formatRelative(chat.updatedAt, intlLocale)}
                        </p>
                      </div>
                      <span className="pr-10 text-[11px] font-black text-foreground/40 transition-colors group-hover:text-brand">
                        →
                      </span>
                    </Link>
                    <button
                      onClick={(e) => handleDelete(chat.id, e)}
                      disabled={deletingId === chat.id}
                      className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-foreground/35 transition-colors hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={tx("eliminar")}
                    >
                      {deletingId === chat.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" strokeWidth={1.6} />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="grid gap-3 pt-2 text-[11px] text-foreground/45 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-4">
          <p className="max-w-md text-[13px] font-semibold text-foreground/55">
            {tx("laMejorSesionEmpieza")}
          </p>
          <p className="font-black uppercase tabular-nums">{tx("tenplannerIa")}</p>
        </footer>
      </div>
    </div>
  );
}
