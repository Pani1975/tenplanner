"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";

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

const valid = (p: Person) =>
  p.firstName.trim() !== "" &&
  p.lastName.trim() !== "" &&
  (p.isMinor
    ? p.guardianName.trim() !== "" &&
      (p.guardianEmail.trim() !== "" || p.guardianPhone.trim() !== "")
    : p.email.trim() !== "" || p.phone.trim() !== "");

const body = (p: Person) => ({
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

/** Formulario de inscripción pública (sin cuenta). */
export function RegistrationForm({
  slug,
  doubles,
  full,
  organizer,
  levels,
}: {
  slug: string;
  doubles: boolean;
  full: boolean;
  organizer: string | null;
  levels: { code: string; label: string }[];
}) {
  const t = useTranslations("tournaments.public");
  const te = useTranslations("tournaments.errors");
  const router = useRouter();
  const [player, setPlayer] = useState<Person>(empty);
  const [partner, setPartner] = useState<Person>(empty);
  const [levelCode, setLevelCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // trampa para robots
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    status: string;
    waitlistPosition: number | null;
    emailSent: boolean;
  } | null>(null);

  const ok = valid(player) && (!doubles || valid(partner)) && consent;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/public/torneos/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player: body(player),
        partner: doubles ? body(partner) : null,
        levelCode: levelCode || null,
        consent: true,
        website,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const code = res.status === 429 ? "tooMany" : null;
      let err = "generic";
      try {
        err = ((await res.json()) as { error?: string }).error ?? "generic";
      } catch {}
      setError(code ? t("tooMany") : te.has(err) ? te(err) : te("generic"));
      return;
    }
    const { data } = await res.json();
    setDone(data);
    router.refresh();
  }

  if (done) {
    return (
      <section className="tp-card-soft space-y-2 p-5" role="status">
        <p className="tp-title flex items-center gap-2 text-xl">
          <CheckCircle2 className="size-6 text-[#1a6db5]" />
          {done.status === "waitlist" ? t("doneWaitlist") : t("doneTitle")}
        </p>
        <p className="text-sm">
          {done.status === "waitlist"
            ? t("doneWaitlistText", { n: done.waitlistPosition ?? 0 })
            : t("doneText")}
        </p>
        <p className="text-sm text-foreground/70">
          {done.emailSent ? t("emailSent") : t("emailNotSent")}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="tp-card space-y-5 p-5" noValidate>
      <div>
        <h2 className="tp-title text-2xl">{t("formTitle")}</h2>
        {full && (
          <p className="mt-1 text-sm font-semibold text-[#1a6db5]">
            {t("fullNote")}
          </p>
        )}
      </div>

      <Fields
        legend={doubles ? t("player") : undefined}
        value={player}
        onChange={setPlayer}
      />
      {doubles && (
        <Fields legend={t("partner")} value={partner} onChange={setPartner} />
      )}

      {levels.length > 0 && (
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase text-foreground/60">
            {t("level")}
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
      )}

      {/* Trampa para robots: oculta a las personas. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Web
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
          className="mt-0.5 size-5 shrink-0 accent-[#1a6db5]"
        />
        <span>
          {t("consent", { organizer: organizer ?? t("theOrganizer") })}{" "}
          <Link
            href="/privacidad"
            target="_blank"
            className="font-semibold underline"
          >
            {t("privacyLink")}
          </Link>
        </span>
      </label>
      <p className="text-xs text-foreground/65">{t("publicNote")}</p>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ok || saving}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1a6db5] px-6 text-base font-bold text-white disabled:opacity-40"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        {full ? t("submitWaitlist") : t("submit")}
      </button>
    </form>
  );
}

function Fields({
  legend,
  value: p,
  onChange,
}: {
  legend?: string;
  value: Person;
  onChange: (p: Person) => void;
}) {
  const t = useTranslations("tournaments.public");
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
        className="tp-field h-11 w-full px-4 text-base"
      />
    </label>
  );
  return (
    <fieldset className="space-y-3">
      {legend && (
        <legend className="mb-2 text-sm font-bold text-[#1a6db5]">
          {legend}
        </legend>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {input("firstName", t("firstName"), "text", "given-name")}
        {input("lastName", t("lastName"), "text", "family-name")}
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
          {input("guardianEmail", t("email"), "email", "email")}
          {input("guardianPhone", t("phone"), "tel", "tel")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {input("email", t("email"), "email", "email")}
          {input("phone", t("phone"), "tel", "tel")}
        </div>
      )}
      <p className="text-xs text-foreground/60">
        {p.isMinor ? t("guardianHint") : t("contactHint")}
      </p>
    </fieldset>
  );
}
