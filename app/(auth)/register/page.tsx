"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  User,
  UserRound,
  Users,
} from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type AccountType = "club" | "monitor" | "familia" | "jugador";
/** Cuentas que no trabajan en Ten Planner: ven el panel de familias. */
type FamilyKind = "familia" | "jugador";
type Step = "choice" | "form";

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe tu nombre"),
    email: z.string().trim().email("Email no válido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
    isClub: z.boolean(),
    isPlayer: z.boolean(),
    confirmAdult: z.boolean(),
    clubName: z.string().trim().optional(),
    clubSeats: z.string().optional(),
    accepted: z
      .boolean()
      .refine(Boolean, "Debes aceptar las condiciones para crear la cuenta"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  })
  .refine((data) => !data.isClub || (data.clubName?.length ?? 0) >= 2, {
    path: ["clubName"],
    message: "Escribe el nombre del club",
  })
  .refine((data) => !data.isPlayer || data.confirmAdult, {
    path: ["confirmAdult"],
    message:
      "Si eres menor de edad, la cuenta la crea tu madre, padre o tutor como familia",
  });

type RegisterForm = z.infer<typeof registerSchema>;

const initialForm: RegisterForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  isClub: false,
  isPlayer: false,
  confirmAdult: false,
  clubName: "",
  clubSeats: "",
  accepted: false,
};

