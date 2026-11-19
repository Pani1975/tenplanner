import { notFound } from "next/navigation";
import { getPublicTournament } from "@/lib/tournaments/public";
import { publishedNews, publishedPhotos } from "@/lib/tournaments/media";
import { TournamentView } from "./tournament-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const SLUG = /^[a-z0-9-]{3,80}$/;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = SLUG.test(slug) ? await getPublicTournament(slug) : null;
  return {
    title: t ? t.name : "Torneo",
    // Hay menores entre los inscritos: la página no se indexa.
    robots: { index: false, follow: false },
  };
}

// Página pública del torneo: información, inscritos (solo nombre e
// iniciales), inscripción por enlace y, cuando empieza, cuadro y resultados.
// Un torneo privado no se muestra aquí (404).
export default async function PublicTournamentPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  const [news, photos] = await Promise.all([
    publishedNews(t.id),
    // Fotos en la página pública solo si el organizador lo ha activado.
    t.photosPublic ? publishedPhotos(t.id) : Promise.resolve([]),
  ]);
  return <TournamentView t={t} withRegistration media={{ news, photos }} />;
}
