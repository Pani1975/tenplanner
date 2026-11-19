"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { useApiError } from "../use-api-error";

type Person = {
  firstName: string;
  lastName: string;
  isMinor: boolean;
  email: string;
  phone: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
};

const empty: Person = {
  firstName: "",
  lastName: "",
  isMinor: false,
  email: "",
  phone: "",
  guardianName: "",
  guardianEmail: "",
  guardianPhone: "",
};

const personValid = (p: Person) =>
  p.firstName.trim() !== "" &&
  p.lastName.trim() !== "" &&
  (p.isMinor
    ? p.guardianName.trim() !== "" &&
      (p.guardianEmail.trim() !== "" || p.guardianPhone.trim() !== "")
    : p.email.trim() !== "" || p.phone.trim() !== "");

const toBody = (p: Person) => ({
  firstName: p.firstName.trim(),
  lastName: p.lastName.trim(),
  isMinor: p.isMinor,
  email: !p.isMinor && p.email.trim() ? p.email.trim() : null,
  phone: !p.isMinor && p.phone.trim() ? p.phone.trim() : null,
  guardianName: p.isMinor ? p.guardianName.trim() : null,
  guardianEmail:
    p.isMinor && p.guardianEmail.trim() ? p.guardianEmail.trim() : null,
  guardianPhone:
    p.isMinor && p.guardianPhone.trim() ? p.guardianPhone.trim() : null,
});

/** Jugador que no es alumno de la escuela, añadido por el organizador. */
export function ExternalEntryForm({
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
  const t = useTranslations("tournaments.external");
  const apiError = useApiError();
  const [player, setPlayer] = useState<Person>(empty);
  const [partner, setPartner] = useState<Person>(empty);
  const [levelCode, setLevelCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [imageConsent, setImageConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const valid = personValid(player) && (!doubles || personValid(partner));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "manual",
        player: toBody(player),
        partner: doubles ? toBody(partner) : null,
        levelCode: levelCode || null,
        consentDeclared: consent,
        imageConsent,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    const { data } = await res.json();
    toast.success(t(`added.${data.entry.status}`));
    onDone();
  }

  return (
    <form onSubmit={submit} className="tp-card space-y-5 p-4 sm:p-5">
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

      <PersonFields
        legend={doubles ? t("player") : undefined}
        value={player}
        onChange={setPlayer}
      />
      {doubles && (
        <PersonFields
          legend={t("partner")}
          value={partner}
          onChange={setPartner}
        />
      )}

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase text-foreground/60">
          {t("level")}{" "}
          <span className="font-normal normal-case text-foreground/45">
            {t("optional")}
          </span>
        </span>
        <select
          value={levelCode}
          onChange={(e) => setLevelCode(e.target.value)}
          className="tp-field h-11 w-full px-3 text-base"
        >
          <option value="">{t("noLevel")}</option>
          {levels.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[#1a6db5]"
        />
        <span>{t("consent")}</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={imageConsent}
          onChange={(e) => setImageConsent(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[#1a6db5]"
        />
        <span>{t("imageConsent")}</span>
      </label>
      <p className="text-xs text-foreground/65">{t("privacy")}</p>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-full px-5 text-sm font-semibold"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={!valid || saving}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1a6db5] px-6 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("submit")}
        </button>
      </div>
    </form>
  );
}

function PersonFields({
  legend,
  value: p,
  onChange,
}: {
  legend?: string;
  value: Person;
  onChange: (p: Person) => void;
}) {
  const t = useTranslations("tournaments.external");
  const set = <K extends keyof Person>(k: K, v: Person[K]) =>
    onChange({ ...p, [k]: v });
  const input = (
    k: Exclude<keyof Person, "isMinor">,
    label: string,
    type = "text",
    autoComplete = "off"
  ) => (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase text-foreground/60">
        {label}
      </span>
      <input
        type={type}
        value={p[k]}
        onChange={(e) => set(k, e.target.value)}
        autoComplete={autoComplete}
        inputMode={
          type === "tel" ? "tel" : type === "email" ? "email" : undefined
        }
        className="tp-field h-11 w-full px-4 text-base"
      />
    </label>
  );
  return (
    <fieldset className="space-y-3">
      {legend && (
        <legend className="mb-2 text-sm font-bold text-[var(--brand-ink)]">
          {legend}
        </legend>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {input("firstName", t("firstName"))}
        {input("lastName", t("lastName"))}
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={p.isMinor}
          onChange={(e) => set("isMinor", e.target.checked)}
          className="size-5 accent-[#1a6db5]"
        />
        {t("isMinor")}
      </label>
      {p.isMinor ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {input("guardianName", t("guardianName"))}
          {input("guardianEmail", t("email"), "email")}
          {input("guardianPhone", t("phone"), "tel")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {input("email", t("email"), "email")}
          {input("phone", t("phone"), "tel")}
        </div>
      )}
      <p className="text-xs text-foreground/60">
        {p.isMinor ? t("guardianHint") : t("contactHint")}
      </p>
    </fieldset>
  );
}
