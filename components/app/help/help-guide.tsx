"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  Heart,
  LayoutDashboard,
  MapPin,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Users2,
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
      "Las sesiones que más repites puedes guardarlas en Favoritas, dentro del menú de Sesiones, para no volver a montarlas desde cero.",
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

export function HelpGuide({ defaultTab }: { defaultTab: string }) {
  const [tab, setTab] = useState(defaultTab);

  return (
    <Tabs value={tab} onValueChange={setTab} className="items-start">
      <TabsList className="rounded-lg border border-foreground/12 bg-card/90">
        <TabsTrigger value="coach">Monitores</TabsTrigger>
        <TabsTrigger value="admin">Administradores</TabsTrigger>
        <TabsTrigger value="club">Clubs patrocinadores</TabsTrigger>
      </TabsList>

      <TabsContent value="coach" className={cn("mt-4 w-full")}>
        <StepList steps={coachSteps} />
      </TabsContent>
      <TabsContent value="admin" className="mt-4 w-full">
        <StepList steps={adminSteps} />
      </TabsContent>
      <TabsContent value="club" className="mt-4 w-full">
        <StepList steps={clubSteps} />
      </TabsContent>
    </Tabs>
  );
}
