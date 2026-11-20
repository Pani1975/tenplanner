import { useTranslations } from "next-intl";
import { Building2, CalendarCheck, ClipboardList } from "lucide-react";

import { splitTitle } from "@/lib/landing-content";
import { RevealItem, RevealStagger } from "./landing-reveal";

const audiences = [
  { id: "clubs", icon: Building2 },
  { id: "coaches", icon: ClipboardList },
  { id: "players", icon: CalendarCheck },
] as const;

export function AudiencesSection() {
  const t = useTranslations("landing.audiences");
  const title = splitTitle(t("title"));

  return (
    <section className="relative overflow-hidden bg-[#050505] px-5 py-20 text-white lg:py-24">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(214,255,56,0.08),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1110px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#d6ff38]">
            {t("eyebrow")}
          </p>
          <h2 className="mt-5 font-heading text-[clamp(2.4rem,4.6vw,4rem)] font-bold leading-[0.95]">
            {title.main}
            <span className="block font-heading font-light italic text-white/45">
              {title.accent}
            </span>
          </h2>
        </div>
        <RevealStagger className="mt-14 grid gap-4 md:grid-cols-3">
          {audiences.map(({ id, icon: Icon }) => (
            <RevealItem key={id}>
              <article className="h-full min-h-[220px] rounded-2xl border border-white/10 bg-white/[0.045] p-7 transition hover:border-white/18">
                <span className="grid size-12 place-items-center rounded-xl bg-white/8 text-[#d6ff38]">
                  <Icon className="size-6" />
                </span>
                <h3 className="mt-7 font-heading text-xl font-bold text-white">
                  {t(`cards.${id}.title`)}
                </h3>
                <p className="mt-4 text-sm leading-6 text-white/58">
                  {t(`cards.${id}.text`)}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
