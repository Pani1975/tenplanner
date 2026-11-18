import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AppScreensPhone } from "./app-screens-phone";
import { LANDING_SCREENS, LANDING_SCREENS_EN } from "@/lib/landing-screens";
import {
  ArrowDown,
  BarChart3,
  BatteryFull,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Folder,
  Layers3,
  MessageSquare,
  Pencil,
  Repeat2,
  Search,
  Signal,
  Star,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { splitTitle, type LandingContent } from "@/lib/landing-content";
import type { LandingStats } from "@/lib/landing-stats";
import { LandingNav } from "./landing-nav";
import { StatsSection } from "./stats-section";
import { Reveal, RevealItem, RevealStagger } from "./landing-reveal";
import { TenPlannerMark } from "./ten-planner-mark";
import {
  type LandingClassCard,
  type LandingExerciseCard,
  LibrarySection,
} from "./library-tabs";

const painCards = [
  { icon: ClipboardList, id: "p1" },
  { icon: Repeat2, id: "p2" },
  { icon: Clock3, id: "p3" },
];

const steps = ["s1", "s2", "s3"];

const preparationCards = [
  { icon: Search, id: "c1", chips: 3, color: "bg-[#efffba] text-[#5f7000]" },
  { icon: Pencil, id: "c2", chips: 2, color: "bg-[#ecece6] text-[#050505]" },
  { icon: Repeat2, id: "c3", chips: 2, color: "bg-[#e8e8e1] text-[#5f7000]" },
];

const featureCards = [
  { icon: Search, id: "f1" },
  { icon: Layers3, id: "f2" },
  { icon: Star, id: "f3" },
  { icon: CalendarDays, id: "f4" },
  { icon: ClipboardCheck, id: "f5" },
  { icon: Folder, id: "f6" },
];

const academyFeatureCards = [
  { icon: FileText, id: "a1" },
  { icon: Users, id: "a2" },
  { icon: MessageSquare, id: "a3" },
  { icon: BarChart3, id: "a4" },
  { icon: Building2, id: "a5" },
  { icon: CalendarDays, id: "a6" },
];

const phoneActions: Array<{ icon: LucideIcon; key: string }> = [
  { icon: Search, key: "explore" },
  { icon: Pencil, key: "create" },
  { icon: Repeat2, key: "reuse" },
  { icon: Star, key: "favorites" },
];

function SectionTitle({
  eyebrow,
  title,
  light = false,
}: {
  eyebrow: string;
  title: string;
  light?: boolean;
}) {
  const { main, accent } = splitTitle(title);
  return (
    <div className="mx-auto max-w-4xl text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#5f7000]">
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-5 font-heading text-[clamp(2.4rem,4.8vw,4.35rem)] font-bold leading-[0.95]",
          light ? "text-white" : "text-[#050505]"
        )}
      >
        {main}
        <span
          className={cn(
            "block font-heading font-light italic",
            light ? "text-white/45" : "text-[#5f7000]"
          )}
        >
          {accent}
        </span>
      </h2>
    </div>
  );
}

function PrimaryButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#d6ff38] px-8 text-base font-bold text-[#050505] shadow-[0_18px_35px_rgba(95,112,0,0.2)] transition hover:bg-white"
    >
      {children}
    </Link>
  );
}

