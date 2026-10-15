import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { HelpGuide } from "@/components/app/help/help-guide";
import { LifeBuoy } from "lucide-react";

export default async function AyudaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const defaultTab = row?.isAdmin ? "admin" : "coach";

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <LifeBuoy className="size-3.5" />
            Ayuda
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Centro de ayuda
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Elige entre la guía rápida, para empezar en pocos minutos, o la guía
            completa, con el detalle de cada función según tu perfil. No
            sustituye a la ayuda directa del equipo, pero te deja operativo
            desde ya.
          </p>
        </header>

        <div className="tp-panel p-5 sm:p-6">
          <HelpGuide defaultTab={defaultTab} />
        </div>
      </div>
    </div>
  );
}
