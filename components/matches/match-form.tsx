"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MATCH_TYPES,
  MATCH_TYPE_LABELS,
  MATCH_TYPE_RULES,
  todayInSpain,
  validateMatch,
  type MatchField,
  type MatchType,
} from "@/lib/matches/validation";

export interface MatchFormValues {
  matchType: MatchType | null;
  matchDate: string;
  finalResult: string;
  tournamentUrl: string;
  tournamentName: string;
  showOnProfile: boolean;
  rivalFirstName: string;
  rivalLastName: string;
  rivalLicense: string;
}

const EMPTY: MatchFormValues = {
  matchType: null,
  matchDate: "",
  finalResult: "",
  tournamentUrl: "",
  tournamentName: "",
  showOnProfile: false,
  rivalFirstName: "",
  rivalLastName: "",
  rivalLicense: "",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

/** Alta y edición de un partido. Primero el tipo; luego, sus campos. */
export function MatchForm({
  matchId,
  initial,
}: {
  matchId?: string;
  initial?: MatchFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<MatchFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Partial<Record<MatchField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = todayInSpain();
  const rules = values.matchType ? MATCH_TYPE_RULES[values.matchType] : null;

  function set<K extends keyof MatchFormValues>(key: K, value: MatchFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as MatchField];
      return next;
    });
    setFormError(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validateMatch(values, today);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(matchId ? `/api/matches/${matchId}` : "/api/matches", {
        method: matchId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 422 && json.errors) {
        setErrors(json.errors);
        return;
      }
      if (!res.ok) {
        setFormError("No se ha podido guardar el partido. Inténtalo de nuevo.");
        return;
      }
      const id = matchId ?? json.match?.id;
      router.push(id ? `/mis-partidos/${id}` : "/mis-partidos");
      router.refresh();
    } catch {
      setFormError("No se ha podido guardar el partido. Revisa la conexión.");
    } finally {
      setSaving(false);
    }
  }

  const field = (
    key: Exclude<MatchField, "matchType" | "showOnProfile">,
    label: string,
    opts: {
      required?: boolean;
      type?: string;
      placeholder?: string;
      hint?: string;
      inputMode?: "text" | "url";
      max?: string;
    } = {}
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
        placeholder={opts.placeholder}
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
    <form onSubmit={onSubmit} className="tp-panel space-y-6 p-4 sm:p-6" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground">
          Tipo de partido<span className="text-destructive"> *</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MATCH_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={values.matchType === type}
              onClick={() => set("matchType", type)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-sm font-semibold transition",
                values.matchType === type
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-[#050505]/15 bg-background text-foreground hover:border-brand/50 dark:border-white/15"
              )}
            >
              {MATCH_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <FieldError id="matchType-error" message={errors.matchType} />
      </fieldset>

      {rules && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("matchDate", "Fecha del partido", {
              required: true,
              type: "date",
              max: today,
            })}
            {field("finalResult", "Resultado final", {
              required: rules.resultRequired,
              placeholder: "6-4 3-6 10-8",
              hint: "Por sets, separados por espacios.",
            })}
          </div>

          {rules.url && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("tournamentName", "Torneo")}
              {field("tournamentUrl", rules.urlLabel, {
                type: "url",
                inputMode: "url",
                placeholder: "https://",
              })}
            </div>
          )}

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-foreground">Rival</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("rivalFirstName", "Nombre", {
                required: rules.rivalFirstNameRequired,
              })}
              {field("rivalLastName", "Apellidos")}
              {rules.license && field("rivalLicense", "Licencia")}
            </div>
            <p className="text-xs text-muted-foreground">
              Los datos del rival solo los ves tú.
            </p>
          </fieldset>
        </>
      )}

      {rules && (
        <label className="flex items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-[#F4F4F1] p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
          <input
            type="checkbox"
            checked={values.showOnProfile}
            onChange={(e) => set("showOnProfile", e.target.checked)}
            className="mt-1 size-4"
          />
          <span>
            Mostrar en mi perfil público
            <span className="block text-xs text-muted-foreground">
              Se ven la fecha, el tipo, el torneo y el resultado. El rival, nunca.
            </span>
          </span>
        </label>
      )}

      {formError && (
        <div className="rounded-[22px] border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-full"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={saving || !values.matchType}
          className="h-11 rounded-full font-black"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {matchId ? "Guardar cambios" : "Guardar partido"}
        </Button>
      </div>
    </form>
  );
}
