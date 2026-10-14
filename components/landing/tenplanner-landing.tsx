import Link from "next/link";
import {
  ArrowDown,
  BatteryFull,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Folder,
  Layers3,
  Pencil,
  Repeat2,
  Search,
  Signal,
  Star,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LandingNav } from "./landing-nav";
import { Reveal, RevealItem, RevealStagger } from "./landing-reveal";
import { TenPlannerMark } from "./ten-planner-mark";
import {
  type LandingClassCard,
  type LandingExerciseCard,
  LibrarySection,
} from "./library-tabs";

const painCards = [
  {
    icon: ClipboardList,
    quote: '"Llego a la pista sin tener claro qué voy a dar hoy."',
    text: "Improvisar no está mal, pero repetir siempre lo mismo sí. Tus alumnos lo notan.",
  },
  {
    icon: Repeat2,
    quote: '"Siempre acabo usando los mismos 10 ejercicios."',
    text: "No es falta de ideas, es falta de tiempo para buscarlas. Ten Planner lo hace por ti.",
  },
  {
    icon: Clock3,
    quote: '"Pierdo más tiempo planificando que dando clase."',
    text: "Una sesión bien planificada no debería llevarte más de 2 minutos. En serio.",
  },
];

const steps = [
  {
    title: "Piensa la clase",
    text: "Tú tienes el criterio. Decide si explorar la biblioteca, construir tu clase desde cero o recuperar una sesión anterior que ya funcionó.",
  },
  {
    title: "Construye o ajusta",
    text: "Elige ejercicios, ordénalos, mezcla con tus favoritos o ajusta la propuesta. Siempre tienes el control total de la sesión.",
  },
  {
    title: "Da la clase y evalúa",
    text: "Pasa lista, ejecuta la sesión en modo pista y registra cómo fue. Todo queda guardado en tu historial.",
  },
];

const preparationCards = [
  {
    icon: Search,
    title: "Explorar y elegir",
    text: "Navega el explorador: ejercicios sueltos o clases completas ya preparadas, todo etiquetado por nivel, duración, objetivo y categoría.",
    chips: ["Ejercicios sueltos", "Clases completas", "Todo etiquetado"],
    color: "bg-[#efffba] text-[#5f7000]",
  },
  {
    icon: Pencil,
    title: "Crear desde cero",
    text: "Diseña la clase ejercicio a ejercicio usando la biblioteca de Ten Planner, tus propios ejercicios creados por ti o una mezcla de ambos.",
    chips: ["Biblioteca Ten Planner", "Mis ejercicios"],
    color: "bg-[#ecece6] text-[#050505]",
  },
  {
    icon: Repeat2,
    title: "Reutilizar una clase anterior",
    text: "Recupérala del historial o de tus favoritos, ajusta lo que necesites y vuelve a impartirla. Lo que ya funciona no hay que reinventarlo.",
    chips: ["Mis clases", "Mis favoritos"],
    color: "bg-[#e8e8e1] text-[#5f7000]",
  },
];

const featureCards = [
  {
    icon: Search,
    title: "Explorador de contenido",
    text: "Ejercicios sueltos y clases completas etiquetados por nivel, objetivo, duración y categoría.",
  },
  {
    icon: Layers3,
    title: "Biblioteca validada",
    text: "Ejercicios específicos de tenis creados por entrenadores expertos, listos para usar o personalizar.",
  },
  {
    icon: Star,
    title: "Favoritos organizados",
    text: "Guarda ejercicios y clases en listas con nombre. Encuentra rápido lo que mejor te funciona.",
  },
  {
    icon: CalendarDays,
    title: "Tu calendario de clases",
    text: "Visualiza todas tus sesiones: impartidas, programadas y canceladas. Tu historial siempre disponible.",
  },
  {
    icon: ClipboardCheck,
    title: "Pase de lista",
    text: "Registra la asistencia en segundos. Historial completo de cada alumno por clase.",
  },
  {
    icon: Folder,
    title: "Mi espacio",
    text: "Tu calendario, tus grupos, tus espacios, tus ejercicios y tus clases creadas. Todo organizado en un solo lugar.",
  },
];

const phoneActions: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Search, label: "Explorar biblioteca" },
  { icon: Pencil, label: "Crear desde cero" },
  { icon: Repeat2, label: "Reutilizar clase" },
  { icon: Star, label: "Mis favoritos" },
];

