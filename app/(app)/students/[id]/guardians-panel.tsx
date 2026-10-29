"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCheck,
  Copy,
  Loader2,
  RefreshCw,
  Share2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  GUARDIAN_RELATIONSHIP_LABELS,
  type GuardianRelationship,
} from "@/lib/guardian-labels";

export interface GuardianItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: GuardianRelationship | null;
  status: "active" | "pending" | "expired" | "revoked";
  inviteToken: string | null;
  accountName: string | null;
}

const STATUS: Record<GuardianItem["status"], { label: string; cls: string }> = {
  active: {
    label: "Activo",
    cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
  pending: {
    label: "Invitación pendiente",
    cls: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  },
  expired: {
    label: "Invitación caducada",
    cls: "bg-foreground/8 text-foreground/60",
  },
  revoked: { label: "Baja", cls: "bg-foreground/8 text-foreground/50" },
};

const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 dark:bg-input/35";

export function GuardiansPanel({
  studentId,
  studentName,
  clubName,
  adult,
  initialGuardians,
}: {
  studentId: string;
  studentName: string;
  clubName: string;
  adult: boolean;
  initialGuardians: GuardianItem[];
}) {
  const [guardians, setGuardians] = useState(initialGuardians);
  const [showForm, setShowForm] = useState(initialGuardians.length === 0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<GuardianRelationship>(
    adult ? "alumno" : "madre"
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const relationshipOptions = (
    Object.keys(GUARDIAN_RELATIONSHIP_LABELS) as GuardianRelationship[]
  ).filter((r) => r !== "alumno" || adult);

  async function call(url: string, init: RequestInit, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof body?.error === "string" ? body.error : "No se pudo guardar."
        );
        return false;
      }
      setGuardians(body.data);
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe el nombre del contacto.");
      return;
    }
    const ok = await call(
      `/api/students/${studentId}/guardians`,
      {
        method: "POST",
        body: JSON.stringify({ name, email, phone, relationship }),
      },
      "add"
    );
    if (ok) {
      setName("");
      setEmail("");
      setPhone("");
      setShowForm(false);
    }
  }

  function action(id: string, act: "regenerate" | "revoke") {
    if (
      act === "revoke" &&
      !window.confirm(
        "¿Dar de baja este contacto? Dejará de recibir los mensajes del club."
      )
    ) {
      return;
    }
    void call(
      `/api/students/${studentId}/guardians/${id}`,
      { method: "PATCH", body: JSON.stringify({ action: act }) },
      `${act}:${id}`
    );
  }

  function inviteUrl(token: string) {
    return `${window.location.origin}/familia/${token}`;
  }

  async function share(g: GuardianItem) {
    if (!g.inviteToken) return;
    const url = inviteUrl(g.inviteToken);
    const text = `Hola, ${g.name}. ${clubName} te invita a recibir sus mensajes sobre ${studentName} en Ten Planner. Activa tu acceso aquí:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mensajes del club", text, url });
        return;
      } catch {
        // cancelado: se copia el enlace
      }
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    setCopiedId(g.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function copy(g: GuardianItem) {
    if (!g.inviteToken) return;
    await navigator.clipboard.writeText(inviteUrl(g.inviteToken));
    setCopiedId(g.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const visible = guardians.filter((g) => g.status !== "revoked");
  const revokedCount = guardians.length - visible.length;

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-foreground/60">
        {adult
          ? `Quién recibe los mensajes de ${clubName} sobre ${studentName}: el propio alumno (es mayor de edad) o las personas que indique.`
          : `${studentName} es menor de edad (o no consta su fecha de nacimiento): los mensajes de ${clubName} se envían a su madre, padre o tutor legal.`}
      </p>

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((g) => (
            <li
              key={g.id}
              className="rounded-2xl border border-[#050505]/10 p-3 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-foreground">{g.name}</p>
                {g.relationship && (
                  <span className="text-[11px] font-semibold text-foreground/55">
                    {g.relationship === "alumno"
                      ? "Alumno"
                      : GUARDIAN_RELATIONSHIP_LABELS[g.relationship]}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                    STATUS[g.status].cls
                  )}
                >
                  {STATUS[g.status].label}
                </span>
              </div>
              {(g.email || g.phone) && (
                <p className="mt-1 text-xs text-foreground/55">
                  {[g.email, g.phone].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {g.status === "pending" && (
                  <>
                    <Button type="button" size="sm" onClick={() => share(g)}>
                      <Share2 className="size-3.5" />
                      Enviar invitación
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copy(g)}
                    >
                      {copiedId === g.id ? (
                        <CheckCheck className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copiedId === g.id ? "Copiado" : "Copiar enlace"}
                    </Button>
                  </>
                )}
                {(g.status === "pending" || g.status === "expired") && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === `regenerate:${g.id}`}
                    onClick={() => action(g.id, "regenerate")}
                  >
                    {busy === `regenerate:${g.id}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    {g.status === "expired" ? "Nuevo enlace" : "Renovar enlace"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy === `revoke:${g.id}`}
                  onClick={() => action(g.id, "revoke")}
                >
                  <UserMinus className="size-3.5" />
                  Dar de baja
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {revokedCount > 0 && (
        <p className="text-[11px] text-foreground/45">
          {revokedCount === 1
            ? "1 contacto dado de baja."
            : `${revokedCount} contactos dados de baja.`}
        </p>
      )}

      {showForm ? (
        <form
          onSubmit={onAdd}
          className="space-y-3 rounded-2xl border border-dashed border-[#050505]/15 p-3 dark:border-white/15"
        >
          <div className="space-y-1.5">
            <Label htmlFor="g-rel">Relación</Label>
            <select
              id="g-rel"
              className={selectClass}
              value={relationship}
              onChange={(e) =>
                setRelationship(e.target.value as GuardianRelationship)
              }
            >
              {relationshipOptions.map((r) => (
                <option key={r} value={r}>
                  {GUARDIAN_RELATIONSHIP_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Nombre</Label>
            <Input
              id="g-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-email">Email</Label>
              <Input
                id="g-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-phone">Teléfono</Label>
              <Input
                id="g-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] leading-5 text-foreground/50">
            Si indicas el email, solo una cuenta con ese email podrá activar la
            invitación.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy === "add"}>
              {busy === "add" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserPlus className="size-3.5" />
              )}
              Añadir contacto
            </Button>
            {guardians.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setShowForm(true);
            setError(null);
          }}
        >
          <UserPlus className="size-3.5" />
          Añadir contacto
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
