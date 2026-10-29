"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  User,
  Ruler,
  Mail,
  Trophy,
  FileText,
  ImageIcon,
  Phone,
  Clock,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Gender = "male" | "female" | "other";
type DominantHand = "left" | "right";
type PlayerLevel =
  | "beginner"
  | "amateur"
  | "intermediate"
  | "advanced"
  | "competitive"
  | "descubrimiento"
  | "desarrollo"
  | "consolidacion"
  | "especializacion"
  | "precompeticion"
  | "competicion"
  | "adultos_iniciacion"
  | "adultos_medio_alto";

const formSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(255),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255)
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  heightCm: z
    .union([z.coerce.number().int().min(50).max(250), z.literal("")])
    .optional()
    .nullable(),
  weightKg: z
    .union([z.coerce.number().int().min(20).max(250), z.literal("")])
    .optional()
    .nullable(),
  dominantHand: z.enum(["left", "right"]).optional().nullable(),
  playerLevel: z
    .enum([
      "beginner",
      "amateur",
      "intermediate",
      "advanced",
      "competitive",
      "descubrimiento",
      "desarrollo",
      "consolidacion",
      "especializacion",
      "precompeticion",
      "competicion",
      "adultos_iniciacion",
      "adultos_medio_alto",
    ])
    .optional()
    .nullable(),
  yearsExperience: z
    .union([z.coerce.number().int().min(0).max(80), z.literal("")])
    .optional()
    .nullable(),
  yearStartedTennis: z
    .union([z.coerce.number().int().min(1900).max(2100), z.literal("")])
    .optional()
    .nullable(),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  preferredSchedule: z.string().trim().max(500).optional().nullable(),
  locality: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const GENDERS: { id: Gender; label: string }[] = [
  { id: "male", label: "Masculino" },
  { id: "female", label: "Femenino" },
  { id: "other", label: "Otro" },
];

const HANDS: { id: DominantHand; label: string }[] = [
  { id: "right", label: "Diestro" },
  { id: "left", label: "Zurdo" },
];

const LEVELS: { id: PlayerLevel; label: string; desc: string }[] = [
  { id: "descubrimiento", label: "Descubrimiento", desc: "4-6 años" },
  { id: "desarrollo", label: "Desarrollo", desc: "6-8 años" },
  { id: "consolidacion", label: "Consolidación", desc: "8-10 años" },
  { id: "especializacion", label: "Especialización", desc: "10-12 años" },
  { id: "precompeticion", label: "Precompetición", desc: "12-14 años" },
  { id: "competicion", label: "Competición", desc: "14-18 años" },
];

// Niveles legacy que pueden venir en datos antiguos. Se muestran si están
// activos pero no se ofrecen como nueva selección.
const LEGACY_LEVEL_LABELS: Record<string, string> = {
  beginner: "Principiante (legacy)",
  amateur: "Amateur (legacy)",
  intermediate: "Intermedio (legacy)",
  advanced: "Avanzado (legacy)",
  competitive: "Competitivo (legacy)",
  adultos_iniciacion: "Adultos iniciación (legacy)",
  adultos_medio_alto: "Adultos medio-alto (legacy)",
};

