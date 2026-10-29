"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  CoachProfileForm,
  type CoachProfileInitial,
} from "@/components/app/coach-profile-form";
import { submitCoachProfileByLink } from "./actions";

export function FichaForm({
  token,
  clubName,
  initial,
}: {
  token: string;
  clubName: string;
  initial: CoachProfileInitial;
}) {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="space-y-3 py-5 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand text-brand-foreground">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="text-xl font-black text-foreground">¡Ficha enviada!</p>
        <p className="mx-auto max-w-sm text-sm leading-6 text-foreground/60">
          Gracias. {clubName} ya tiene tus datos. Puedes cerrar esta página. Si
          necesitas corregir algo, pídele al club que te envíe otro enlace.
        </p>
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
