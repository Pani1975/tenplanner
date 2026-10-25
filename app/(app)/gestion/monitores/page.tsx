import { notFound, redirect } from "next/navigation";
import { Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getClubAccountClubId,
  getOwnedClub,
  listClubRoster,
} from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import { ClubOwnerPanel } from "../../club/club-owner-panel";

export const metadata = { title: "Monitores" };
export const dynamic = "force-dynamic";

// Modo gestión: invitar monitores al club, ver quién está dentro y darles de
// baja. Solo la cuenta del club.
export default async function ManagementCoachesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await getClubAccountClubId(user.id))) notFound();
  const [club, activeSport] = await Promise.all([
    getOwnedClub(user.id),
    getActiveSport(user.id),
  ]);
  if (!club) notFound();
  const { members, invites } = await listClubRoster(club.id);

  return (
    <div className="min-h-full w-full bg-[#050505] text-white">
      <div className="tp-page-pad mx-auto max-w-3xl space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <Users2 className="size-3.5" />
            Modo gestión
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Monitores {club.name}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Invita monitores por email. Cuando acepten, tendrán el Modo{" "}
            {club.name} para trabajar con el club, además de su Modo particular.
          </p>
        </header>
        <ClubOwnerPanel
          club={club}
          initialMembers={members}
          initialInvites={invites}
          defaultSport={activeSport}
        />
      </div>
    </div>
  );
}
