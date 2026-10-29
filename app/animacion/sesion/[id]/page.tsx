import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClassAnimationPlayer } from "@/components/app/class-animation-player";
import { hasSessionAnimation } from "@/lib/classes/animation";
import { loadSessionAnimationData } from "@/lib/sessions/animation-data";

// Enlace público para compartir la animación de una sesión. Solo existe para
// las sesiones con animación activada y muestra únicamente la animación.

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!hasSessionAnimation(id)) return { title: "Animación · TenPlanner" };
  const data = await loadSessionAnimationData(id);
  return {
    title: data ? `${data.name} · Animación · TenPlanner` : "TenPlanner",
    robots: { index: false, follow: false },
  };
}

export default async function SharedSessionAnimationPage({
  params,
}: PageProps) {
  const { id } = await params;
  if (!hasSessionAnimation(id)) notFound();
  const data = await loadSessionAnimationData(id);
  if (!data) notFound();

  return (
    <main className="min-h-dvh bg-[#050505] px-2 py-4 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-white/10">
        <ClassAnimationPlayer
          name={data.name}
          objectives={data.objectives}
          blocks={data.blocks}
          sharePath={`/animacion/sesion/${id}`}
          kindLabel="Animación de la sesión"
        />
      </div>
      <p className="mt-4 text-center text-xs text-white/45">
        Hecho con{" "}
        <Link href="/" className="font-semibold text-[#D6FF38] hover:underline">
          TenPlanner
        </Link>
      </p>
    </main>
  );
}
