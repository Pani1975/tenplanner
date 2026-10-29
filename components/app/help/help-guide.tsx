"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Bot,
  Brain,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FileText,
  GraduationCap,
  Heart,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Users2,
  Wrench,
} from "lucide-react";

interface Step {
  title: string;
  description: string;
  icon: React.ElementType;
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="flex gap-4 rounded-2xl border border-[#050505]/10 bg-white p-4 dark:border-white/10 dark:bg-[#10100e]"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[13px] font-black text-brand">
            {i + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <step.icon
                className="size-4 shrink-0 text-foreground/50"
                strokeWidth={1.8}
              />
              <p className="text-sm font-black text-foreground">{step.title}</p>
            </div>
            <p className="mt-1 text-sm leading-6 text-foreground/66">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

interface Section {
  title: string;
  icon: React.ElementType;
  items: string[];
  open?: boolean;
}

function SectionList({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <details
          key={section.title}
          open={section.open}
          className="group rounded-2xl border border-[#050505]/10 bg-white dark:border-white/10 dark:bg-[#10100e]"
        >
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 select-none">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <section.icon className="size-4" strokeWidth={1.8} />
            </span>
            <span className="flex-1 text-sm font-black text-foreground">
              {section.title}
            </span>
            <span className="text-foreground/40 transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <ul className="space-y-2 px-4 pb-4 pl-[3.25rem]">
            {section.items.map((item, i) => (
              <li
                key={i}
                className="list-disc text-sm leading-6 text-foreground/66 marker:text-brand"
              >
                {item}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

const coachSteps: Step[] = [
  {
    title: "Elige tu deporte",
    description:
      "Arriba del todo puedes cambiar entre tenis, pádel y pickleball. Cada deporte tiene su propia biblioteca, sesiones y calendario.",
    icon: Sparkles,
  },
  {
    title: "Mira tu Biblioteca",
    description:
      "En Ejercicios y Clases encontrarás contenido ya disponible (de Ten Planner, de tu club o tuyo propio). Puedes crear el tuyo y marcar favoritos para encontrarlo rápido.",
    icon: Dumbbell,
  },
  {
    title: "Da de alta a tus alumnos",
    description:
      "En Alumnos registra sus fichas. Si entrenas a varios a la vez, crea un Grupo para no repetir el proceso en cada sesión.",
    icon: Users,
  },
  {
    title: "Crea tu primera sesión",
    description:
      "Desde Sesiones → Nueva sesión, arma la sesión paso a paso, a partir de una clase de tu biblioteca, o con la creación rápida. El nombre sigue el código AAMMDD_Grupo (p. ej. 260930_Galácticas).",
    icon: ClipboardList,
  },
  {
    title: "Repite sesiones automáticamente",
    description:
      "Si una sesión se repite cada semana, márcala como recurrente y elige hasta qué fecha del curso quieres generarla.",
    icon: CalendarDays,
  },
  {
    title: "Guarda tus favoritas",
    description:
      "Las sesiones que más repites puedes guardarlas en Listas, dentro del menú de Sesiones, para no volver a montarlas desde cero.",
    icon: Heart,
  },
  {
    title: "Consulta el Calendario y tus Lugares",
    description:
      "El Calendario te muestra la semana de un vistazo. En Lugares guarda las pistas o instalaciones donde entrenas habitualmente.",
    icon: MapPin,
  },
  {
    title: "Apóyate en el Asistente Planner",
    description:
      "Es un chat aparte de la planificación normal: úsalo cuando quieras ayuda redactando o resolviendo dudas puntuales, no para sustituir los tres métodos de creación de sesiones.",
    icon: GraduationCap,
  },
];

const adminSteps: Step[] = [
  {
    title: "Entra al Panel de administración",
    description:
      "Solo visible si tu cuenta tiene permisos de administrador: aparece como un botón al pie del menú lateral.",
    icon: ShieldCheck,
  },
  {
    title: "Usuarios",
    description:
      "Gestiona altas, roles y permisos de las cuentas de la plataforma.",
    icon: Users,
  },
  {
    title: "Contenido",
    description:
      "Revisa y modera los ejercicios y clases de la biblioteca pública, incluido el contenido aportado por clubs.",
    icon: LayoutDashboard,
  },
  {
    title: "Ajustes",
    description:
      "Activa o desactiva funciones para toda la plataforma: creación de sesiones, calendario, grupos, Asistente Planner, etc.",
    icon: Settings2,
  },
  {
    title: "Marca y Landing",
    description:
      "Personaliza el nombre y la identidad visual de la app, y edita el contenido de la página pública.",
    icon: Palette,
  },
];

const clubSteps: Step[] = [
  {
    title: "Entiende el modelo",
    description:
      "No es un marketplace: tu club aporta ejercicios y clases validados de forma gratuita a la biblioteca pública, y a cambio obtiene visibilidad de marca. Ten Planner no gestiona cobros entre club y plataforma.",
    icon: Sparkles,
  },
  {
    title: "Crea o gestiona tu club",
    description:
      "Desde Mi club puedes dar de alta tu club e invitar por email a los monitores que forman parte de él.",
    icon: Users2,
  },
  {
    title: "Comparte sin perder tu panel",
    description:
      "Cuando un monitor acepta la invitación, el club tiene acceso compartido a sus sesiones, alumnos, grupos y calendario de ese deporte — cada monitor conserva su propio panel individual.",
    icon: ClipboardList,
  },
  {
    title: "El contenido queda identificado",
    description:
      "Lo que aportéis a la biblioteca se etiqueta con la autoría del club, para que se vea de dónde viene ese ejercicio o clase.",
    icon: Dumbbell,
  },
];

const coachSections: Section[] = [
  {
    title: "Primeros pasos",
    icon: Sparkles,
    open: true,
    items: [
      "Al entrar eliges tu deporte activo (tenis, pádel o pickleball) en la parte superior de la app. Puedes cambiarlo cuando quieras; cada deporte tiene su propia biblioteca, sesiones y calendario, aunque comparten el mismo tipo de contenido.",
      "El Dashboard (Inicio) te resume tus próximas sesiones y accesos directos a lo que más usas.",
    ],
  },
  {
    title: "Biblioteca: ejercicios y clases",
    icon: Dumbbell,
    items: [
      "Ejercicios tiene cuatro vistas: Biblioteca (todo lo disponible — tuyo, de Ten Planner o de tu club), Mis ejercicios (solo los tuyos), Favoritos y Borradores. Desde ahí también creas un ejercicio nuevo.",
      "Clases sigue la misma estructura: Biblioteca, Mis clases, Listas (clases guardadas para reutilizar) y Borradores. Una clase agrupa varios ejercicios ya organizados en bloques.",
      "Puedes buscar y filtrar por nivel, golpe, fase, duración y objetivo para encontrar lo que necesitas rápido.",
    ],
  },
  {
    title: "Alumnos y grupos",
    icon: Users,
    items: [
      "En Alumnos das de alta la ficha de cada uno: asistencia, notas y progreso quedan guardados para que la siguiente sesión arranque con contexto.",
      "En Grupos agrupas a los alumnos que entrenan juntos para asignarlos de una vez a una sesión, en lugar de seleccionarlos uno a uno cada vez.",
      "Los grupos son editables después de creados: puedes añadir o quitar alumnos cuando cambie la composición.",
    ],
  },
  {
    title: "Crear una sesión: los 3 métodos",
    icon: ClipboardList,
    items: [
      "Desde cero: el asistente de nueva sesión tiene 2 pasos — Configuración (título, fecha y hora, duración, objetivo/material/observaciones, a qué alumnos o grupo va dirigida, y si se repite) y Ejercicios (construyes el plan arrastrando ejercicios de tu biblioteca o añadiendo texto libre, organizado por bloques y fases: calentamiento, técnica, táctica, fitness, estaciones o descanso).",
      "A partir de una clase: eliges una clase ya montada en tu biblioteca como punto de partida y la ajustas para ese día y ese grupo.",
      "Sesión rápida: crea una sesión mínima con solo el título, para completarla con calma más tarde.",
      "El nombre puede generarse solo con el código fecha + grupo (AAMMDD_Grupo, p. ej. 260930_Galácticas) o escribirlo tú a mano; en cuanto lo editas manualmente, deja de actualizarse automático.",
    ],
  },
  {
    title: "Sesiones recurrentes",
    icon: CalendarDays,
    items: [
      "Dentro del paso de Configuración puedes activar la repetición: eliges los días de la semana en que se repite y hasta cuándo — una fecha concreta o un número de semanas.",
      "Por defecto, el fin de curso sugerido es el 30 de junio. Se generan todas las sesiones de golpe (hasta 120 de una vez).",
    ],
  },
  {
    title: "Durante y después del entrenamiento",
    icon: Dumbbell,
    items: [
      "Modo Ejecutar: abre la sesión en pista con un cronómetro (o cuenta atrás) que te guía bloque a bloque y fase a fase.",
      "En Sesiones puedes filtrar entre Próximas, Pasadas, Canceladas y Borradores.",
      "Listas te deja guardar sesiones como plantillas para repetirlas sin volver a montarlas.",
      "Puedes cancelar una sesión sin eliminarla, para que quede constancia de que no se dio.",
    ],
  },
  {
    title: "Calendario y Lugares",
    icon: MapPin,
    items: [
      "El Calendario te muestra todas tus sesiones programadas de un vistazo.",
      "En Lugares guardas las pistas o instalaciones donde entrenas habitualmente; cada lugar muestra cuántas sesiones y minutos has dado allí.",
    ],
  },
  {
    title: "Mis recursos",
    icon: FileText,
    items: [
      "Guarda enlaces, documentos e imágenes que te sirven para tu trabajo como monitor, organizados en Todos y Favoritos.",
    ],
  },
  {
    title: "Asistente Planner",
    icon: Bot,
    items: [
      "Es un chat aparte del flujo normal de planificación — no sustituye a los tres métodos de crear sesión, sino que es un apoyo puntual: pídele ayuda para redactar algo, resolver una duda o darte ideas.",
    ],
  },
  {
    title: "Mi club y Perfil",
    icon: Users2,
    items: [
      "Si formas parte de un club, en Mi club ves a cuál perteneces. Si tú lo creaste, desde ahí gestionas las invitaciones a otros monitores.",
      "En Perfil editas tus datos personales y tu foto.",
    ],
  },
];

const adminSections: Section[] = [
  {
    title: "Entrar al Panel de administración",
    icon: ShieldCheck,
    open: true,
    items: [
      "Solo aparece si tu cuenta tiene permisos de administrador: un botón al pie del menú lateral te lleva a /admin.",
    ],
  },
  {
    title: "Métricas",
    icon: LayoutDashboard,
    items: [
      "Panel inicial del admin con los indicadores generales de uso de la plataforma.",
    ],
  },
  {
    title: "IA (Operaciones IA)",
    icon: Brain,
    items: [
      "Gasto estimado, número de usuarios que usan funciones de IA y peticiones realizadas — te permite controlar el coste del Asistente Planner y otras funciones de IA.",
    ],
  },
  {
    title: "Chats",
    icon: MessageSquare,
    items: [
      "Estadísticas de uso de los chats: chats totales, mensajes totales y usuarios activos.",
    ],
  },
  {
    title: "Usuarios",
    icon: Users,
    items: ["Altas, roles y permisos de las cuentas de la plataforma."],
  },
  {
    title: "Contenido",
    icon: FileText,
    items: [
      "Revisión y moderación de los ejercicios y clases de la biblioteca pública, incluido el contenido aportado por clubs patrocinadores.",
    ],
  },
  {
    title: "Embeddings (Búsqueda semántica)",
    icon: Sparkles,
    items: [
      "Gestiona el índice que permite buscar contenido por significado y no solo por coincidencia exacta de palabras; alimenta la búsqueda y el Asistente Planner.",
    ],
  },
  {
    title: "Landing y Marca",
    icon: Palette,
    items: [
      "Landing: editor de la página pública tenplanner.com.",
      "Marca: nombre de la app e identidad visual que ven todos los usuarios.",
    ],
  },
  {
    title: "Herramientas",
    icon: Wrench,
    items: [
      "Utilidades de mantenimiento: purgar eventos de IA antiguos, purgar borradores inactivos, eliminar chats vacíos, activar sesiones favoritas en bloque y exportar usuarios.",
    ],
  },
  {
    title: "Ajustes de plataforma",
    icon: Settings2,
    items: [
      "Activa o desactiva funciones para todos los usuarios: creación de sesiones, calendario, grupos, creación de ejercicios, Asistente Planner, biblioteca pública de ejercicios, entre otras — además del aviso de mantenimiento que ven todos.",
    ],
  },
  {
    title: "Incidencias",
    icon: ClipboardList,
    items: [
      "Revisa las incidencias que reportan los usuarios de la plataforma.",
    ],
  },
];

const clubSections: Section[] = [
  {
    title: "El modelo de patrocinio",
    icon: Sparkles,
    open: true,
    items: [
      "No es un marketplace: el club aporta ejercicios y clases validados de forma gratuita a la biblioteca pública.",
      "A cambio obtiene visibilidad de marca (enlace o mención), no un pago gestionado por Ten Planner — la plataforma no intermedia cobros entre el club y nadie más.",
    ],
  },
  {
    title: "Crear o gestionar tu club",
    icon: Users2,
    items: [
      "Desde Mi club das de alta tu club si todavía no perteneces a uno.",
      "Una vez creado, invitas por email a los monitores que forman parte de él.",
    ],
  },
  {
    title: "Compartir sin perder el panel individual",
    icon: ClipboardList,
    items: [
      "Cuando un monitor acepta la invitación, el club obtiene acceso compartido a sus sesiones, alumnos, grupos y calendario de ese deporte.",
      "Cada monitor conserva su propio panel individual — nadie pierde su espacio de trabajo personal por formar parte del club.",
    ],
  },
  {
    title: "Autoría del contenido",
    icon: Dumbbell,
    items: [
      "Lo que aportéis a la biblioteca pública queda etiquetado con la autoría del club, para que se identifique de dónde viene cada ejercicio o clase.",
    ],
  },
  {
    title: "Multideporte",
    icon: Sparkles,
    items: [
      "Si el club trabaja varios deportes (tenis, pádel, pickleball), cada uno se gestiona con su propio contenido y calendario dentro del mismo club.",
    ],
  },
  {
    title: "Más visibilidad",
    icon: Palette,
    items: [
      "Para aparecer en la landing pública o personalizar la marca, habla con el equipo de administración de Ten Planner.",
    ],
  },
];

export function HelpGuide({
  defaultTab,
  defaultLevel = "quick",
}: {
  defaultTab: string;
  defaultLevel?: "quick" | "full";
}) {
  const [tab, setTab] = useState(defaultTab);
  const [level, setLevel] = useState<"quick" | "full">(defaultLevel);

  const stepsByTab: Record<string, Step[]> = {
    coach: coachSteps,
    admin: adminSteps,
    club: clubSteps,
  };
  const sectionsByTab: Record<string, Section[]> = {
    coach: coachSections,
    admin: adminSections,
    club: clubSections,
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-foreground/12 bg-card/90 p-1">
        <button
          type="button"
          onClick={() => setLevel("quick")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
            level === "quick"
              ? "bg-brand text-brand-foreground"
              : "text-foreground/60 hover:text-foreground"
          )}
        >
          Guía rápida
        </button>
        <button
          type="button"
          onClick={() => setLevel("full")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
            level === "full"
              ? "bg-brand text-brand-foreground"
              : "text-foreground/60 hover:text-foreground"
          )}
        >
          Guía completa
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="items-start">
        <TabsList className="rounded-lg border border-foreground/12 bg-card/90">
          <TabsTrigger value="coach">Monitores</TabsTrigger>
          <TabsTrigger value="admin">Administradores</TabsTrigger>
          <TabsTrigger value="club">Clubs patrocinadores</TabsTrigger>
        </TabsList>

        {(["coach", "admin", "club"] as const).map((key) => (
          <TabsContent key={key} value={key} className="mt-4 w-full">
            {level === "quick" ? (
              <StepList steps={stepsByTab[key]} />
            ) : (
              <SectionList sections={sectionsByTab[key]} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