function SectionTitle({
  eyebrow,
  title,
  accent,
  light = false,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  light?: boolean;
}) {
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
        {title}
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
        <p className="text-[11px] font-semibold text-white/45">Buenos días,</p>
        <p className="mt-1 font-heading text-xl font-bold">Carlos Martínez</p>
      </div>
      <div className="mx-3 mt-4 rounded-2xl border border-[#d6ff38]/30 bg-[#2b3613] p-4">
        <p className="text-[10px] font-bold uppercase text-white/45">
          Próxima clase
        </p>
        <p className="mt-3 text-sm font-bold">Grupo Iniciación · 10:00h</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["6", "ejercicios"],
            ["60", "min"],
            ["8", "alumnos"],
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
        {phoneActions.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="min-h-[86px] rounded-xl border border-white/8 bg-white/[0.045] p-3"
          >
            <Icon className="size-5 text-[#d6ff38]" />
            <p className="mt-3 text-[10px] font-bold leading-3 text-white/70">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-3 mt-4">
        <p className="text-[10px] font-bold uppercase text-white/35">
          Sesión de hoy
        </p>
        {[
          ["Calentamiento dinámico", "10'"],
          ["Drive cruzado en paralelo", "15'"],
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

function HeroSection() {
  return (
    <section className="relative min-h-[780px] overflow-hidden border-b border-[#050505]/10 bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <div className="absolute right-0 top-0 hidden h-full w-[46%] bg-[radial-gradient(circle_at_66%_14%,rgba(214,255,56,0.18),transparent_22%),linear-gradient(90deg,transparent,rgba(232,232,225,0.72))] lg:block" />
      <div className="relative mx-auto grid max-w-[1710px] gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-3 rounded-full bg-[#efffba] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#5f7000]">
            <span className="size-1.5 rounded-full bg-[#5f7000]" />
            Planificación inteligente para monitores de tenis
          </div>
          <h1 className="mt-8 font-heading text-[clamp(3.1rem,5.1vw,5.5rem)] font-bold leading-[0.96] text-[#050505]">
            La clase la piensas tú.
            <span className="block font-heading font-light italic text-[#5f7000]">
              Ten Planner te ayuda.
            </span>
          </h1>
          <p className="mt-7 max-w-[560px] text-lg leading-8 text-[#66665d]">
            Explora ejercicios y clases etiquetados, construye desde cero con la
            biblioteca o recupera lo que ya funcionó. Tres caminos, siempre tu
            criterio.
          </p>
          <div className="mt-10 flex flex-col gap-4 min-[440px]:flex-row min-[440px]:items-center">
            <PrimaryButton href="/register">Empieza gratis →</PrimaryButton>
            <Link
              href="#como-funciona"
              className="inline-flex items-center gap-2 text-base font-semibold text-[#5f7000]"
            >
              Ver cómo funciona <ArrowDown className="size-4" />
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
            Más de 200 monitores ya planifican con Ten Planner
          </div>
        </div>

        <div className="relative min-h-[560px]">
          <div className="absolute left-[4%] top-[76%] hidden rounded-2xl bg-[#050505] px-5 py-3 text-sm font-bold text-white shadow-[0_24px_55px_rgba(5,5,5,0.18)] lg:block">
            ✓ Sesión guardada ✓
          </div>
          <div className="absolute right-[2%] top-[20%] hidden rounded-2xl bg-white px-5 py-3 text-sm font-medium text-[#050505] shadow-[0_20px_55px_rgba(5,5,5,0.12)] lg:block">
            ⚡ Clase lista en 90 seg
          </div>
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="relative overflow-hidden bg-[#050505] px-5 py-24 text-white lg:py-32">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(214,255,56,0.08),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[900px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[#d6ff38]">
          El problema
        </p>
        <h2 className="mt-7 font-heading text-[clamp(2.5rem,4.3vw,4.1rem)] font-light leading-[0.96]">
          ¿Te suena esto?
          <span className="block font-heading italic text-white/45">
            A todos los monitores les pasa.
          </span>
        </h2>
        <RevealStagger className="mt-14 grid gap-5 md:grid-cols-3">
          {painCards.map((card) => (
            <RevealItem key={card.quote}>
              <article className="min-h-[265px] rounded-2xl border border-white/10 bg-white/[0.045] p-7 transition hover:border-white/18">
                <span className="grid size-12 place-items-center rounded-xl bg-white/8 text-[#d6ff38]">
                  <card.icon className="size-6" />
                </span>
                <h3 className="mt-8 font-heading text-xl font-bold italic leading-6">
                  {card.quote}
                </h3>
                <p className="mt-5 text-sm leading-6 text-white/48">
                  {card.text}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

function HowSection() {
  return (
    <section id="como-funciona" className="bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <SectionTitle
        eyebrow="Cómo funciona"
        title="Tú decides."
        accent="En minutos."
      />
      <RevealStagger className="mx-auto mt-20 grid max-w-[1100px] gap-10 md:grid-cols-3">
        {steps.map((step, index) => (
          <RevealItem key={step.title}>
            <article className="relative text-center">
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-9 hidden h-px w-full bg-[#d8d8cf] md:block" />
              )}
              <div className="relative mx-auto grid size-[72px] place-items-center rounded-full bg-[#050505] font-heading text-4xl font-bold text-[#d6ff38] shadow-[0_16px_35px_rgba(5,5,5,0.16)]">
                {index + 1}
              </div>
              <h3 className="mt-8 font-heading text-2xl font-bold text-black">
                {step.title}
              </h3>
              <p className="mx-auto mt-4 max-w-[320px] text-[15px] leading-7 text-[#66665d]">
                {step.text}
              </p>
            </article>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}

function PreparationSection() {
  return (
    <section className="bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <SectionTitle
        eyebrow="El monitor decide"
        title="Tú piensas la clase."
        accent="Tres formas de prepararla."
      />
      <p className="mx-auto mt-7 max-w-[660px] text-center text-lg leading-8 text-[#66665d]">
        No hay una única forma de planificar. Cada monitor trabaja diferente.
        Ten Planner se adapta a cómo quieres preparar cada sesión.
      </p>
      <RevealStagger className="mx-auto mt-16 grid max-w-[1110px] gap-4 md:grid-cols-2">
        {preparationCards.map((card, index) => (
          <RevealItem
            key={card.title}
            className={cn(index === 2 && "md:max-w-[542px]")}
          >
            <article className="rounded-2xl border border-[#d8d8cf] bg-white p-9 shadow-[0_12px_30px_rgba(5,5,5,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(5,5,5,0.07)]">
              <div className="grid gap-6 sm:grid-cols-[58px_1fr]">
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
                    {card.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-[#66665d]">
                    {card.text}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-[#efffba] px-3 py-1 text-xs font-semibold text-[#5f7000]"
                      >
                        {chip}
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

function FeaturesSection() {
  return (
    <section className="bg-[#f4f4f1] px-5 py-20 lg:py-28">
      <SectionTitle
        eyebrow="Funcionalidades"
        title="Todo lo que necesita"
        accent="un monitor de tenis"
      />
      <RevealStagger
        stagger={0.06}
        className="mx-auto mt-16 grid max-w-[1110px] gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {featureCards.map((card) => {
          const Icon = card.icon;
          return (
            <RevealItem key={card.title}>
              <article className="min-h-[218px] rounded-2xl border border-[#d8d8cf] bg-white p-7 shadow-[0_12px_30px_rgba(5,5,5,0.04)] transition hover:-translate-y-0.5 hover:border-[#5f7000]/25 hover:shadow-[0_18px_40px_rgba(5,5,5,0.07)]">
                <span className="grid size-12 place-items-center rounded-xl bg-[#efffba] text-[#5f7000]">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-bold text-[#050505]">
                  {card.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-[#66665d]">
                  {card.text}
                </p>
              </article>
            </RevealItem>
          );
        })}
      </RevealStagger>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="border-b border-[#050505]/10 bg-[#f4f4f1] px-5 py-20">
      <Reveal>
        <div className="mx-auto grid max-w-[1710px] gap-8 rounded-[32px] bg-[#050505] px-8 py-16 text-white md:grid-cols-[1fr_auto] md:items-center lg:px-16">
          <div>
            <h2 className="font-heading text-[clamp(2.4rem,4.3vw,4.3rem)] font-bold leading-[0.95]">
              La próxima clase,
              <span className="block font-heading font-light italic text-white/45">
                lista en minutos.
              </span>
            </h2>
            <p className="mt-5 text-base text-white/65">
              Únete a más de 200 monitores que ya planifican mejor con Ten
              Planner.
            </p>
          </div>
          <div className="md:text-center">
            <PrimaryButton href="/register">Empieza gratis →</PrimaryButton>
            <p className="mt-4 text-xs text-white/42">
              14 días gratis · Sin tarjeta
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
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
            Planificación profesional para entrenadores de deportes de raqueta.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-sm font-black uppercase text-white">Producto</p>
            <div className="mt-3 grid gap-2 text-sm text-white/58">
              <Link href="#como-funciona">Cómo funciona</Link>
              <Link href="/exercises">Biblioteca de ejercicios</Link>
              <Link href="/classes">Biblioteca de clases</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-black uppercase text-white">Cuenta</p>
            <div className="mt-3 grid gap-2 text-sm text-white/58">
              <Link href="/login">Entrar</Link>
              <Link href="/register">Crear cuenta</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-black uppercase text-white">Soporte</p>
            <div className="mt-3 grid gap-2 text-sm text-white/58">
              <Link href="mailto:hola@tenplanner.app">Contacto</Link>
              <Link href="#como-funciona">Preguntas frecuentes</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-xs font-semibold text-white/42 sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright {year} TenPlanner. Todos los derechos reservados.</p>
        <nav
          aria-label="Legal"
          className="flex flex-wrap gap-x-4 gap-y-1 [&>a]:py-2 [&>a:hover]:text-white"
        >
          <Link href="/aviso-legal">Aviso legal</Link>
          <Link href="/terminos">Términos</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
      </div>
    </footer>
  );
}

export function TenPlannerLanding({
  className,
  exerciseCards,
  classCards,
}: {
  className?: string;
  exerciseCards: LandingExerciseCard[];
  classCards: LandingClassCard[];
}) {
  return (
    <div
      className={cn(
        "min-h-screen overflow-x-clip bg-[#f4f4f1] text-[#050505]",
        className
      )}
    >
      <LandingNav />
      <main id="main">
        <HeroSection />
        <ProblemSection />
        <HowSection />
        <PreparationSection />
        <FeaturesSection />
        <LibrarySection exerciseCards={exerciseCards} classCards={classCards} />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}
