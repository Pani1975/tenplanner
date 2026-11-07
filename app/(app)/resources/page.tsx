import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResourcesPanel } from "@/components/app/resources-panel";
import { BookMarked } from "lucide-react";
import {
  getActiveWorkClubId,
  getClubAccountClubId,
  getOwnedClub,
} from "@/lib/clubs";

export default async function ResourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activeClubId = await getActiveWorkClubId(user.id);
  const inClub = !!activeClubId;
  const [owned, clubAccountId] = await Promise.all([
    getOwnedClub(user.id),
    getClubAccountClubId(user.id),
  ]);
  const canManageClub = !!owned && owned.id === activeClubId;
  const canCopyToParticular = !clubAccountId;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <BookMarked className="size-3.5" />
            {inClub ? "Espacio del club" : "Zona personal"}
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            {inClub ? "Recursos club" : "Mis recursos"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            {inClub
              ? "Enlaces, documentos, imágenes y dibujos de pizarra del club, en una carpeta por monitor. Todos los miembros ven todo; cada monitor edita lo suyo."
              : "Enlaces, documentos, imágenes y dibujos de pizarra que te sirven para tu labor como monitor, organizados en Todos y Favoritos."}
          </p>
        </header>

        <div className="tp-panel p-5 sm:p-6">
          <ResourcesPanel
            userId={user.id}
            inClub={inClub}
            canManageClub={canManageClub}
            canCopyToParticular={canCopyToParticular}
          />
        </div>
      </div>
    </div>
  );
}
