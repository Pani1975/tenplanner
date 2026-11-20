import { getTranslations } from "next-intl/server";
import { GuestTournamentList } from "./guest-client";

export async function generateMetadata() {
  const t = await getTranslations("tournaments.guest");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default function ProbarTorneosPage() {
  return <GuestTournamentList />;
}
