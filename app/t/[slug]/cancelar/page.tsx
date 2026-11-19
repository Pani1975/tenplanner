import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { dmSans } from "@/app/fonts/dm-sans";
import { findByCancelToken } from "@/lib/tournaments/public";
import { CancelButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

// Cancelar la inscripción con el enlace del correo (pide confirmación).
export default async function CancelPage({ params, searchParams }: Props) {
  const [{ slug }, { token }, t] = await Promise.all([
    params,
    searchParams,
    getTranslations("tournaments.public"),
  ]);
  const entry = token ? await findByCancelToken(token) : null;
  const valid = entry && entry.tournament.slug === slug;

  return (
    <div
      className={`${dmSans.variable} tp-torneos min-h-[100dvh] bg-background px-4 py-10 text-foreground`}
    >
      <main className="tp-card mx-auto max-w-md space-y-4 p-6">
        {!valid ? (
          <>
            <h1 className="tp-title text-2xl">{t("cancelInvalid")}</h1>
            <p className="text-sm text-foreground/70">
              {t("cancelInvalidText")}
            </p>
          </>
        ) : entry.status === "cancelled" ? (
          <>
            <h1 className="tp-title text-2xl">{t("cancelDone")}</h1>
            <p className="text-sm">
              {t("cancelDoneText", { tournament: entry.tournament.name })}
            </p>
          </>
        ) : (
          <>
            <h1 className="tp-title text-2xl">{t("cancelTitle")}</h1>
            <p className="text-sm">
              {t("cancelText", {
                name: entry.name,
                tournament: entry.tournament.name,
              })}
            </p>
            <CancelButton token={token!} />
          </>
        )}
        <Link
          href={`/t/${slug}`}
          className="inline-block text-sm font-semibold text-[var(--brand-ink)] underline"
        >
          {t("backToTournament")}
        </Link>
      </main>
    </div>
  );
}
