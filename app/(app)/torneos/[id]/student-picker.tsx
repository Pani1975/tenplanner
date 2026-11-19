"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiError } from "../use-api-error";

type Candidate = {
  id: string;
  name: string;
  levelCode: string | null;
  isMinor: boolean;
  groupIds: string[];
  entryStatus: string | null;
};
type Group = { id: string; name: string; studentIds: string[] };
type Picked = { studentId: string; groupId: string | null };

/**
 * Una sola pantalla para añadir alumnos de la escuela: sueltos, un grupo
 * entero o algunos de un grupo (filtrando por él). En dobles, las parejas
 * se forman en el orden de selección (1.º con 2.º, 3.º con 4.º…).
 */
export function StudentPicker({
  tournamentId,
  doubles,
  levels,
  onDone,
  onCancel,
}: {
  tournamentId: string;
  doubles: boolean;
  levels: { code: string; label: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("tournaments.picker");
  const apiError = useApiError();
  const [data, setData] = useState<{
    students: Candidate[];
    groups: Group[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/tournaments/${tournamentId}/candidates`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await apiError(res));
        return res.json();
      })
      .then((body) => alive && setData(body.data))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const byId = useMemo(
    () => new Map((data?.students ?? []).map((s) => [s.id, s])),
    [data]
  );
  const levelLabel = (code: string | null) =>
    code ? (levels.find((l) => l.code === code)?.label ?? null) : null;

  const visible = useMemo(() => {
    const q = query
      .trim()
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return (data?.students ?? []).filter((s) => {
      if (groupId && !s.groupIds.includes(groupId)) return false;
      if (!q) return true;
      return s.name
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .includes(q);
    });
  }, [data, query, groupId]);

  const isPicked = (id: string) => picked.some((p) => p.studentId === id);
  const available = (s: Candidate) => s.entryStatus === null;

  function toggle(s: Candidate) {
    if (!available(s)) return;
    setPicked((prev) =>
      prev.some((p) => p.studentId === s.id)
        ? prev.filter((p) => p.studentId !== s.id)
        : [...prev, { studentId: s.id, groupId }]
    );
  }

  function pickGroup(g: Group) {
    setPicked((prev) => {
      const have = new Set(prev.map((p) => p.studentId));
      const add = g.studentIds
        .filter((id) => !have.has(id))
        .filter((id) => {
          const s = byId.get(id);
          return s && available(s);
        })
        .map((id) => ({ studentId: id, groupId: g.id }));
      return [...prev, ...add];
    });
  }

  const currentGroup = data?.groups.find((g) => g.id === groupId) ?? null;
  const groupFree = currentGroup
    ? currentGroup.studentIds.filter((id) => {
        const s = byId.get(id);
        return s && available(s) && !isPicked(id);
      }).length
    : 0;

  // Dobles: parejas en orden de selección.
  const pairs: [Picked, Picked | null][] = [];
  if (doubles) {
    for (let i = 0; i < picked.length; i += 2) {
      pairs.push([picked[i], picked[i + 1] ?? null]);
    }
  }
  const oddDoubles = doubles && picked.length % 2 === 1;
  const canSubmit = picked.length > 0 && !oddDoubles && !saving;

  async function submit() {
    setSaving(true);
    const items = doubles
      ? pairs.map(([a, b]) => ({
          studentId: a.studentId,
          groupId: a.groupId,
          partnerStudentId: b!.studentId,
        }))
      : picked.map((p) => ({ studentId: p.studentId, groupId: p.groupId }));
    const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "school", items, consentDeclared: consent }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    const { data: r } = (await res.json()) as {
      data: {
        added: { status: string }[];
        skipped: unknown[];
      };
    };
    const waiting = r.added.filter((a) => a.status === "waitlist").length;
    toast.success(
      t("result", {
        added: r.added.length - waiting,
        waiting,
        skipped: r.skipped.length,
      })
    );
    onDone();
  }

  const nameOf = (id: string) => byId.get(id)?.name ?? "";

  return (
    <div className="tp-card overflow-hidden">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="tp-title text-xl">{t("title")}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-foreground/5"
            aria-label={t("close")}
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm text-foreground/70">
          {doubles ? t("helpDoubles") : t("help")}
        </p>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="tp-field h-11 w-full pl-9 pr-3 text-base"
          />
        </label>

        {data && data.groups.length > 0 && (
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label={t("groups")}
          >
            <Chip
              selected={groupId === null}
              onClick={() => setGroupId(null)}
              label={t("allStudents")}
            />
            {data.groups.map((g) => (
              <Chip
                key={g.id}
                selected={groupId === g.id}
                onClick={() => setGroupId(g.id)}
                label={`${g.name} (${g.studentIds.length})`}
              />
            ))}
          </div>
        )}

        {currentGroup && (
          <button
            type="button"
            onClick={() => pickGroup(currentGroup)}
            disabled={groupFree === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--brand-muted)] px-4 text-sm font-bold disabled:opacity-50"
          >
            <Check className="size-4" />
            {t("pickGroup", { name: currentGroup.name, count: groupFree })}
          </button>
        )}
      </div>

      <div className="max-h-[50vh] overflow-y-auto border-y border-foreground/10">
        {loadError ? (
          <p className="p-4 text-sm text-red-600">{loadError}</p>
        ) : !data ? (
          <p className="flex items-center gap-2 p-4 text-sm text-foreground/60">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-foreground/60">{t("none")}</p>
        ) : (
          <ul>
            {visible.map((s) => {
              const on = isPicked(s.id);
              const disabled = !available(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-label={s.name}
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => toggle(s)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left",
                      on ? "bg-[var(--brand-muted)]" : "hover:bg-foreground/5",
                      disabled && "opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                        on
                          ? "border-[var(--brand-ink)] bg-[#d6f04a] text-black"
                          : "border-foreground/30"
                      )}
                    >
                      {on && <Check className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {s.name}
                      </span>
                      <span className="block truncate text-xs text-foreground/60">
                        {[
                          levelLabel(s.levelCode),
                          s.isMinor ? t("minor") : null,
                          disabled ? t("alreadyIn") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 bg-[var(--brand-muted)] p-4 sm:p-5">
        {picked.length > 0 && (
          <div className="space-y-1 text-sm">
            <p className="font-bold">
              {t("selected", { count: picked.length })}
            </p>
            {doubles ? (
              <ol className="space-y-0.5">
                {pairs.map(([a, b], i) => (
                  <li key={a.studentId}>
                    {i + 1}. {nameOf(a.studentId)} /{" "}
                    {b ? (
                      nameOf(b.studentId)
                    ) : (
                      <span className="font-semibold text-red-600">
                        {t("missingPartner")}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-foreground/75">
                {picked.map((p) => nameOf(p.studentId)).join(", ")}
              </p>
            )}
          </div>
        )}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--brand-ink)]"
          />
          <span>{t("consent")}</span>
        </label>
        {!consent && picked.length > 0 && (
          <p className="text-xs text-foreground/70">{t("noConsentNote")}</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-full px-5 text-sm font-semibold"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-6 text-sm font-bold text-black disabled:opacity-40"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {doubles
              ? t("submitPairs", { count: pairs.length })
              : t("submit", { count: picked.length })}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold",
        selected
          ? "bg-[#d6f04a] text-black"
          : "bg-foreground/5 text-foreground hover:bg-foreground/10"
      )}
    >
      {label}
    </button>
  );
}
