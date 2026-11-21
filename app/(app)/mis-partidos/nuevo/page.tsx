import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import { FamilyHeader } from "@/components/family/family-header";
import { MatchForm } from "@/components/matches/match-form";

export const metadata = { title: "Añadir partido" };

export default function NuevoPartidoPage() {
  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-3xl space-y-6">
        <Link
          href="/mis-partidos"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Mis partidos
        </Link>
        <FamilyHeader
          icon={Swords}
          kicker="Mis partidos"
          title="Añadir partido"
          description="Elige el tipo y completa los datos. Los campos con * son obligatorios."
        />
        <MatchForm />
      </div>
    </div>
  );
}
