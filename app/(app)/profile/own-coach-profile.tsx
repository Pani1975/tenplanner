"use client";

import { useState } from "react";
import { CheckCircle2, IdCard } from "lucide-react";
import {
  CoachProfileForm,
  type CoachProfileInitial,
} from "@/components/app/coach-profile-form";
import { saveOwnCoachProfile } from "./coach-profile-actions";

/**
 * Perfil del monitor (su ficha): contacto, formación, disponibilidad y
 * experiencia. La controla él; los gestores de sus clubes la ven en
 * Gestión → Monitores.
 */
export function OwnCoachProfile({
  initial,
  clubNames,
}: {
  initial: CoachProfileInitial;
  clubNames: string[];
}) {
  const [saved, setSaved] = useState(false);
  const clubs = clubNames.join(", ");
  return (
    <section className="tp-panel space-y-4 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <IdCard className="mt-0.5 size-5 shrink-0 text-brand" />
        <div>
          <h2 className="text-sm font-black uppercase text-foreground">
            Mi perfil de monitor
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-foreground/55">
            Tus datos de contacto, formación, disponibilidad y experiencia. Los
            controlas tú: {clubs} los ve, pero no los puede cambiar.
          </p>
        </div>
      </div>
      {saved && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
          <CheckCircle2 className="size-3.5" /> Perfil guardado.
        </p>
      )}
      <CoachProfileForm
        initial={initial}
        lockEmail
        submitLabel="Guardar mi perfil"
        consentLabel={`Acepto que ${clubs} guarde y use estos datos para gestionar mi trabajo como monitor/a.`}
        onSubmit={async (data, consent) => {
          setSaved(false);
          const result = await saveOwnCoachProfile(data, consent);
          if (result.ok) setSaved(true);
          return result;
        }}
      />
    </section>
  );
}
