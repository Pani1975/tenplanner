"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Heart,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { FavoriteSessionList } from "@/lib/sessions/favorites";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

function formatDate(iso: string, loc: string = "es-ES") {
  return new Intl.DateTimeFormat(loc, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_LABEL = {
  scheduled: "Programada",
  completed: "Completada",
  cancelled: "Cancelada",
} as const;

export function FavoritesClient({
  initialLists,
}: {
  initialLists: FavoriteSessionList[];
}) {
  const term = useTerm();
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_favorites_favoritesclient");
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function call(url: string, init: RequestInit, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setError(tx("noSePudoCompletar"));
        return null;
      }
      return res;
    } catch {
      setError(tx("errorDeRedIntentalo"));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function createList() {
    const name = newName.trim();
    if (!name) return;
    const res = await call(
      "/api/session-lists",
      { method: "POST", body: JSON.stringify({ name }) },
      "new"
    );
    if (!res) return;
    const { data } = (await res.json()) as {
      data: { id: string; name: string; emoji: string | null };
    };
    setLists((prev) => [...prev, { ...data, isDefault: false, sessions: [] }]);
    setNewName("");
    setShowNew(false);
  }

  async function renameList() {
    if (!renaming || !renaming.name.trim()) return;
    const name = renaming.name.trim();
    const res = await call(
      `/api/session-lists/${renaming.id}`,
      { method: "PATCH", body: JSON.stringify({ name }) },
      renaming.id
    );
    if (!res) return;
    setLists((prev) =>
      prev.map((l) => (l.id === renaming.id ? { ...l, name } : l))
    );
    setRenaming(null);
  }

  async function deleteList(id: string) {
    const res = await call(
      `/api/session-lists/${id}`,
      { method: "DELETE" },
      id
    );
    if (!res) return;
    setLists((prev) => prev.filter((l) => l.id !== id));
    setConfirmDelete(null);
    router.refresh();
  }

  async function removeSession(listId: string, sessionId: string) {
    const res = await call(
      `/api/session-lists/${listId}/items`,
      { method: "DELETE", body: JSON.stringify({ sessionId }) },
      `${listId}:${sessionId}`
    );
    if (!res) return;
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, sessions: l.sessions.filter((s) => s.id !== sessionId) }
          : l
      )
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {lists.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <Heart className="size-8 text-foreground/20" />
          <p className="text-sm font-semibold text-foreground">
            {tx("aunNoTienesSesiones")}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {tx("abreUnaSesionY")}
          </p>
          <Link
            href="/sessions"
            className="rounded-full bg-[#D6FF38] px-4 py-2 text-sm font-bold text-[#050505] hover:bg-[#c8ef2f]"
          >
            {tx("irAMisSesiones")}
          </Link>
        </div>
      )}

      {lists.map((list) => (
        <section
          key={list.id}
          className="overflow-hidden rounded-2xl border border-[#050505]/10 bg-white dark:border-white/10 dark:bg-white/[0.045]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            {renaming?.id === list.id ? (
              <form
                className="flex min-w-0 flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void renameList();
                }}
              >
                <input
                  value={renaming.name}
                  onChange={(e) =>
                    setRenaming({ id: list.id, name: e.target.value })
                  }
                  maxLength={100}
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-[#D6FF38] focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label={tx("guardarNombre")}
                  disabled={busy === list.id}
                  className="flex size-8 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505]"
                >
                  {busy === list.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={tx("cancelar")}
                  onClick={() => setRenaming(null)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="size-4" />
                </button>
              </form>
            ) : (
              <>
                <h2 className="flex min-w-0 items-center gap-2 text-base font-black text-foreground">
                  <span>{list.emoji ?? "⭐"}</span>
                  <span className="truncate">{list.name}</span>
                  <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                    {list.sessions.length}
                  </span>
                </h2>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={tx("cambiarNombre")}
                    onClick={() =>
                      setRenaming({ id: list.id, name: list.name })
                    }
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  {confirmDelete === list.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void deleteList(list.id)}
                        disabled={busy === list.id}
                        className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground"
                      >
                        {busy === list.id && (
                          <Loader2 className="size-3 animate-spin" />
                        )}
                        {tx("borrarLista")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                      >
                        {tx("no")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      aria-label={tx("borrarLista")}
                      onClick={() => setConfirmDelete(list.id)}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {confirmDelete === list.id && (
            <p className="border-b border-border bg-destructive/5 px-4 py-2 text-xs text-muted-foreground">
              {tx("seBorraSoloLa")}
            </p>
          )}

          {list.sessions.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tx("listaVaciaPulsaEl")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-2 pr-3">
                  <Link
                    href={`/sessions/${s.id}`}
                    className="min-w-0 flex-1 px-4 py-3 hover:bg-muted/50"
                  >
                    <p className="truncate text-sm font-semibold text-foreground">
                      {s.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs capitalize text-muted-foreground">
                      <span>{formatDate(s.scheduledAt, intlLocale)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {s.durationMinutes}{" "}{tx("min")}
                      </span>
                      <span>{term(STATUS_LABEL[s.status])}</span>
                    </p>
                  </Link>
                  <button
                    type="button"
                    aria-label={tx("quitarDeLaLista")}
                    title={tx("quitarDeLaLista")}
                    disabled={busy === `${list.id}:${s.id}`}
                    onClick={() => void removeSession(list.id, s.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                  >
                    {busy === `${list.id}:${s.id}` ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Heart className="size-4 fill-current" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {showNew ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void createList();
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tx("nombreDeLaLista")}
            maxLength={100}
            autoFocus
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm focus:border-[#D6FF38] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newName.trim() || busy === "new"}
            className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-5 py-2 text-sm font-bold text-[#050505] disabled:opacity-50"
          >
            {busy === "new" && <Loader2 className="size-4 animate-spin" />}
            {tx("crear")}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNew(false);
              setNewName("");
            }}
            className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            {tx("cancelar")}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:border-[#D6FF38] hover:text-foreground"
        >
          <Plus className="size-4" />
          {tx("nuevaLista")}
        </button>
      )}
    </div>
  );
}
