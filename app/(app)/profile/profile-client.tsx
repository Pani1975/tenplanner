"use client";

import { LanguageSwitcher } from "@/components/app/language-switcher";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ACCENT_COLORS,
  applyAccentColor,
  applyFontSize,
} from "@/lib/accent-colors";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { ResourcesPanel } from "@/components/app/resources-panel";
import {
  Mail,
  Trash2,
  CheckCircle2,
  FileJson,
  FileText,
  Loader2,
  Camera,
  Activity,
  Clock,
  Calendar,
  Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

const FONT_SIZES = [
  { id: "sm", label: "A", size: "text-xs", desc: "Compacto" },
  { id: "md", label: "A", size: "text-sm", desc: "Normal" },
  { id: "lg", label: "A", size: "text-base", desc: "Grande" },
];

function getTimeBasedDarkMode() {
  const hour = new Date().getHours();
  return hour < 7 || hour >= 21;
}

function applyThemePreference(isDark: boolean) {
  localStorage.setItem("theme", isDark ? "dark" : "light");
  document.documentElement.classList.toggle("dark", isDark);
  applyAccentColor(localStorage.getItem("accent") ?? "blue");
}

type Tab = "profile" | "appearance" | "resources" | "stats" | "data";

interface ProfileClientProps {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_color: string | null;
    avatar_url: string | null;
    provider: string;
    created_at: string;
  };
  stats: {
    totalSessions: number;
    totalMinutes: number;
    totalExercises: number;
    upcomingSessions: number;
  };
}

const TABS: { id: Tab; label: string; code: string }[] = [
  { id: "profile", label: "Perfil", code: "01" },
  { id: "appearance", label: "Apariencia", code: "02" },
  { id: "resources", label: "Mis recursos", code: "03" },
  { id: "stats", label: "Estadísticas", code: "04" },
  { id: "data", label: "Datos", code: "05" },
];

