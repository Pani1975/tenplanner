"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

export function NewClubForm() {
  const tx = useTranslations("ui.s_club_newclubform");
  const router = useRouter();
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError(tx("escribeElNombreDel"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          plannedCoachSeats: seats ? Number(seats) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : tx("noSePudoRegistrar")
        );
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="club-name">{tx("nombreDelClub")}</Label>
        <Input
          id="club-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="club-seats">
          {tx("monitoresPrevistos")}{" "}
          <span className="font-normal text-foreground/50">{tx("opcional")}</span>
        </Label>
        <Input
          id="club-seats"
          type="number"
          min={0}
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        disabled={submitting}
        className="h-11 rounded-full font-black"
      >
        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
        {tx("registrarClub")}
      </Button>
    </form>
  );
}
