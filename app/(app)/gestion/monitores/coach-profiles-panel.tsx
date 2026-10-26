"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CoachProfileForm,
  type CoachProfileInitial,
  type CoachProfileSubmitResult,
} from "@/components/app/coach-profile-form";
import type { CoachProfileView } from "@/lib/club-coach-profiles";
import {
  formatExperienceRange,
  summarizeAvailability,
  type CoachProfileData,
} from "@/lib/coach-profile";
import { cn } from "@/lib/utils";

type Member = { name: string; email: string };

type Creating =
  | null
  | { mode: "direct"; prefill?: CoachProfileInitial }
  | { mode: "link" };

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function sortByName(list: CoachProfileView[]) {
  return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
}

async function callApi(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, json } as {
    ok: boolean;
    json: {
      data?: CoachProfileView;
      emailSent?: boolean;
      error?: string;
      fieldErrors?: Record<string, string>;
    } | null;
  };
}

function failure(
  json: {
    error?: string;
    fieldErrors?: Record<string, string>;
  } | null
): CoachProfileSubmitResult {
  return {
    ok: false,
    error: json?.error ?? "No se pudo guardar. Inténtalo de nuevo.",
    fieldErrors: json?.fieldErrors,
  };
}

export function CoachProfilesPanel({
  clubName,
  initialProfiles,
  members,
}: {
  clubName: string;
  initialProfiles: CoachProfileView[];
  members: Member[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [creating, setCreating] = useState<Creating>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const profileEmails = new Set(profiles.map((p) => p.email));
  const accountEmails = new Set(members.map((m) => m.email.toLowerCase()));
  const membersWithoutProfile = members.filter(
    (m) => !profileEmails.has(m.email.toLowerCase())
  );

  function upsert(view: CoachProfileView) {
    setProfiles((prev) =>
      sortByName([...prev.filter((p) => p.id !== view.id), view])
    );
  }

  function describeLinkResult(
    view: CoachProfileView,
    emailSent: boolean | undefined
  ) {
    setNotice(
      emailSent
        ? `Enlace enviado a ${view.email}.`
        : `No hemos podido enviar el correo a ${view.email}. Copia el enlace de la ficha y envíaselo tú.`
    );
  }

  async function createDirect(
    data: CoachProfileData
  ): Promise<CoachProfileSubmitResult> {
    const { ok, json } = await callApi("/api/clubs/coach-profiles", "POST", {
      mode: "direct",
      profile: data,
    });
    if (!ok || !json?.data) return failure(json);
    upsert(json.data);
    setCreating(null);
    setOpenId(json.data.id);
    setNotice(`Ficha de ${json.data.fullName} guardada.`);
    return { ok: true };
  }

  async function requestLink(fullName: string, email: string) {
    setError(null);
    setNotice(null);
    const { ok, json } = await callApi("/api/clubs/coach-profiles", "POST", {
      mode: "link",
      fullName,
      email,
    });
    if (!ok || !json?.data) {
      setError(json?.error ?? "No se pudo crear la ficha.");
      return false;
    }
    upsert(json.data);
    setCreating(null);
    describeLinkResult(json.data, json.emailSent);
    return true;
  }

  async function saveEdit(
    id: string,
    data: CoachProfileData
  ): Promise<CoachProfileSubmitResult> {
    const { ok, json } = await callApi(
      `/api/clubs/coach-profiles/${id}`,
      "PATCH",
      { profile: data }
    );
    if (!ok || !json?.data) return failure(json);
    upsert(json.data);
    setEditingId(null);
    setNotice(`Ficha de ${json.data.fullName} guardada.`);
    return { ok: true };
  }

  async function resendLink(profile: CoachProfileView) {
    setBusyId(profile.id);
    setError(null);
    setNotice(null);
    try {
      const { ok, json } = await callApi(
        `/api/clubs/coach-profiles/${profile.id}/link`,
        "POST"
      );
      if (!ok || !json?.data) {
        setError(json?.error ?? "No se pudo enviar el enlace.");
        return;
      }
      upsert(json.data);
      describeLinkResult(json.data, json.emailSent);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(profile: CoachProfileView) {
    if (
      !window.confirm(
        `¿Eliminar la ficha de ${profile.fullName}? Se borrarán sus datos de la ficha. No desvincula al monitor del club.`
      )
    )
      return;
    setBusyId(profile.id);
    setError(null);
    setNotice(null);
    try {
      const { ok, json } = await callApi(
        `/api/clubs/coach-profiles/${profile.id}`,
        "DELETE"
      );
      if (!ok) {
        setError(json?.error ?? "No se pudo eliminar la ficha.");
        return;
      }
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(profile: CoachProfileView) {
    if (!profile.linkToken) return;
    const url = `${window.location.origin}/ficha-monitor/${profile.linkToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(profile.id);
      setTimeout(() => setCopiedId((c) => (c === profile.id ? null : c)), 2000);
    } catch {
      // Sin portapapeles: el gestor puede volver a pedir el envío por email.
    }
  }

  return (
    <section className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
            <FileText className="size-4" />
            Fichas de monitores
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-foreground/55">
            Datos de contacto, formación, disponibilidad y experiencia de cada
            monitor. Zona privada: solo la ves tú como gestor. Rellénala tú o
            envía un enlace para que la rellene el propio monitor.
          </p>
        </div>
        {creating === null && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCreating({ mode: "direct" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground"
            >
              <Plus className="size-4" />
              Rellenar una ficha
            </button>
            <button
              type="button"
              onClick={() => setCreating({ mode: "link" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-bold text-foreground hover:bg-muted"
            >
              <Mail className="size-4" />
              Pedir que la rellene el monitor
            </button>
          </div>
        )}
      </div>

      {notice && <p className="mt-3 text-xs text-foreground/70">{notice}</p>}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {creating?.mode === "direct" && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/5 p-4">
          <h3 className="mb-4 text-sm font-black text-foreground">
            Nueva ficha de monitor
          </h3>
          <CoachProfileForm
            key={creating.prefill?.email ?? "new"}
            initial={creating.prefill}
            submitLabel="Guardar ficha"
            onSubmit={createDirect}
            onCancel={() => setCreating(null)}
          />
        </div>
      )}

      {creating?.mode === "link" && (
        <RequestLinkForm
          clubName={clubName}
          onSubmit={requestLink}
          onCancel={() => setCreating(null)}
        />
      )}

      {profiles.length === 0 && creating === null && (
        <p className="mt-4 text-sm text-foreground/50">
          Todavía no hay fichas de monitores.
        </p>
      )}

      {profiles.length > 0 && (
        <ul className="mt-4 space-y-2">
          {profiles.map((profile) => {
            const open = openId === profile.id;
            const editing = editingId === profile.id;
            return (
              <li
                key={profile.id}
                className="rounded-2xl border border-[#050505]/10 dark:border-white/10"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : profile.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {profile.fullName}
                    </span>
                    <span className="block truncate text-xs text-foreground/55">
                      {profile.email}
                      {profile.phone ? ` · ${profile.phone}` : ""}
                    </span>
                  </span>
                  {accountEmails.has(profile.email) && (
                    <span className="hidden shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/60 sm:inline">
                      Con cuenta
                    </span>
                  )}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                      profile.status === "pending"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-brand/10 text-foreground/70"
                    )}
                  >
                    {profile.status === "pending" ? "Pendiente" : "Completa"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-foreground/40 transition-transform",
                      open && "rotate-180"
                    )}
                  />
                </button>

                {open && (
                  <div className="space-y-4 border-t border-[#050505]/10 px-4 py-4 dark:border-white/10">
                    {editing ? (
                      <CoachProfileForm
                        initial={profile}
                        submitLabel="Guardar cambios"
                        onSubmit={(data) => saveEdit(profile.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        {profile.status === "pending" ? (
                          <p className="text-sm text-foreground/60">
                            {profile.linkToken
                              ? `Esperando a que ${profile.fullName.split(" ")[0]} rellene su ficha. El enlace caduca el ${dateFormat.format(new Date(profile.linkExpiresAt!))}.`
                              : "El enlace ha caducado. Envía uno nuevo o rellena la ficha tú."}
                          </p>
                        ) : (
                          <ProfileSummary profile={profile} />
                        )}

                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            onClick={() => setEditingId(profile.id)}
                            icon={<Pencil className="size-3.5" />}
                          >
                            {profile.status === "pending"
                              ? "Rellenar yo"
                              : "Editar"}
                          </ActionButton>
                          <ActionButton
                            onClick={() => resendLink(profile)}
                            disabled={busyId === profile.id}
                            icon={
                              busyId === profile.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Mail className="size-3.5" />
                              )
                            }
                          >
                            {profile.status === "pending"
                              ? "Enviar enlace de nuevo"
                              : "Pedir que la actualice"}
                          </ActionButton>
                          {profile.linkToken && (
                            <ActionButton
                              onClick={() => copyLink(profile)}
                              icon={
                                copiedId === profile.id ? (
                                  <Check className="size-3.5 text-brand" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )
                              }
                            >
                              {copiedId === profile.id
                                ? "Copiado"
                                : "Copiar enlace"}
                            </ActionButton>
                          )}
                          <ActionButton
                            onClick={() => remove(profile)}
                            disabled={busyId === profile.id}
                            icon={<Trash2 className="size-3.5" />}
                            danger
                          >
                            Eliminar
                          </ActionButton>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {membersWithoutProfile.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-wide text-foreground/55">
            Monitores del club sin ficha
          </h3>
          <ul className="mt-2 space-y-2">
            {membersWithoutProfile.map((member) => (
              <li
                key={member.email}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-[#050505]/15 px-4 py-3 dark:border-white/15"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {member.name}
                  </span>
                  <span className="block truncate text-xs text-foreground/55">
                    {member.email}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <ActionButton
                    onClick={() =>
                      setCreating({
                        mode: "direct",
                        prefill: { fullName: member.name, email: member.email },
                      })
                    }
                    icon={<Pencil className="size-3.5" />}
                  >
                    Rellenar ficha
                  </ActionButton>
                  <ActionButton
                    onClick={() => requestLink(member.name, member.email)}
                    icon={<Mail className="size-3.5" />}
                  >
                    Pedir ficha
                  </ActionButton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ActionButton({
  children,
  icon,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors disabled:opacity-60",
        danger
          ? "border-border text-foreground/60 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          : "border-border text-foreground hover:bg-muted"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function RequestLinkForm({
  clubName,
  onSubmit,
  onCancel,
}: {
  clubName: string;
  onSubmit: (fullName: string, email: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!fullName.trim() || !email.trim()) return;
        setSending(true);
        try {
          await onSubmit(fullName.trim(), email.trim());
        } finally {
          setSending(false);
        }
      }}
      className="mt-4 space-y-4 rounded-2xl border border-brand/30 bg-brand/5 p-4"
    >
      <div>
        <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
          <Link2 className="size-4" />
          Pedir la ficha al monitor
        </h3>
        <p className="mt-1 text-xs leading-5 text-foreground/55">
          Le llegará un correo de {clubName} con un enlace personal, de un solo
          uso, para que rellene su ficha sin crear ninguna cuenta.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="link-name">Nombre</Label>
          <Input
            id="link-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="link-email">Email</Label>
          <Input
            id="link-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !fullName.trim() || !email.trim()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-brand-foreground disabled:opacity-60"
        >
          {sending && <Loader2 className="size-4 animate-spin" />}
          Enviar enlace
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="h-10 rounded-full border border-border px-4 text-sm font-bold text-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ProfileSummary({ profile }: { profile: CoachProfileView }) {
  const availability = summarizeAvailability(profile.availability);
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Teléfono", value: profile.phone ?? "—" },
    { label: "Email", value: profile.email },
    {
      label: "Formación académica",
      value: profile.academicTraining ?? "—",
    },
    { label: "Formación en tenis", value: profile.tennisTraining ?? "—" },
    {
      label: "Disponibilidad",
      value:
        availability.length > 0 ? (
          <ul className="space-y-0.5">
            {availability.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
    {
      label: "Empezó a dar clases",
      value: profile.startedTeachingYear ?? "—",
    },
    {
      label: "Experiencia como monitor",
      value:
        profile.experience.length > 0 ? (
          <ul className="space-y-1">
            {profile.experience.map((entry, i) => (
              <li key={i}>
                <span className="font-semibold">
                  {formatExperienceRange(entry.startYear, entry.endYear)}
                </span>
                {(entry.company || entry.role) && (
                  <span className="text-foreground/60">
                    {" · "}
                    {[entry.company, entry.role].filter(Boolean).join(" — ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <div className="space-y-3">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[11px] font-black uppercase tracking-wide text-foreground/45">
              {row.label}
            </dt>
            <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-foreground">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[11px] text-foreground/45">
        {profile.filledByCoach
          ? "Rellenada por el propio monitor"
          : "Rellenada por el club"}{" "}
        · actualizada el {dateFormat.format(new Date(profile.updatedAt))}
      </p>
    </div>
  );
}
