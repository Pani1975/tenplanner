"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  CoachProfileForm,
  type CoachProfileInitial,
} from "@/components/app/coach-profile-form";
import { submitCoachProfileByLink } from "./actions";
import { useTranslations } from "next-intl";

export function FichaForm({
  token,
  clubName,
  initial,
}: {
  token: string;
  clubName: string;
  initial: CoachProfileInitial;
}) {
  const tx = useTranslations("ui.s_token_fichaform");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="space-y-3 py-5 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand text-brand-foreground">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="text-xl font-black text-foreground">{tx("fichaEnviada")}</p>
        <p className="mx-auto max-w-sm text-sm leading-6 text-foreground/60">
          {tx("graciasV1YaTiene", { v1: clubName })}</p>
      </div>
    );
  }

  return (
    <CoachProfileForm
      initial={initial}
      lockEmail
      submitLabel="Enviar mi ficha"
      consentLabel={`Acepto que ${clubName} guarde y use estos datos para gestionar mi trabajo como monitor/a.`}
      onSubmit={async (data, consent) => {
        const result = await submitCoachProfileByLink(token, data, consent);
        if (result.ok) setDone(true);
        return result;
      }}
    />
  );
}
