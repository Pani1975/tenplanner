import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CalendarPlus,
  FileDown,
  Globe2,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import { splitTitle } from "@/lib/landing-content";
import { Reveal, RevealItem, RevealStagger } from "./landing-reveal";

const tournamentCards = [
  { id: "t1", icon: CalendarPlus },
  { id: "t2", icon: UserPlus },
  { id: "t3", icon: FileDown },
  { id: "t4", icon: Trophy },
  { id: "t5", icon: Globe2 },
  { id: "t6", icon: Users },
] as const;

export function TournamentsSection() {
  const t = useTranslations("landing.tournaments");
  const title = splitTitle(t("title"));

  return (
    <section className="bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <div className="mx-auto max-w-[1110px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#5f7000]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-5 font-heading text-[clamp(2.4rem,4.8vw,4.35rem)] font-bold leading-[0.95] text-[#050505]">
            {title.main}
            <span className="block font-heading font-light italic text-[#5f7000]">
              {title.accent}
            </span>
          </h2>
          <p className="mx-auto mt-7 max-w-[660px] text-lg leading-8 text-[#66665d]">
            {t("intro")}
          </p>
        </div>

        <RevealStagger
          stagger={0.06}
          className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {tournamentCards.map(({ id, icon: Icon }) => (
            <RevealItem key={id}>
              <article className="h-full min-h-[218px] rounded-2xl border border-[#d8d8cf] bg-white p-7 shadow-[0_12px_30px_rgba(5,5,5,0.04)] transition hover:-translate-y-0.5 hover:border-[#5f7000]/25 hover:shadow-[0_18px_40px_rgba(5,5,5,0.07)]">
                <span className="grid size-12 place-items-center rounded-xl bg-[#efffba] text-[#5f7000]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-bold text-[#050505]">
                  {t(`cards.${id}.title`)}
                </h3>
                <p className="mt-4 text-sm leading-6 text-[#66665d]">
                  {t(`cards.${id}.text`)}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealStagger>

        <Reveal className="mt-12 flex flex-col items-center gap-4 text-center min-[440px]:flex-row min-[440px]:justify-center">
          <Link
            href="/probar-torneos"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#d6ff38] px-6 text-center text-base font-bold text-[#050505] shadow-[0_18px_35px_rgba(95,112,0,0.2)] transition hover:bg-[#050505] hover:text-white min-[440px]:w-auto min-[440px]:px-8"
          >
            {t("ctaPrimary")}
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-[#050505] px-6 text-center text-sm font-bold text-[#050505] transition hover:bg-[#050505] hover:text-white min-[440px]:w-auto"
          >
            {t("ctaSecondary")}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