function isAlreadyRegisteredMessage(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("already registered") || lower.includes("already exists")
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choice");
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(
    null
  );
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  // Familia o jugador: cuenta sencilla, sin elegir monitor/club. Llega desde
  // una invitación (/familia/<token>) o la elige el propio usuario aquí.
  const [familyKind, setFamilyKind] = useState<FamilyKind | null>(null);
  const isFamily = familyKind !== null;
  // El tipo viene ya decidido en el enlace: no se ofrece cambiarlo.
  const [typeLocked, setTypeLocked] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);

  // Un enlace de invitación de club lleva a un monitor directamente a
  // /register?type=monitor: nos saltamos la pantalla de elección porque su
  // tipo de cuenta ya está decidido.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const next = params.get("next");
    if (
      next &&
      next.startsWith("/") &&
      !next.startsWith("//") &&
      !next.startsWith("/\\")
    ) {
      setNextPath(next);
    }
    if (
      type === "club" ||
      type === "monitor" ||
      type === "familia" ||
      type === "jugador"
    ) {
      if (type === "familia" || type === "jugador") setTypeLocked(true);
      selectAccountType(type);
    }
  }, []);

  function selectAccountType(type: AccountType) {
    const kind: FamilyKind | null =
      type === "familia" || type === "jugador" ? type : null;
    setFamilyKind(kind);
    setForm((prev) => ({
      ...prev,
      isClub: type === "club",
      isPlayer: type === "jugador",
      confirmAdult: false,
    }));
    setError(null);
    setStep("form");
  }

  function update<K extends keyof RegisterForm>(
    key: K,
    value: RegisterForm[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setExistingEmailError() {
    setFieldErrors((prev) => ({
      ...prev,
      email:
        "Ya existe una cuenta con este correo. Entra o recupera la contraseña.",
    }));
    setError("Ese email ya está registrado en TenPlanner.");
  }

  async function resendConfirmation() {
    if (!confirmationEmail) return;
    setResending(true);
    setResendSent(false);
    setResendError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setResendError(
        "No se pudo reenviar el correo. Prueba de nuevo en unos minutos."
      );
    } else {
      setResendSent(true);
    }
    setResending(false);
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    // Una cuenta de familia/jugador lleva su tipo y su destino al callback.
    const callback = new URL(`${window.location.origin}/auth/callback`);
    if (familyKind) {
      callback.searchParams.set("account_type", familyKind);
      callback.searchParams.set("next", nextPath ?? "/mi-familia/calendario");
    } else if (nextPath) {
      callback.searchParams.set("next", nextPath);
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setConfirmationEmail(null);
    setResendSent(false);
    setResendError(null);

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0] ?? "form"),
            issue.message,
          ])
        )
      );
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: parsed.data.name,
            role: "coach",
            ...(familyKind ? { account_type: familyKind } : {}),
            ...(parsed.data.isClub && parsed.data.clubName
              ? {
                  club_name: parsed.data.clubName,
                  club_seats: parsed.data.clubSeats || null,
                }
              : {}),
          },
        },
      });

      if (signUpError) {
        if (isAlreadyRegisteredMessage(signUpError.message)) {
          setExistingEmailError();
        } else {
          setError(signUpError.message);
        }
        return;
      }

      const identities = data.user?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        setExistingEmailError();
        return;
      }

      if (data.user && data.session?.access_token && data.user.email) {
        await fetch("/api/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({
            id: data.user.id,
            name: parsed.data.name,
            email: data.user.email,
            role: "coach",
          }),
        });

        if (parsed.data.isClub && parsed.data.clubName) {
          await fetch("/api/clubs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({
              name: parsed.data.clubName,
              plannedCoachSeats: parsed.data.clubSeats
                ? Number(parsed.data.clubSeats)
                : null,
            }),
          });
        }

        router.push(
          nextPath ??
            (familyKind
              ? "/mi-familia/calendario"
              : parsed.data.isClub
                ? "/club"
                : "/dashboard")
        );
        router.refresh();
        return;
      }

      setConfirmationEmail(email);
      setForm((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationEmail) {
    return (
      <div className="w-full rounded-[32px] border border-[#050505]/10 bg-white p-5 text-center shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e] sm:p-7">
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <p className="tp-kicker">Cuenta creada</p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-foreground">
                Confirma tu correo
              </h1>
              <p className="mt-3 text-sm leading-6 text-foreground/62">
                Hemos enviado un enlace de verificación a{" "}
                <span className="break-all font-black text-foreground">
                  {confirmationEmail}
                </span>
                . Cuando lo confirmes podrás iniciar sesión.
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-brand/30 bg-brand/10 px-5 py-4 text-left">
            <p className="text-xs font-black uppercase text-foreground">
              Si no aparece
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Revisa spam o promociones.</li>
              <li>Comprueba que el email está bien escrito.</li>
              <li>Puedes reenviar el enlace desde aquí.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resending}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-foreground/10 px-4 text-sm font-black text-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {resending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Reenviar correo
            </button>
            <Link
              href={`/login?message=check_email&email=${encodeURIComponent(
                confirmationEmail
              )}`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand px-4 text-sm font-black text-brand-foreground transition-colors hover:bg-brand/90"
            >
              Ir al login
            </Link>
          </div>

          {resendSent && (
            <p className="text-xs font-bold text-foreground/70">
              Correo reenviado.
            </p>
          )}
          {resendError && (
            <p className="text-xs text-destructive">{resendError}</p>
          )}
        </div>
      </div>
    );
  }

  if (step === "choice") {
    return (
      <div className="w-full rounded-[32px] border border-[#050505]/10 bg-white p-5 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e] sm:p-7">
        <div>
          <p className="tp-kicker">Acceso anticipado</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-foreground">
            ¿Cómo quieres usar Ten Planner?
          </h1>
          <p className="mt-2 text-sm leading-6 text-foreground/62">
            Elige el tipo de cuenta. Podrás cambiarlo más adelante si hace
            falta.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => selectAccountType("club")}
            className="flex flex-col items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] p-5 text-left transition-colors hover:border-brand dark:border-white/10 dark:bg-white/[0.04]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Building2 className="size-5" />
            </span>
            <span>
              <span className="block text-base font-black text-foreground">
                Como Club
              </span>
              <span className="mt-1 block text-sm leading-5 text-foreground/62">
                Diriges una escuela o academia y quieres invitar a tus
                monitores.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectAccountType("monitor")}
            className="flex flex-col items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] p-5 text-left transition-colors hover:border-brand dark:border-white/10 dark:bg-white/[0.04]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
              <User className="size-5" />
            </span>
            <span>
              <span className="block text-base font-black text-foreground">
                Como Monitor
              </span>
              <span className="mt-1 block text-sm leading-5 text-foreground/62">
                Planificas tus propias sesiones, con o sin un club detrás.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectAccountType("familia")}
            className="flex flex-col items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] p-5 text-left transition-colors hover:border-brand dark:border-white/10 dark:bg-white/[0.04]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Users className="size-5" />
            </span>
            <span>
              <span className="block text-base font-black text-foreground">
                Como Familia
              </span>
              <span className="mt-1 block text-sm leading-5 text-foreground/62">
                Eres madre, padre o tutor de un jugador y quieres ver su
                calendario, sus clases y los mensajes del club.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => selectAccountType("jugador")}
            className="flex flex-col items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] p-5 text-left transition-colors hover:border-brand dark:border-white/10 dark:bg-white/[0.04]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
              <UserRound className="size-5" />
            </span>
            <span>
              <span className="block text-base font-black text-foreground">
                Como Jugador
              </span>
              <span className="mt-1 block text-sm leading-5 text-foreground/62">
                Eres mayor de edad y juegas en un club: consulta tus clases, tu
                asistencia y los mensajes.
              </span>
            </span>
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-brand">
            Entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[32px] border border-[#050505]/10 bg-white p-5 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e] sm:p-7">
      {!typeLocked && (
        <button
          type="button"
          onClick={() => setStep("choice")}
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-foreground/50 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Cambiar tipo de cuenta
        </button>
      )}

      <div>
        <p className="tp-kicker">
          {isFamily ? "Mensajes del club" : "Acceso anticipado"}
        </p>
        <h1 className="mt-3 text-3xl font-black leading-tight text-foreground">
          {familyKind === "familia"
            ? "Crear cuenta de familia"
            : familyKind === "jugador"
              ? "Crear cuenta de jugador"
              : form.isClub
                ? "Crear cuenta de club"
                : "Crear cuenta de monitor"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-foreground/62">
          {isFamily
            ? `${
                familyKind === "jugador"
                  ? "Para consultar tus clases, tu asistencia y los mensajes del club."
                  : "Para seguir el calendario, las clases y los mensajes del club."
              } El club te enviará un enlace de invitación para vincular ${
                familyKind === "jugador" ? "tu ficha" : "a tu jugador"
              }; si te pedimos confirmar el email, después vuelve a abrir ese enlace.`
            : form.isClub
              ? "Registra tu escuela o academia. Después podrás invitar a tus monitores por email."
              : "Alta mínima para empezar a ordenar sesiones, alumnos y biblioteca."}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-full"
          onClick={signInWithGoogle}
        >
          <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar con Google
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">o</span>
          <Separator className="flex-1" />
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {form.isClub && (
          <div className="grid gap-4 rounded-[22px] border border-brand/30 bg-brand/5 p-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="clubName">Nombre del club</Label>
              <Input
                id="clubName"
                value={form.clubName}
                onChange={(e) => update("clubName", e.target.value)}
                aria-invalid={!!fieldErrors.clubName}
              />
              {fieldErrors.clubName && (
                <p className="text-xs text-destructive">
                  {fieldErrors.clubName}
                </p>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="clubSeats">
                Monitores previstos{" "}
                <span className="font-normal text-foreground/50">
                  (opcional, solo informativo)
                </span>
              </Label>
              <Input
                id="clubSeats"
                type="number"
                min={0}
                value={form.clubSeats}
                onChange={(e) => update("clubSeats", e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">
            {form.isClub ? "Nombre y apellidos del responsable" : "Nombre"}
          </Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            autoComplete="name"
            aria-invalid={!!fieldErrors.name}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              autoComplete="new-password"
              className="pr-10"
              aria-invalid={!!fieldErrors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={
                showPassword ? "Ocultar contraseña" : "Ver contraseña"
              }
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p className="text-xs text-destructive">{fieldErrors.password}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={form.confirmPassword}
            onChange={(e) => update("confirmPassword", e.target.value)}
            autoComplete="new-password"
            aria-invalid={!!fieldErrors.confirmPassword}
          />
          {fieldErrors.confirmPassword && (
            <p className="text-xs text-destructive">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {form.isPlayer && (
          <>
            <label className="flex items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] p-3 text-sm text-foreground/62 dark:border-white/10 dark:bg-white/[0.04]">
              <input
                type="checkbox"
                checked={form.confirmAdult}
                onChange={(e) => update("confirmAdult", e.target.checked)}
                className="mt-1"
              />
              <span>
                Confirmo que tengo 18 años o más. Si eres menor, la cuenta la
                crea tu madre, padre o tutor como familia.
              </span>
            </label>
            {fieldErrors.confirmAdult && (
              <p className="text-xs text-destructive">
                {fieldErrors.confirmAdult}
              </p>
            )}
          </>
        )}

        <label className="flex items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] p-3 text-sm text-foreground/62 dark:border-white/10 dark:bg-white/[0.04]">
          <input
            type="checkbox"
            checked={form.accepted}
            onChange={(e) => update("accepted", e.target.checked)}
            className="mt-1"
          />
          <span>
            Acepto la{" "}
            <Link href="/privacidad" className="font-semibold text-brand">
              privacidad
            </Link>{" "}
            y los{" "}
            <Link href="/terminos" className="font-semibold text-brand">
              términos
            </Link>
            .
          </span>
        </label>
        {fieldErrors.accepted && (
          <p className="text-xs text-destructive">{fieldErrors.accepted}</p>
        )}

        {error && (
          <div className="rounded-[22px] border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-full font-black"
        >
          {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Crear cuenta
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-brand">
          Entrar
        </Link>
      </p>
    </div>
  );
}
