"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Loader2,
  Send,
  User,
  Users,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RecipientOptions } from "@/lib/messages";

type Target = "coach" | "coaches" | "group" | "student";

const TARGETS: { id: Target; label: string; icon: React.ElementType }[] = [
  { id: "coach", label: "Un monitor", icon: User },
  { id: "coaches", label: "Todos los monitores", icon: Users },
  { id: "group", label: "Un grupo", icon: Users2 },
  { id: "student", label: "Un alumno", icon: GraduationCap },
];

const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 dark:bg-input/35";

export function MessageComposer({
  options,
  sportLabel,
}: {
  options: RecipientOptions;
  sportLabel: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<Target>("coach");
  const [recipientId, setRecipientId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [allowReplies, setAllowReplies] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const list =
    target === "coach"
      ? options.coaches
      : target === "group"
        ? options.groups
        : target === "student"
          ? options.students
          : [];

  const hint = useMemo(() => {
    if (target === "coaches") {
      return options.coaches.length === 0
        ? `No hay monitores de ${sportLabel} en el club.`
        : `Lo recibirán los ${options.coaches.length} monitores de ${sportLabel} del club.`;
    }
    if (!recipientId) return null;
    if (target === "group") {
      const g = options.groups.find((x) => x.id === recipientId);
      if (!g) return null;
      return g.contacts === 0
        ? `El grupo tiene ${g.students} alumnos, pero ninguna familia tiene cuenta todavía: nadie recibirá el mensaje.`
        : `Lo recibirán las familias del grupo (${g.contacts} contactos con cuenta).`;
    }
    if (target === "student") {
      const s = options.students.find((x) => x.id === recipientId);
      if (!s) return null;
      const who = s.adult
        ? "al alumno (es mayor de edad)"
        : "a sus padres o tutores (es menor de edad o no consta su fecha de nacimiento)";
      return s.contacts === 0
        ? `Se enviaría ${who}, pero aún no tiene contactos con cuenta: nadie lo recibirá.`
        : `Se enviará ${who}.`;
    }
    return null;
  }, [target, recipientId, options, sportLabel]);

  function pickTarget(next: Target) {
    setTarget(next);
    setRecipientId("");
    setError(null);
    setSent(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSent(null);
    if (target !== "coaches" && !recipientId) {
      setError("Elige el destinatario.");
      return;
    }
    if (!title.trim() || !body.trim()) {
      setError("Escribe el asunto y el mensaje.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience: target,
          recipientUserId: target === "coach" ? recipientId : null,
          groupId: target === "group" ? recipientId : null,
          studentId: target === "student" ? recipientId : null,
          title: title.trim(),
          body: body.trim(),
          allowReplies:
            target === "group" || target === "student" ? allowReplies : false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          typeof data?.error === "string"
            ? data.error
            : "No se pudo enviar el mensaje."
        );
        return;
      }
      setTitle("");
      setBody("");
      setAllowReplies(false);
      setSent("Mensaje enviado.");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  const placeholder =
    target === "coach"
      ? "Elige un monitor"
      : target === "group"
        ? "Elige un grupo"
        : "Elige un alumno";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-black text-foreground">Para</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TARGETS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => pickTarget(id)}
              aria-pressed={target === id}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-left text-[13px] font-semibold transition-colors",
                target === id
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-input text-foreground/70 hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.7} />
              <span className="leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {target !== "coaches" && (
        <div className="space-y-2">
          <Label htmlFor="msg-recipient">
            {target === "coach"
              ? "Monitor"
              : target === "group"
                ? "Grupo"
                : "Alumno"}
          </Label>
          <select
            id="msg-recipient"
            className={selectClass}
            value={recipientId}
            onChange={(e) => {
              setRecipientId(e.target.value);
              setSent(null);
            }}
          >
            <option value="">{placeholder}</option>
            {list.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {list.length === 0 && (
            <p className="text-xs text-foreground/55">
              {target === "coach"
                ? `No hay monitores de ${sportLabel} en el club.`
                : target === "group"
                  ? `No hay grupos de ${sportLabel} en el club.`
                  : "No hay alumnos en el club."}
            </p>
          )}
        </div>
      )}

      {hint && (
        <p className="rounded-lg bg-brand/10 px-3 py-2 text-xs font-semibold leading-5 text-foreground/70">
          {hint}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="msg-title">Asunto</Label>
        <Input
          id="msg-title"
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="msg-body">Mensaje</Label>
        <Textarea
          id="msg-body"
          value={body}
          maxLength={4000}
          rows={5}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {(target === "group" || target === "student") && (
        <label className="flex items-center gap-2 text-sm text-foreground/75">
          <input
            type="checkbox"
            checked={allowReplies}
            onChange={(e) => setAllowReplies(e.target.checked)}
            className="size-4 accent-[var(--brand)]"
          />
          Permitir que las familias respondan
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="text-sm font-semibold text-foreground/70">
          {sent}
        </p>
      )}

      <Button type="submit" disabled={sending}>
        {sending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        Enviar
      </Button>
    </form>
  );
}
