import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { HelpGuide } from "@/components/app/help/help-guide";
import { LifeBuoy } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("helpTitle"),
    description: t("helpDescription"),
    alternates: { canonical: "/ayuda" },
  };
}

interface PageProps {
  searchParams: Promise<{
    nivel?: string;
    perfil?: string;
  }>;
}

export default async function AyudaPage({ searchParams }: PageProps) {
  const tx = await getTranslations("ui.s_ayuda_page");
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const [row] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    isAdmin = row?.isAdmin ?? false;
  }

  const validTabs = new Set(["coach", "admin", "club"]);
  const defaultTab =
    params.perfil && validTabs.has(params.perfil)
      ? params.perfil
      : isAdmin
        ? "admin"
        : "coach";

  const defaultLevel = params.nivel === "completa" ? "full" : "quick";

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            <LifeBuoy className="size-3.5" />
            {tx("ayuda")}
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            {tx("centroDeAyuda")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            {tx("eligeEntreLaGuia")}
          </p>
        </header>

        <div className="tp-panel p-5 sm:p-6">
          <HelpGuide defaultTab={defaultTab} defaultLevel={defaultLevel} />
        </div>
      </div>
    </div>
  );
}