export interface StudentFormProps {
  mode: "create" | "edit";
  studentId?: string;
  initialData?: {
    name?: string;
    email?: string | null;
    gender?: Gender | null;
    birthDate?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    dominantHand?: DominantHand | null;
    playerLevel?: PlayerLevel | null;
    yearsExperience?: number | null;
    yearStartedTennis?: number | null;
    yearStartedRacketSports?: number | null;
    phone?: string | null;
    preferredSchedule?: string | null;
    locality?: string | null;
    notes?: string | null;
    imageUrl?: string | null;
  };
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3 border-b border-foreground/10 pb-4">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#D6FF38]/40 bg-[#D6FF38]/12 text-[#D6FF38]">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function StudentForm({
  mode,
  studentId,
  initialData,
}: StudentFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      email: initialData?.email ?? "",
      gender: initialData?.gender ?? null,
      birthDate: initialData?.birthDate ?? "",
      heightCm: initialData?.heightCm ?? "",
      weightKg: initialData?.weightKg ?? "",
      dominantHand: initialData?.dominantHand ?? null,
      playerLevel: initialData?.playerLevel ?? null,
      yearsExperience: initialData?.yearsExperience ?? "",
      yearStartedTennis:
        initialData?.yearStartedRacketSports ??
        initialData?.yearStartedTennis ??
        "",
      phone: initialData?.phone ?? "",
      preferredSchedule: initialData?.preferredSchedule ?? "",
      locality: initialData?.locality ?? "",
      notes: initialData?.notes ?? "",
      imageUrl: initialData?.imageUrl ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const url =
      mode === "create" ? "/api/students" : `/api/students/${studentId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const payload = {
      name: values.name.trim(),
      email: values.email ? values.email : null,
      gender: values.gender ?? null,
      birthDate: values.birthDate || null,
      heightCm:
        values.heightCm === "" || values.heightCm == null
          ? null
          : Number(values.heightCm),
      weightKg:
        values.weightKg === "" || values.weightKg == null
          ? null
          : Number(values.weightKg),
      dominantHand: values.dominantHand ?? null,
      playerLevel: values.playerLevel ?? null,
      yearsExperience:
        values.yearsExperience === "" || values.yearsExperience == null
          ? null
          : Number(values.yearsExperience),
      yearStartedRacketSports:
        values.yearStartedTennis === "" || values.yearStartedTennis == null
          ? null
          : Number(values.yearStartedTennis),
      yearStartedTennis:
        values.yearStartedTennis === "" || values.yearStartedTennis == null
          ? null
          : Number(values.yearStartedTennis),
      phone: values.phone?.trim() || null,
      preferredSchedule: values.preferredSchedule?.trim() || null,
      locality: values.locality?.trim() || null,
      notes: values.notes?.trim() || null,
      imageUrl: values.imageUrl?.trim() || null,
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(
        data.details?.map((d: { message: string }) => d.message).join(". ") ??
          data.error ??
          "Ha ocurrido un error."
      );
      return;
    }

    const data = await res.json();
    if (mode === "create") {
      router.push(`/students/${data.data.id}`);
      router.refresh();
    } else {
      router.push(`/students/${studentId}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <section className="rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
        <SectionHeader
          icon={User}
          title="Datos personales"
          subtitle="Información básica del alumno"
        />
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-foreground"
            >
              Nombre completo
            </label>
            <input
              id="name"
              type="text"
              placeholder="Ej: Carmen García"
              autoComplete="off"
              aria-invalid={!!errors.name}
              {...register("name")}
              className="h-11 w-full rounded-lg border border-foreground/15 bg-background/70 px-4 text-sm font-medium text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-foreground"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" /> Email
                </span>
                <span className="font-normal text-muted-foreground ml-1">
                  (opcional)
                </span>
              </label>
              <input
                id="email"
                type="email"
                placeholder="alumno@email.com"
                {...register("email")}
                className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-foreground"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" /> Teléfono
                </span>
                <span className="font-normal text-muted-foreground ml-1">
                  (opcional)
                </span>
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="+34 600 00 00 00"
                {...register("phone")}
                className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
              />
              {errors.phone && (
                <p className="text-xs text-destructive">
                  {errors.phone.message as string}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="birthDate"
                className="block text-sm font-semibold text-foreground"
              >
                Fecha de nacimiento{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <input
                id="birthDate"
                type="date"
                {...register("birthDate")}
                className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
              />
              {errors.birthDate && (
                <p className="text-xs text-destructive">
                  {errors.birthDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Género{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map(({ id, label }) => {
                    const isSelected = field.value === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => field.onChange(isSelected ? null : id)}
                        className={cn(
                          "rounded-full border px-3 py-2.5 text-sm font-medium transition-all duration-150",
                          isSelected
                            ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                            : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
        <SectionHeader
          icon={Ruler}
          title="Datos físicos"
          subtitle="Altura, peso y mano dominante"
        />
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="heightCm"
                className="block text-sm font-semibold text-foreground"
              >
                Altura{" "}
                <span className="font-normal text-muted-foreground">(cm)</span>
              </label>
              <input
                id="heightCm"
                type="number"
                min={50}
                max={250}
                placeholder="175"
                {...register("heightCm")}
                className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
              />
              {errors.heightCm && (
                <p className="text-xs text-destructive">
                  {errors.heightCm.message as string}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="weightKg"
                className="block text-sm font-semibold text-foreground"
              >
                Peso{" "}
                <span className="font-normal text-muted-foreground">(kg)</span>
              </label>
              <input
                id="weightKg"
                type="number"
                min={20}
                max={250}
                placeholder="70"
                {...register("weightKg")}
                className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
              />
              {errors.weightKg && (
                <p className="text-xs text-destructive">
                  {errors.weightKg.message as string}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Mano dominante{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <Controller
              name="dominantHand"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {HANDS.map(({ id, label }) => {
                    const isSelected = field.value === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => field.onChange(isSelected ? null : id)}
                        className={cn(
                          "rounded-full border px-3 py-2.5 text-sm font-medium transition-all duration-150",
                          isSelected
                            ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                            : "border-foreground/15 text-muted-foreground hover:border-foreground/30 hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
        <SectionHeader
          icon={Trophy}
          title="Nivel de juego"
          subtitle="Experiencia y nivel del jugador"
        />
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
              Nivel{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <Controller
              name="playerLevel"
              control={control}
              render={({ field }) => {
                const isLegacy =
                  field.value && field.value in LEGACY_LEVEL_LABELS;
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {LEVELS.map(({ id, label, desc }) => {
                        const isSelected = field.value === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() =>
                              field.onChange(isSelected ? null : id)
                            }
                            className={cn(
                              "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
                              isSelected
                                ? "border-[#D6FF38] bg-[#D6FF38]/12"
                                : "border-foreground/15 hover:border-foreground/30 hover:bg-muted"
                            )}
                          >
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                isSelected
                                  ? "text-foreground"
                                  : "text-foreground"
                              )}
                            >
                              {label}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {isLegacy && (
                      <p className="text-[11px] text-muted-foreground">
                        Nivel actual:{" "}
                        <span className="font-medium">
                          {LEGACY_LEVEL_LABELS[field.value as string]}
                        </span>
                        . Selecciona uno nuevo para sustituirlo.
                      </p>
                    )}
                  </div>
                );
              }}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="yearsExperience"
                className="block text-sm font-semibold text-foreground"
              >
                Años de experiencia{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <input
                id="yearsExperience"
                type="number"
                min={0}
                max={80}
                placeholder="3"
                {...register("yearsExperience")}
                className="h-10 w-28 rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
              />
              {errors.yearsExperience && (
                <p className="text-xs text-destructive">
                  {errors.yearsExperience.message as string}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="yearStartedTennis"
                className="block text-sm font-semibold text-foreground"
              >
                Año de inicio en deportes de raqueta{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <input
                id="yearStartedTennis"
                type="number"
                min={1900}
                max={2100}
                placeholder="2018"
                {...register("yearStartedTennis")}
                className="h-10 w-32 rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
              />
              {errors.yearStartedTennis && (
                <p className="text-xs text-destructive">
                  {errors.yearStartedTennis.message as string}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="preferredSchedule"
              className="block text-sm font-semibold text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> Horario preferente
              </span>
              <span className="font-normal text-muted-foreground ml-1">
                (opcional)
              </span>
            </label>
            <input
              id="preferredSchedule"
              type="text"
              maxLength={500}
              placeholder="Ej: Martes y jueves por la tarde"
              {...register("preferredSchedule")}
              className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
            {errors.preferredSchedule && (
              <p className="text-xs text-destructive">
                {errors.preferredSchedule.message as string}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="locality"
              className="block text-sm font-semibold text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> Localidad
              </span>
              <span className="font-normal text-muted-foreground ml-1">
                (opcional · para el mapa de procedencia del club)
              </span>
            </label>
            <input
              id="locality"
              type="text"
              maxLength={120}
              placeholder="Ej: Santa Cruz de Tenerife"
              {...register("locality")}
              className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
            {errors.locality && (
              <p className="text-xs text-destructive">
                {errors.locality.message as string}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-foreground/10 bg-card p-4 shadow-sm shadow-black/5 sm:p-5">
        <SectionHeader
          icon={FileText}
          title="Notas y foto"
          subtitle="Información adicional"
        />
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="imageUrl"
              className="block text-sm font-semibold text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="size-3.5" /> URL de foto
              </span>
              <span className="font-normal text-muted-foreground ml-1">
                (opcional)
              </span>
            </label>
            <input
              id="imageUrl"
              type="url"
              placeholder="https://..."
              {...register("imageUrl")}
              className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="notes"
              className="block text-sm font-semibold text-foreground"
            >
              Notas{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            <textarea
              id="notes"
              rows={4}
              maxLength={2000}
              placeholder="Objetivos, lesiones, disponibilidad, fortalezas, áreas a mejorar…"
              {...register("notes")}
              className="w-full resize-none rounded-lg border border-foreground/15 bg-background/70 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20"
            />
          </div>
        </div>
      </section>

      {serverError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{serverError}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-6 py-2.5 text-sm font-bold text-[#050505] transition-all duration-150 hover:bg-[#c8f52e] active:scale-95 disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {mode === "create" ? "Crear alumno" : "Guardar cambios"}
        </button>
        <Link
          href={mode === "create" ? "/students" : `/students/${studentId}`}
          className="rounded-full px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