function PhoneMock() {
  const t = useTranslations("landing.phone");
  return (
    <div className="relative mx-auto h-[560px] w-[282px] overflow-hidden rounded-[38px] bg-[#050505] p-4 text-white shadow-[0_45px_100px_rgba(5,5,5,0.22)] ring-1 ring-black/10">
      <div className="flex items-center justify-between px-4 pt-3 text-xs font-bold text-white/85">
        <span>9:41</span>
        <span aria-hidden className="flex items-center gap-1.5 text-white/55">
          <Signal className="size-3" strokeWidth={2.5} />
          <Wifi className="size-3" strokeWidth={2.5} />
          <BatteryFull className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>
      <div className="mt-7 border-b border-white/8 px-4 pb-5">
        <p className="text-[11px] font-semibold text-white/45">{t("greeting")}</p>
        <p className="mt-1 font-heading text-xl font-bold">Carlos Martínez</p>
      </div>
      <div className="mx-3 mt-4 rounded-2xl border border-[#d6ff38]/30 bg-[#2b3613] p-4">
        <p className="text-[10px] font-bold uppercase text-white/45">
          {t("nextClass")}
        </p>
        <p className="mt-3 text-sm font-bold">{t("group")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["6", t("exercises")],
            ["60", t("min")],
            ["8", t("students")],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-full bg-white/10 px-2 py-2 text-center"
            >
              <p className="text-xs font-bold">{value}</p>
              <p className="text-[9px] text-white/55">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-3 mt-4 grid grid-cols-2 gap-2">
        {phoneActions.map(({ icon: Icon, key }) => (
          <div
            key={key}
            className="min-h-[86px] rounded-xl border border-white/8 bg-white/[0.045] p-3"
          >
            <Icon className="size-5 text-[#d6ff38]" />
            <p className="mt-3 text-[10px] font-bold leading-3 text-white/70">
              {t(key)}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-3 mt-4">
        <p className="text-[10px] font-bold uppercase text-white/35">
          {t("todaySession")}
        </p>
        {[
          [t("warmup"), "10'"],
          [t("crossDrive"), "15'"],
        ].map(([title, time], index) => (
          <div
            key={title}
            className="mt-2 flex items-center justify-between rounded-xl bg-white/[0.045] px-3 py-3"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold text-white/62">
              <span
                className={cn(
                  "size-2 rounded-full",
                  index === 0 ? "bg-[#d6ff38]" : "bg-[#ff7a66]"
                )}
              />
              {title}
            </span>
            <span className="text-[10px] text-white/40">{time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroSection({ content }: { content: LandingContent }) {
  const t = useTranslations("landing.hero");
  // En inglés, capturas de la interfaz en inglés.
  const screens = useLocale() === "en" ? LANDING_SCREENS_EN : LANDING_SCREENS;
  const hero = splitTitle(content.home_hero_title);
  return (
    <section className="relative min-h-[780px] overflow-hidden border-b border-[#050505]/10 bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <div className="absolute right-0 top-0 hidden h-full w-[46%] bg-[radial-gradient(circle_at_66%_14%,rgba(214,255,56,0.18),transparent_22%),linear-gradient(90deg,transparent,rgba(232,232,225,0.72))] lg:block" />
      <div className="relative mx-auto grid max-w-[1710px] gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-3 rounded-full bg-[#efffba] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5f7000]">
            <span className="size-1.5 rounded-full bg-[#5f7000]" />
            {content.home_hero_badge}
          </div>
          <h1 className="mt-8 font-heading text-[clamp(3.1rem,5.1vw,5.5rem)] font-bold leading-[0.96] text-[#050505]">
            {hero.main}
            <span className="block font-heading font-light italic text-[#5f7000]">
              {hero.accent}
            </span>
          </h1>
          <p className="mt-7 max-w-[560px] text-lg leading-8 text-[#66665d]">
            {content.home_hero_subtitle}
          </p>
          <div className="mt-10 flex flex-col gap-4 min-[440px]:flex-row min-[440px]:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <PrimaryButton href="/login">
                {content.home_hero_cta_primary}
              </PrimaryButton>
            </div>
            <Link
              href="#como-funciona"
              className="inline-flex items-center gap-2 text-base font-semibold text-[#5f7000]"
            >
              {content.home_hero_cta_secondary} <ArrowDown className="size-4" />
            </Link>
          </div>
          <div className="mt-14 flex items-center gap-3 text-sm text-[#66665d]">
            <div className="flex -space-x-2">
              {["M", "A", "L"].map((item, index) => (
                <span
                  key={item}
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-xs font-bold text-white ring-2 ring-[#f4f4f1]",
                    index === 0 && "bg-[#050505]",
                    index === 1 && "bg-[#5f7000]",
                    index === 2 && "bg-[#d6ff38] text-[#050505]"
                  )}
                >
                  {item}
                </span>
              ))}
            </div>
            {content.home_hero_proof}
          </div>
        </div>

        <div className="relative min-h-[560px]">
          <div className="absolute left-[4%] top-[76%] hidden rounded-2xl bg-[#050505] px-5 py-3 text-sm font-bold text-white shadow-[0_24px_55px_rgba(5,5,5,0.18)] lg:block">
            {t("sessionSaved")}
          </div>
          <div className="absolute right-[2%] top-[20%] hidden rounded-2xl bg-white px-5 py-3 text-sm font-medium text-[#050505] shadow-[0_20px_55px_rgba(5,5,5,0.12)] lg:block">
            {t("ready")}
          </div>
          {screens.length > 0 ? (
            <AppScreensPhone screens={screens} />
          ) : (
            <PhoneMock />
          )}
        </div>
      </div>
    </section>
  );
}

function ProblemSection({ content }: { content: LandingContent }) {
  const t = useTranslations("landing");
  const title = splitTitle(content.home_problem_title);
  return (
    <section className="relative overflow-hidden bg-[#050505] px-5 py-24 text-white lg:py-32">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(214,255,56,0.08),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[900px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#d6ff38]">
          {t("problemEyebrow")}
        </p>
        <h2 className="mt-7 font-heading text-[clamp(2.5rem,4.3vw,4.1rem)] font-light leading-[0.96]">
          {title.main}
          <span className="block font-heading italic text-white/45">
            {title.accent}
          </span>
        </h2>
        <RevealStagger className="mt-14 grid gap-5 md:grid-cols-3">
          {painCards.map((card) => (
            <RevealItem key={card.id}>
              <article className="min-h-[265px] rounded-2xl border border-white/10 bg-white/[0.045] p-7 transition hover:border-white/18">
                <span className="grid size-12 place-items-center rounded-xl bg-white/8 text-[#d6ff38]">
                  <card.icon className="size-6" />
                </span>
                <h3 className="mt-8 font-heading text-xl font-bold italic leading-6">
                  {t(`pain.${card.id}.quote`)}
                </h3>
                <p className="mt-5 text-sm leading-6 text-white/48">
                  {t(`pain.${card.id}.text`)}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

function HowSection({ content }: { content: LandingContent }) {
  const t = useTranslations("landing");
  return (
    <section id="como-funciona" className="bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <SectionTitle eyebrow={t("how.eyebrow")} title={content.home_how_title} />
      <p className="mx-auto mt-7 max-w-[660px] text-center text-lg leading-8 text-[#66665d]">
        {t("how.introBefore")}{" "}
        <Link href="/exercises" className="font-semibold text-[#5f7000]">
          {t("how.exercisesLink")}
        </Link>{" "}
        {t("how.and")}{" "}
        <Link href="/classes" className="font-semibold text-[#5f7000]">
          {t("how.classesLink")}
        </Link>
        {t("how.introAfter")}
      </p>
      <RevealStagger className="mx-auto mt-16 grid max-w-[1100px] gap-10 md:grid-cols-3">
        {steps.map((step, index) => (
          <RevealItem key={step}>
            <article className="relative text-center">
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-9 hidden h-px w-full bg-[#d8d8cf] md:block" />
              )}
              <div className="relative mx-auto grid size-[72px] place-items-center rounded-full bg-[#050505] font-heading text-4xl font-bold text-[#d6ff38] shadow-[0_16px_35px_rgba(5,5,5,0.16)]">
                {index + 1}
              </div>
              <h3 className="mt-8 font-heading text-2xl font-bold text-black">
                {t(`steps.${step}.title`)}
              </h3>
              <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-7 text-[#66665d]">
                {t(`steps.${step}.text`)}
              </p>
            </article>
          </RevealItem>
        ))}
      </RevealStagger>

      <Reveal className="mx-auto mt-16 flex max-w-[1100px] flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold text-[#66665d]">
          {t("how.stepByStep")}
        </p>
        <div className="flex flex-col gap-3 min-[440px]:flex-row">
          <Link
            href="/ayuda?nivel=rapida"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[#050505] px-6 text-sm font-bold text-[#050505] transition hover:bg-[#050505] hover:text-white"
          >
            {t("how.quickGuide")}
          </Link>
          <Link
            href="/ayuda?nivel=completa"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[#050505] px-6 text-sm font-bold text-[#050505] transition hover:bg-[#050505] hover:text-white"
          >
            {t("how.fullGuide")}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function PreparationSection({ content }: { content: LandingContent }) {
  const t = useTranslations("landing");
  return (
    <section className="bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <SectionTitle
        eyebrow={t("prepEyebrow")}
        title={content.home_prep_title}
      />
      <p className="mx-auto mt-7 max-w-[660px] text-center text-lg leading-8 text-[#66665d]">
        {content.home_prep_text}
      </p>
      <RevealStagger className="mx-auto mt-16 grid max-w-[1240px] gap-4 md:grid-cols-2 lg:grid-cols-3">
        {preparationCards.map((card, index) => (
          <RevealItem
            key={card.id}
            className={cn("h-full", index === 2 && "md:col-span-2 lg:col-span-1")}
          >
            <article className="h-full rounded-2xl border border-[#d8d8cf] bg-white p-9 shadow-[0_12px_30px_rgba(5,5,5,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(5,5,5,0.07)] lg:p-8">
              <div className="grid gap-6 sm:grid-cols-[58px_1fr] lg:grid-cols-1 lg:gap-5">
                <span
                  className={cn(
                    "grid size-14 place-items-center rounded-2xl text-2xl",
                    card.color
                  )}
                >
                  <card.icon className="size-6" />
                </span>
                <div>
                  <h3 className="font-heading text-2xl font-bold text-black">
                    {t(`prep.${card.id}.title`)}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-[#66665d]">
                    {t(`prep.${card.id}.text`)}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {Array.from({ length: card.chips }, (_, i) => i + 1).map((n) => (
                      <span
                        key={n}
                        className="rounded-full bg-[#efffba] px-3 py-1 text-xs font-semibold text-[#5f7000]"
                      >
                        {t(`prep.${card.id}.chip${n}`)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}

function FeaturesSection({
  title,
  cards,
  group,
}: {
  title: string;
  cards: typeof featureCards;
  group: "features" | "academy";
}) {
  const t = useTranslations("landing");
  return (
    <section className="bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <SectionTitle eyebrow={t("featuresEyebrow")} title={title} />
      <RevealStagger
        stagger={0.06}
        className="mx-auto mt-16 grid max-w-[1110px] gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <RevealItem key={card.id}>
              <article className="min-h-[218px] rounded-2xl border border-[#d8d8cf] bg-white p-7 shadow-[0_12px_30px_rgba(5,5,5,0.04)] transition hover:-translate-y-0.5 hover:border-[#5f7000]/25 hover:shadow-[0_18px_40px_rgba(5,5,5,0.07)]">
                <span className="grid size-12 place-items-center rounded-xl bg-[#efffba] text-[#5f7000]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-bold text-[#050505]">
                  {t(`${group}.${card.id}.title`)}
                </h3>
                <p className="mt-4 text-sm leading-6 text-[#66665d]">
                  {t(`${group}.${card.id}.text`)}
                </p>
              </article>
            </RevealItem>
          );
        })}
      </RevealStagger>
    </section>
  );
}


function FinalCtaSection({ content }: { content: LandingContent }) {
  const title = splitTitle(content.home_final_title);
  return (
    <section className="border-b border-[#050505]/10 bg-[#f4f4f1] px-5 py-20">
      <Reveal>
        <div className="mx-auto grid max-w-[1710px] gap-8 rounded-[32px] bg-[#050505] px-8 py-16 text-white md:grid-cols-[1fr_auto] md:items-center lg:px-16">
          <div>
            <h2 className="font-heading text-[clamp(2.4rem,4.3vw,4.3rem)] font-bold leading-[0.95]">
              {title.main}
              <span className="block font-heading font-light italic text-white/45">
                {title.accent}
              </span>
            </h2>
            <p className="mt-5 text-base text-white/65">
              {content.home_final_text}
            </p>
          </div>
          <div className="md:text-center">
            <div className="flex flex-wrap items-center gap-3 md:justify-center">
              <PrimaryButton href="/login">
                {content.home_final_cta}
              </PrimaryButton>
            </div>
            <p className="mt-4 text-xs text-white/42">
              {content.home_final_note}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer({ content }: { content: LandingContent }) {
  const t = useTranslations("landing.footer");
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#050505] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <Link
            href="/"
            className="flex items-center gap-2.5 font-heading text-[22px] font-bold text-white"
          >
            <TenPlannerMark className="size-9 rounded-[10px]" />
            Ten<span className="text-[#d6ff38]">·</span>Planner
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/58">
            {content.home_footer_tagline}
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-black uppercase text-white">{t("product")}</p>
            <div className="mt-3 grid gap-2 text-sm text-white/58">
              <Link href="#como-funciona">{t("howItWorks")}</Link>
              <Link href="/exercises">{t("exerciseLibrary")}</Link>
              <Link href="/classes">{t("classLibrary")}</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-black uppercase text-white">{t("account")}</p>
            <div className="mt-3 grid gap-2 text-sm text-white/58">
              <Link href="/login">{t("login")}</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-black uppercase text-white">{t("support")}</p>
            <div className="mt-3 grid gap-2 text-sm text-white/58">
              <Link href="mailto:hola@tenplanner.app">{t("contact")}</Link>
              <Link href="#como-funciona">{t("faq")}</Link>
              <a
                href="https://www.instagram.com/tenplanner/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("instagramLabel")}
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
                </svg>
                Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs font-semibold text-white/42 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("copyright", { year })}</p>
        <nav
          aria-label={t("legalNav")}
          className="flex flex-wrap gap-x-4 gap-y-1 [&>a]:py-2 [&>a:hover]:text-white"
        >
          <Link href="/aviso-legal">{t("legalNotice")}</Link>
          <Link href="/terminos">{t("terms")}</Link>
          <Link href="/privacidad">{t("privacy")}</Link>
          <Link href="/cookies">{t("cookies")}</Link>
        </nav>
      </div>
    </footer>
  );
}

export function TenPlannerLanding({
  className,
  exerciseCards,
  classCards,
  content,
  stats,
}: {
  className?: string;
  exerciseCards: LandingExerciseCard[];
  classCards: LandingClassCard[];
  content: LandingContent;
  stats: LandingStats;
}) {
  const academyTitle = useTranslations("landing.academy")("title");
  return (
    <div
      className={cn(
        "min-h-screen overflow-x-clip bg-[#f4f4f1] text-[#050505]",
        className
      )}
    >
      <LandingNav />
      <main id="main">
        <HeroSection content={content} />
        <StatsSection stats={stats} />
        <ProblemSection content={content} />
        <HowSection content={content} />
        <PreparationSection content={content} />
        <FeaturesSection
          title={content.home_features_title}
          cards={featureCards}
          group="features"
        />
        <FeaturesSection
          title={academyTitle}
          cards={academyFeatureCards}
          group="academy"
        />
        <LibrarySection exerciseCards={exerciseCards} classCards={classCards} />
        <FinalCtaSection content={content} />
      </main>
      <Footer content={content} />
    </div>
  );
}