export function ProfileClient({ user, stats }: ProfileClientProps) {
  const term = useTerm();
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_profile_profileclient");
  const [tab, setTab] = useState<Tab>("profile");

  // Profile state
  const [name, setName] = useState(user.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.avatar_url ?? null
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Appearance state
  const [accent, setAccent] = useState("blue");
  const [fontSize, setFontSize] = useState("md");
  const [autoTheme, setAutoTheme] = useState(true);

  // Export state
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Delete account state
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // En inglés se escribe DELETE; el servidor sigue recibiendo ELIMINAR.
  const isDeleteConfirmed = ["ELIMINAR", "DELETE"].includes(deleteConfirmText);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    if (!isDeleteConfirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "ELIMINAR" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? tx("noSePudoEliminar"));
      }
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (e: unknown) {
      setDeleteError(
        e instanceof Error ? e.message : tx("noSePudoEliminar")
      );
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    function syncAppearance() {
      setAccent(localStorage.getItem("accent") ?? "blue");
      setFontSize(localStorage.getItem("font-size") ?? "md");
      setAutoTheme(localStorage.getItem("theme-auto") !== "false");
    }

    syncAppearance();
    window.addEventListener("storage", syncAppearance);
    window.addEventListener("theme-auto-change", syncAppearance);
    return () => {
      window.removeEventListener("storage", syncAppearance);
      window.removeEventListener("theme-auto-change", syncAppearance);
    };
  }, []);

  function handleAccentChange(id: string) {
    setAccent(id);
    localStorage.setItem("accent", id);
    applyAccentColor(id);
  }

  function handleFontSizeChange(id: string) {
    setFontSize(id);
    localStorage.setItem("font-size", id);
    applyFontSize(id);
  }

  function handleAutoThemeChange(next: boolean) {
    setAutoTheme(next);
    localStorage.setItem("theme-auto", next ? "true" : "false");
    if (next) applyThemePreference(getTimeBasedDarkMode());
    window.dispatchEvent(new Event("theme-auto-change"));
  }

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setAvatarError(tx("soloSeAdmitenImagenes"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(tx("maximo5Mb"));
      return;
    }
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}.${ext}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: publicUrl }),
      });
      setAvatarUrl(publicUrl);
    } catch (e: unknown) {
      setAvatarError(e instanceof Error ? e.message : tx("errorAlSubirLa"));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setProfileError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name },
      });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setProfileError(e instanceof Error ? e.message : tx("errorAlGuardar"));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportJson() {
    setExportingJson(true);
    try {
      const res = await fetch("/api/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tenplanner-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingJson(false);
    }
  }

  async function handleExportCsv() {
    setExportingCsv(true);
    try {
      const res = await fetch("/api/export");
      const data = await res.json();
      const sessions = data.sessions ?? [];
      const headers = [
        "id",
        "title",
        "description",
        "scheduled_at",
        "duration_minutes",
      ];
      const rows = sessions.map((s: Record<string, unknown>) =>
        headers.map((h) => JSON.stringify(s[h] ?? "")).join(",")
      );
      const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
        type: "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sessions-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  const totalHours = Math.round(stats.totalMinutes / 60);
  const initials =
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="space-y-8">
      {/* Identity hero */}
      <section className="tp-panel relative overflow-hidden p-0 shadow-[0_24px_80px_-64px_color-mix(in_oklab,var(--foreground)_72%,transparent)]">
        <div className="relative h-24 overflow-hidden border-b border-foreground/10 bg-[#050505] sm:h-28">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(214,255,56,0.18)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:42px_42px] opacity-45" />
          <div className="absolute inset-x-6 bottom-5 h-px bg-white/18" />
        </div>

        <div className="-mt-14 px-5 pb-6 sm:px-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr_auto] md:items-end">
            {/* Avatar */}
            <div className="relative w-fit">
              <div className="flex size-28 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-background ring-2 ring-brand/45">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={name}
                    width={112}
                    height={112}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-black text-foreground/75">
                    {initials}
                  </span>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                title={tx("cambiarFoto")}
                className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full border border-foreground/15 bg-card text-foreground/80 transition-colors hover:border-brand hover:bg-brand hover:text-brand-foreground disabled:opacity-60"
              >
                {avatarUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Camera className="size-3.5" strokeWidth={1.6} />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                }}
              />
            </div>

            {/* Name + email */}
            <div className="min-w-0 md:pb-1">
              <h2 className="truncate text-2xl font-black leading-tight text-foreground sm:text-3xl">
                {name || "Tu nombre"}
              </h2>
              <p className="text-[13px] text-muted-foreground truncate mt-1">
                {user.email}
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <span className="inline-flex items-center rounded-full border border-foreground/15 px-2.5 py-1 text-[11px] font-bold capitalize text-foreground/80">
                  {user.provider === "google" ? "Google" : "Correo"}
                </span>
              </div>
              {avatarError && (
                <p className="text-[11px] text-destructive mt-2">
                  {avatarError}
                </p>
              )}
            </div>

            {/* Micro stats */}
            <dl className="hidden grid-cols-3 gap-2 md:grid md:pb-1">
              {[
                {
                  icon: Activity,
                  label: tx("sesiones"),
                  value: stats.totalSessions,
                },
                {
                  icon: Clock,
                  label: tx("horas"),
                  value: totalHours,
                },
                {
                  icon: Calendar,
                  label: tx("prox"),
                  value: stats.upcomingSessions,
                },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="min-w-[76px] rounded-[18px] border border-foreground/10 bg-background px-3 py-2.5 text-right"
                >
                  <div className="flex items-center justify-end gap-1 text-muted-foreground">
                    <Icon className="size-3" strokeWidth={1.6} />
                    <dt className="text-[11px] font-medium text-muted-foreground">
                      {label}
                    </dt>
                  </div>
                  <dd className="mt-0.5 text-xl font-black tabular-nums leading-none text-foreground">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-2 rounded-full border border-foreground/10 bg-card p-1 shadow-[0_12px_34px_color-mix(in_oklab,var(--foreground)_5%,transparent)]">
        {TABS.map(({ id, label }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-full px-4 py-2.5 text-[14px] font-black transition-colors",
                isActive
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* ── PROFILE ── */}
      {tab === "profile" && (
        <div className="tp-panel space-y-8 p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-[12px] font-black uppercase text-foreground/75"
              >
                {tx("nombreParaMostrar")}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tx("tuNombreCompleto")}
                className="tp-field h-11 w-full px-4 text-[15px] font-medium placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-black uppercase text-foreground/75">
                <Mail
                  className="inline size-3 mr-1 -mt-0.5"
                  strokeWidth={1.6}
                />
                {tx("correoElectronico")}
              </label>
              <input
                type="email"
                value={user.email ?? ""}
                disabled
                className="tp-field h-11 w-full cursor-not-allowed px-4 text-[15px] font-medium tabular-nums text-muted-foreground"
              />
            </div>
          </div>

          {profileError && (
            <div className="rounded-[20px] border border-destructive/25 bg-destructive/10 px-4 py-3">
              <p className="text-[13px] text-destructive">{profileError}</p>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-foreground/10 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[13px] font-black text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="size-4" />
              ) : null}
              {term(saving ? "Guardando…" : saved ? "Guardado" : "Guardar cambios")}
            </button>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="text-[13px] text-brand"
            >
              {saved ? "Cambios guardados" : ""}
            </p>
          </div>
        </div>
      )}

      {/* ── APPEARANCE ── */}
      {tab === "appearance" && (
        <div className="tp-panel space-y-8 p-5 sm:p-6">
          <div>
            <h3 className="border-b border-foreground/10 pb-2 text-[14px] font-black text-foreground">
              {tx("colorDeAcento")}
            </h3>
            <div className="mt-4 flex w-fit flex-wrap gap-1 rounded-full border border-foreground/10 bg-background p-1">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleAccentChange(c.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[12px] font-bold transition-colors",
                    accent === c.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]"
                  )}
                >
                  <span
                    className="size-3 rounded-full shrink-0 border border-foreground/10"
                    style={{ backgroundColor: c.preview }}
                  />
                  {term(c.label)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="border-b border-foreground/10 pb-2 text-[14px] font-black text-foreground">
              {tx("tamanoDelTexto")}
            </h3>
            <div className="mt-4 flex w-fit gap-1 rounded-full border border-foreground/10 bg-background p-1">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFontSizeChange(f.id)}
                  className={cn(
                    "flex min-w-[88px] flex-col items-center rounded-full px-6 py-3 transition-colors",
                    fontSize === f.id
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.03]"
                  )}
                >
                  <span className={cn("font-bold", f.size)}>{term(f.label)}</span>
                  <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
                    {term(f.desc)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="border-b border-foreground/10 pb-2 text-[14px] font-black text-foreground">
              {tx("tema")}
            </h3>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                aria-pressed={autoTheme}
                onClick={() => handleAutoThemeChange(!autoTheme)}
                className={cn(
                  "inline-flex h-10 w-fit items-center gap-2 rounded-full border px-4 text-[12px] font-black transition-colors",
                  autoTheme
                    ? "border-brand/45 bg-brand/10 text-brand"
                    : "border-foreground/15 text-muted-foreground hover:border-brand/45 hover:text-brand"
                )}
              >
                <Clock className="size-3.5" strokeWidth={1.6} />
                {tx("autoPorHora")}
                <span className="font-mono text-[10px]">
                  {autoTheme ? "ON" : "OFF"}
                </span>
              </button>
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}

      {/* ── MIS RECURSOS ── */}
      {tab === "resources" && (
        <div className="tp-panel p-5 sm:p-6">
          <ResourcesPanel userId={user.id} />
        </div>
      )}

      {/* ── STATS ── */}
      {tab === "stats" && (
        <div className="tp-panel space-y-8 p-5 sm:p-6">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                label: tx("sesionesTotales"),
                value: stats.totalSessions,
                icon: Activity,
                accent: true,
              },
              {
                label: tx("horasEntrenadas"),
                value: `${totalHours}h`,
                icon: Clock,
              },
              {
                label: tx("biblioteca"),
                value: stats.totalExercises,
                icon: Dumbbell,
              },
              {
                label: tx("proximas"),
                value: stats.upcomingSessions,
                icon: Calendar,
              },
            ].map(({ label, value, icon: Icon, accent: isAccent }) => (
              <div
                key={label}
                className={cn(
                  "relative overflow-hidden rounded-[24px] border p-5 transition-colors",
                  isAccent
                    ? "border-brand/30 bg-brand/10 hover:bg-brand/15"
                    : "border-foreground/10 bg-background hover:bg-muted/70"
                )}
              >
                {isAccent && (
                  <div
                    aria-hidden
                    className="absolute -top-8 -right-8 size-24 rounded-full bg-brand/15 blur-2xl"
                  />
                )}
                <div className="relative flex items-center gap-1.5 text-muted-foreground mb-3">
                  <Icon
                    className={cn(
                      "size-3.5",
                      isAccent ? "text-brand" : "text-muted-foreground"
                    )}
                    strokeWidth={1.6}
                  />
                  <p className="text-[11px] font-bold text-muted-foreground">
                    {label}
                  </p>
                </div>
                <p
                  className={cn(
                    "relative text-4xl font-black tabular-nums leading-none",
                    isAccent ? "text-brand" : "text-foreground"
                  )}
                >
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section>
            <h3 className="border-b border-foreground/10 pb-2 text-[14px] font-black text-foreground">
              {tx("detallesDeLaCuenta")}
            </h3>
            <dl className="divide-y divide-foreground/10">
              {[
                { label: tx("correoElectronico"), value: user.email ?? "—" },
                {
                  label: tx("metodoDeAcceso"),
                  value:
                    user.provider === "google"
                      ? "Google OAuth"
                      : tx("correoYContrasena"),
                },
                {
                  label: tx("miembroDesde"),
                  value: user.created_at
                    ? new Intl.DateTimeFormat(intlLocale, {
                        month: "long",
                        year: "numeric",
                      }).format(new Date(user.created_at))
                    : "—",
                },
                { label: tx("estado"), value: "Activo" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="grid gap-1 py-3.5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-4"
                >
                  <dt className="text-[12px] font-bold text-foreground/85">
                    {label}
                  </dt>
                  <dd className="text-[13px] text-foreground tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {/* ── DATA ── */}
      {tab === "data" && (
        <div className="tp-panel space-y-8 p-5 sm:p-6">
          <section>
            <h3 className="border-b border-foreground/10 pb-2 text-[14px] font-black text-foreground">
              {tx("exportarTusDatos")}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-4 mb-5 max-w-xl">
              {tx("descargaUnaCopiaCompleta")}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportJson}
                disabled={exportingJson}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/10 bg-card px-4 text-[13px] font-black text-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
              >
                {exportingJson ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileJson className="size-4 text-brand" strokeWidth={1.6} />
                )}
                {tx("jsonCompleto")}
              </button>
              <button
                onClick={handleExportCsv}
                disabled={exportingCsv}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-foreground/10 bg-card px-4 text-[13px] font-black text-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-60"
              >
                {exportingCsv ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.6}
                  />
                )}
                {tx("csvSesiones")}
              </button>
            </div>
            <ul className="mt-5 grid max-w-xl grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] text-muted-foreground sm:grid-cols-2">
              {[
                "Todas las sesiones con fechas y duraciones",
                "Biblioteca completa de ejercicios",
                "Relaciones sesión–ejercicio",
                "Metadatos de la cuenta",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 shrink-0">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="border-b border-destructive/30 pb-2 text-[14px] font-black text-destructive">
              {tx("zonaDePeligro")}
            </h3>
            <div className="mt-5 grid gap-4 border-l-2 border-destructive/40 py-2 pl-4 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6">
              <div>
                <p className="text-[15px] font-black text-foreground">
                  {tx("eliminarCuenta")}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-md">
                  {tx("eliminaPermanentementeTuCuenta")}
                </p>
              </div>
              <button
                onClick={() => {
                  setDeleteConfirmText("");
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-2 text-[11px] font-black uppercase text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="size-3" strokeWidth={1.6} />
                {tx("eliminar")}
              </button>
            </div>
          </section>
        </div>
      )}

      {deleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (!deleting && e.target === e.currentTarget) setDeleteOpen(false);
          }}
        >
          <div className="w-full max-w-md space-y-4 rounded-[28px] border border-destructive/35 bg-card p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
                <Trash2 className="size-4" strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <p
                  id="delete-account-title"
                  className="text-lg font-black text-foreground"
                >
                  {tx("eliminarCuenta")}
                </p>
                <p className="text-[13px] text-foreground/70 mt-1 leading-relaxed">
                  {tx("estaAccionEs")}{" "}<strong>{tx("irreversible")}</strong>. Se eliminarán
                  tus sesiones, alumnos, ejercicios propios, conversaciones con
                  Dr. Planner y tu cuenta de autenticación.
                </p>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-black text-foreground/85">
                {tx("escribe")}{" "}<span className="text-destructive">{tx("eliminar2")}</span>{" "}{tx("paraConfirmar")}
              </label>
              <input
                type="text"
                autoFocus
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deleting}
                className="tp-field h-10 w-full px-3 text-[14px] font-medium focus:border-destructive focus:ring-destructive/20"
                placeholder={tx("eliminar2")}
              />
            </div>
            {deleteError && (
              <p className="text-[12px] text-destructive">{deleteError}</p>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-foreground/10 pt-2">
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="rounded-full px-4 py-2 text-[12px] font-black uppercase text-foreground/70 hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {tx("cancelar")}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || !isDeleteConfirmed}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-[12px] font-black uppercase text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" strokeWidth={1.8} />
                )}
                {deleting ? "Eliminando…" : "Eliminar cuenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
