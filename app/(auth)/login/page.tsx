"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const loginSchema = z.object({
  email: z.string().trim().email("Introduce un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

type LoginValues = z.infer<typeof loginSchema>;

const GENERIC_LOGIN_ERROR =
  "No hay una cuenta confirmada con ese correo o la contraseña no es correcta.";

const CALLBACK_ERRORS: Record<string, string> = {
  missing_email:
    "No hemos podido leer el email de tu proveedor. Prueba con otro método de acceso.",
  auth_callback_failed:
    "No hemos podido completar la verificación. Vuelve a intentarlo desde el correo recibido.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailJustRegistered =
    searchParams.get("message") === "check_email" ||
    searchParams.get("registered") === "1";
  const registeredEmail = searchParams.get("email") ?? "";
  const callbackError = searchParams.get("error");

  const [serverError, setServerError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [lastLoginEmail, setLastLoginEmail] = useState(registeredEmail);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: registeredEmail },
  });

  async function onSubmit(values: LoginValues) {
    setLoading(true);
    setServerError(null);
    setNeedsConfirmation(false);
    setResendSent(false);
    setResendError(null);

    const email = values.email.trim().toLowerCase();
    setLastLoginEmail(email);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: values.password,
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("email not confirmed")) {
        setNeedsConfirmation(true);
      } else {
        setServerError(GENERIC_LOGIN_ERROR);
      }
      setLoading(false);
      return;
    }

    router.push(safeNext(searchParams.get("next")));
  }

  async function resendConfirmation() {
    const email = (lastLoginEmail || registeredEmail).trim().toLowerCase();
    if (!email) return;

    setResending(true);
    setResendSent(false);
    setResendError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
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
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="rounded-[32px] border border-[#050505]/10 bg-white p-5 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e] sm:p-7">
      <div className="space-y-6">
        <div>
          <p className="tp-kicker">Acceso de entrenador</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-foreground">
            Bienvenido de nuevo
          </h1>
          <p className="mt-2 text-sm leading-6 text-foreground/62">
            Inicia sesión en tu cuenta de entrenamiento.
          </p>
        </div>

        {emailJustRegistered && (
          <div className="rounded-[24px] border border-brand/30 bg-brand/10 px-4 py-4">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <Mail className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground">
                  Correo de confirmación enviado
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Hemos enviado un enlace de verificación
                  {registeredEmail && (
                    <>
                      {" "}
                      a{" "}
                      <span className="break-all font-medium text-foreground">
                        {registeredEmail}
                      </span>
                    </>
                  )}
                  . Confirma tu cuenta para poder iniciar sesión.
                </p>
              </div>
            </div>
          </div>
        )}

        {callbackError && CALLBACK_ERRORS[callbackError] && (
          <div className="rounded-[22px] border border-destructive/20 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">
              {CALLBACK_ERRORS[callbackError]}
            </p>
          </div>
        )}

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

        <form
          method="post"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              className="h-10"
              aria-invalid={!!errors.email}
              {...register("email", {
                onChange: (event) => {
                  setLastLoginEmail(event.target.value.trim().toLowerCase());
                  setNeedsConfirmation(false);
                  setServerError(null);
                },
              })}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground transition-colors hover:text-brand"
              >
                Olvidaste la contraseña?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="********"
                autoComplete="current-password"
                className="h-10 pr-10"
                aria-invalid={!!errors.password}
                {...register("password", {
                  onChange: () => {
                    setServerError(null);
                    setNeedsConfirmation(false);
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-1 flex items-center rounded-full px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                tabIndex={-1}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-[22px] border border-destructive/20 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          {needsConfirmation && (
            <div className="rounded-[24px] border border-brand/30 bg-brand/10 px-4 py-4">
              <div className="flex gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Mail className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground">
                    Tu email aún no está confirmado
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Revisa tu bandeja de entrada o pide otro enlace de
                    confirmación para{" "}
                    <span className="break-all font-semibold text-foreground">
                      {lastLoginEmail}
                    </span>
                    .
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={resendConfirmation}
                      disabled={resending}
                      className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-3 text-xs font-black text-background transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
                    >
                      {resending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Mail className="size-3.5" />
                      )}
                      Reenviar correo
                    </button>
                    {resendSent && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground/70">
                        <CheckCircle2 className="size-3.5 text-brand" />
                        Enviado
                      </span>
                    )}
                  </div>
                  {resendError && (
                    <p className="mt-2 text-xs text-destructive">
                      {resendError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="h-11 w-full rounded-full bg-brand font-black text-brand-foreground hover:bg-brand/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          No tienes cuenta?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground transition-colors hover:text-brand"
          >
            Crea una gratis
          </Link>
        </p>
      </div>
    </div>
  );
}

/** Destino tras iniciar sesión: solo rutas internas ("/…", no "//…"). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/dashboard";
  return raw;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
