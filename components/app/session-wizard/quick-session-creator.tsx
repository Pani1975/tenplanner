"use client";

import { type FormEvent, useState } from "react";
import { ArrowRight, Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { defaultScheduledAt } from "./defaults";

export function QuickSessionCreator() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Escribe un título para crear la sesión rápida.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: null,
          scheduledAt: new Date(defaultScheduledAt()).toISOString(),
          durationMinutes: 60,
          objective: null,
          intensity: null,
          tags: null,
          location: null,
          studentIds: [],
          exercises: [],
          createdVia: "quick",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: { id?: string };
        details?: Array<{ message?: string }>;
        error?: string;
      };

      if (!response.ok || !payload.data?.id) {
        setError(
          payload.details
            ?.map((detail) => detail.message)
            .filter(Boolean)
            .join(". ") ||
            payload.error ||
            "No se pudo crear la sesión rápida."
        );
        return;
      }

      router.push(`/sessions/${payload.data.id}`);
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-4 text-brand" />
          Crear sesión rápida
        </CardTitle>
        <CardDescription>
          Solo pide un título. La fecha queda para dentro de una hora y el resto
          lo podrás completar después desde el detalle.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 md:flex-row md:items-center"
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej: Sesión técnica de bandeja"
            className="h-11"
            disabled={submitting}
            aria-invalid={!!error}
          />
          <Button
            type="submit"
            className="h-11 px-4 md:min-w-[200px]"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Crear rápida
            <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
