import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { canTagWithClub } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { loadClubObjectives } from "@/lib/objectives";
import { ClubObjectivesManager } from "./club-objectives-manager";

interface PageProps {
  params: Promise<{ clubId: string }>;
}

export default async function ClubObjectivesPage({ params }: PageProps) {
  const { clubId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canTagWithClub(user.id, clubId))) notFound();

  const [club] = await db
    .select({ name: clubs.name })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);
  if (!club) notFound();

  const items = await loadClubObjectives(clubId, user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <Link
          href="/club"
          className="inline-flex items-center gap-1 text-xs font-black uppercase text-foreground/55 hover:text-brand"
        >
          <ChevronLeft className="size-3.5" />
          Mi club
        </Link>
        <p className="tp-kicker mt-3">Objetivos del club</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">
          {club.name}
        </h1>
        <p className="mt-2 text-sm leading-6 text-foreground/62">
          Estos objetivos los ven todos los alumnos del club en su ficha. Puedes
          añadir, editar o quitar cualquiera. El catálogo base de Ten Planner no
          cambia y los originales se pueden restaurar en cualquier momento.
        </p>
      </div>
      <ClubObjectivesManager clubId={clubId} items={items} />
    </div>
  );
}
