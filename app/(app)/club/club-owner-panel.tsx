"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Mail, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SPORT_LABELS, SPORT_OPTIONS, type Sport } from "@/lib/sport-constants";

interface Member {
  id: string;
  role: string;
  status: string;
  sport: Sport;
  createdAt: string | Date;
  name: string;
  email: string;
  image: string | null;
}

interface Invite {
  id: string;
  email: string;
  inviteeName: string | null;
  sport: Sport;
  token: string;
  status: string;
  createdAt: string | Date;
  expiresAt: string | Date;
}

interface Club {
  id: string;
  name: string;
  plannedCoachSeats: number | null;
}

export function ClubOwnerPanel({
  club,
  initialMembers,
  initialInvites,
  defaultSport = "tenis",
}: {
  club: Club;
  initialMembers: Member[];
  initialInvites: Invite[];
  defaultSport?: Sport;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [editingMembers, setEditingMembers] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteeName, setInviteeName] = useState("");
  const [email, setEmail] = useState("");
  const [sport, setSport] = useState<Sport>(defaultSport);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const seatCount = club.plannedCoachSeats;

  async function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/clubs/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: inviteeName.trim() || undefined,
          sport,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "No se pudo crear la invitación."
        );
        return;
      }
      setInvites((prev) => [
        body.data,
        ...prev.filter((i) => i.id !== body.data.id),
      ]);
      setNotice(
        body.emailSent
          ? `Invitación enviada a ${body.data.email}.`
          : "No hemos podido enviar el correo. Copia el enlace de la lista y envíaselo tú."
      );
      setEmail("");
      setInviteeName("");
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/clubs/invites/${id}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  }

  async function removeMember(member: Member) {
    if (
      !window.confirm(
        `¿Desvincular a ${member.name} del club? Dejará de ver el contenido del club.`
      )
    )
      return;
    setRemovingId(member.id);
    try {
      const res = await fetch(`/api/clubs/members/${member.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("No se pudo desvincular al monitor.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  async function copyLink(invite: Invite) {
    const url = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((c) => (c === invite.id ? null : c)), 2000);
    } catch {
      // clipboard unavailable — ignore, the link is still visible on screen
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
          <Mail className="size-4" />
          Invitar monitor
        </h2>
        <form onSubmit={onInvite} className="mt-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-name" className="sr-only">
                Nombre del monitor
              </Label>
              <Input
                id="invite-name"
                placeholder="Nombre (opcional)"
                value={inviteeName}
                onChange={(e) => setInviteeName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email" className="sr-only">
                Email del monitor
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="monitor@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 shrink-0 rounded-full font-black"
            >
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Invitar
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SPORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSport(option.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                  sport === option.id
                    ? "border-brand bg-brand/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </form>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        {notice && <p className="mt-2 text-xs text-foreground/70">{notice}</p>}
        <p className="mt-2 text-xs text-foreground/50">
          Enviamos la invitación por email. Si prefieres, también puedes copiar
          el enlace de la lista y mandárselo tú.
        </p>
        {typeof seatCount === "number" && (
          <p className="mt-1 text-xs text-foreground/50">
            Monitores previstos: {seatCount} · vinculados: {members.length}
          </p>
        )}
      </div>

      {invites.length > 0 && (
        <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
          <h2 className="text-sm font-black uppercase tracking-wide text-foreground/70">
            Invitaciones pendientes
          </h2>
          <ul className="mt-3 space-y-2">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#050505]/10 px-4 py-3 dark:border-white/10"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {invite.inviteeName
                    ? `${invite.inviteeName} · ${invite.email}`
                    : invite.email}
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/70">
                    {SPORT_LABELS[invite.sport]}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyLink(invite)}
                    className="flex size-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-[#F4F4F1] hover:text-foreground"
                    aria-label="Copiar enlace de invitación"
                  >
                    {copiedId === invite.id ? (
                      <Check className="size-4 text-brand" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(invite.id)}
                    className="flex size-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Anular invitación"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-foreground/70">
            Monitores vinculados
          </h2>
          {members.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingMembers((v) => !v)}
            >
              {editingMembers ? "Listo" : "Editar"}
            </Button>
          )}
        </div>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/50">
            Todavía no hay monitores vinculados a este club.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-2xl border border-[#050505]/10 px-4 py-3 dark:border-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-foreground/50">
                    {member.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/70">
                    {SPORT_LABELS[member.sport]}
                  </span>
                  {editingMembers && (
                    <button
                      type="button"
                      onClick={() => void removeMember(member)}
                      disabled={removingId === member.id}
                      aria-label={`Desvincular a ${member.name}`}
                      className="rounded-full p-1.5 text-foreground/50 transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {removingId === member.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
