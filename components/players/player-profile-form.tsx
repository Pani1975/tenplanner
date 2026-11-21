"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { todayInSpain } from "@/lib/matches/validation";
import { playerCategory } from "@/lib/players/category";
import {
  FAVORITE_SHOTS,
  HANDS,
  validateProfile,
  type ProfileField,
} from "@/lib/players/profile";

export interface ProfileFormValues {
  firstName: string;
  lastName: string;
  birthDate: string;
  showPhoto: boolean;
  clubName: string;
  dominantHand: string;
  favoriteShot: string;
  startedAge: string;
  favoritePlayer: string;
  birthPlace: string;
  isPublic: boolean;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

function Choice({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(value === o.id ? "" : o.id)}
          className={cn(
            "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
            value === o.id
              ? "border-brand bg-brand text-brand-foreground"
              : "border-[#050505]/15 bg-background text-foreground hover:border-brand/50 dark:border-white/15"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PlayerProfileForm({
  initial,
  photoUrl,
}: {
  initial: ProfileFormValues;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const today = todayInSpain();
  const category = playerCategory(values.birthDate || null);

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as ProfileField];
      if (key === "birthDate") delete next.isPublic;
      return next;
    });
    setSaved(false);
    setFormError(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validateProfile(values, today);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/player-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 422 && json.errors) {
        setErrors(json.errors);
        return;
      }
      if (!res.ok) {
        setFormError("No se ha podido guardar el perfil. Inténtalo de nuevo.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setFormError("No se ha podido guardar el perfil. Revisa la conexión.");
    } finally {
      setSaving(false);
    }
  }

  const textField = (
    key: "firstName" | "lastName" | "clubName" | "favoritePlayer" | "birthPlace" | "birthDate" | "startedAge",
    label: string,
    opts: { required?: boolean; type?: string; hint?: string; inputMode?: "numeric"; max?: string } = {}
  ) => (
    <div className="space-y-2">
      <Label htmlFor={key}>
        {label}
        {opts.required ? (
          <span className="text-destructive"> *</span>
        ) : (
          <span className="font-normal text-muted-foreground"> (opcional)</span>
        )}
      </Label>
      <Input
        id={key}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        max={opts.max}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `${key}-error` : undefined}
        className="h-11"
      />
      {opts.hint && !errors[key] && (
        <p className="text-xs text-muted-foreground">{opts.hint}</p>
      )}
      <FieldError id={`${key}-error`} message={errors[key]} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <section className="tp-panel space-y-4 p-4 sm:p-6">
        <h2 className="text-base font-black text-foreground">Datos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {textField("firstName", "Nombre", { required: true })}
          {textField("lastName", "Apellidos", { required: true })}
          <div className="space-y-2">
            {textField("birthDate", "Fecha de nacimiento", {
              type: "date",
              max: today,
              hint: "No se muestra en tu perfil: solo sirve para calcular tu categoría.",
            })}
            {category && (
              <p className="text-sm font-semibold text-foreground">
                Categoría: {category}
              </p>
            )}
          </div>
          {textField("birthPlace", "Lugar de nacimiento")}
          {textField("clubName", "Club", {
            hint: "En tu perfil aparece como club indicado por ti.",
          })}
          {textField("startedAge", "Edad a la que empezaste a jugar", {
            inputMode: "numeric",
          })}
          {textField("favoritePlayer", "Tenista preferido")}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Mano con la que juegas{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <Choice
            label="Mano con la que juegas"
            options={HANDS}
            value={values.dominantHand}
            onChange={(v) => set("dominantHand", v)}
          />
          <FieldError id="dominantHand-error" message={errors.dominantHand} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Golpe preferido{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <Choice
            label="Golpe preferido"
            options={FAVORITE_SHOTS}
            value={values.favoriteShot}
            onChange={(v) => set("favoriteShot", v)}
          />
          <FieldError id="favoriteShot-error" message={errors.favoriteShot} />
        </div>
      </section>

      <section className="tp-panel space-y-4 p-4 sm:p-6">
        <h2 className="text-base font-black text-foreground">Foto</h2>
        <div className="flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="grid size-16 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-lg font-black text-foreground/50">
              {(values.firstName[0] ?? "") + (values.lastName[0] ?? "")}
            </div>
          )}
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={values.showPhoto}
                disabled={!photoUrl}
                onChange={(e) => set("showPhoto", e.target.checked)}
                className="mt-1 size-4"
              />
              <span>Mostrar mi foto en el perfil público</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Es la foto de tu cuenta. Puedes cambiarla en{" "}
              <Link href="/profile" className="font-semibold underline">
                Cuenta
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="tp-panel space-y-3 p-4 sm:p-6">
        <h2 className="text-base font-black text-foreground">Perfil público</h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={values.isPublic}
            onChange={(e) => set("isPublic", e.target.checked)}
            className="mt-1 size-4"
            aria-describedby={errors.isPublic ? "isPublic-error" : undefined}
          />
          <span>
            Hacer público mi perfil. Cualquiera con el enlace verá tu nombre, tu
            categoría, los datos que hayas rellenado y los partidos que marques
            como «Mostrar en mi perfil». Nunca se muestran tu fecha de
            nacimiento ni los datos de tus rivales.
          </span>
        </label>
        <FieldError id="isPublic-error" message={errors.isPublic} />
      </section>

      {formError && (
        <div className="rounded-[22px] border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground/70">
            <Check className="size-4" /> Guardado
          </span>
        )}
        <Button type="submit" disabled={saving} className="h-11 rounded-full font-black">
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Guardar perfil
        </Button>
      </div>
    </form>
  );
}
