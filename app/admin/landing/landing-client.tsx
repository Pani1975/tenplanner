"use client";

import { useState } from "react";
import { Check, Loader2, RotateCcw, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { adminPanelClass } from "../_components/admin-ui";
import type {
  LandingFieldGroup,
  LandingStringKey,
} from "@/lib/landing-content";

interface Field {
  key: LandingStringKey;
  label: string;
  group: LandingFieldGroup;
  multiline?: boolean;
  maxLength: number;
  currentValue: string;
  defaultValue: string;
}

type Values = Record<LandingStringKey, string>;

const GROUPS: LandingFieldGroup[] = [
  "Hero",
  "Secciones",
  "Cierre",
  "Footer y SEO",
];

export function AdminLandingClient({ fields }: { fields: Field[] }) {
  const initialValues = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue])
  ) as Values;
  const [values, setValues] = useState<Values>(initialValues);
  const [baseline, setBaseline] = useState<Values>(initialValues);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirtyTextKeys = fields
    .filter((field) => values[field.key] !== baseline[field.key])
    .map((field) => field.key);
  const dirtyCount = dirtyTextKeys.length;

  async function saveUpdates(updates: Record<string, unknown>, marker: string) {
    setSaving(marker);
    try {
      const res = await fetch("/api/admin/landing-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");

      setBaseline((prev) => ({ ...prev, ...(updates as Partial<Values>) }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
      toast.success("Landing actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(null);
    }
  }

  function saveField(field: Field) {
    void saveUpdates({ [field.key]: values[field.key] }, field.key);
  }

  function saveAll() {
    const updates: Record<string, unknown> = {};
    for (const key of dirtyTextKeys) updates[key] = values[key];
    if (Object.keys(updates).length > 0) {
      void saveUpdates(updates, "all");
    }
  }

  function restoreField(field: Field) {
    setValues((prev) => ({ ...prev, [field.key]: field.defaultValue }));
  }

  const heroTitlePreview = values.home_hero_title.split("\n").filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <Card className={adminPanelClass}>
          <CardHeader className="border-b">
            <CardTitle>Copys editables</CardTitle>
            <CardDescription>
              {dirtyCount === 0
                ? "Sin cambios pendientes"
                : `${dirtyCount} cambio${dirtyCount === 1 ? "" : "s"} pendiente${dirtyCount === 1 ? "" : "s"}`}
            </CardDescription>
            <CardAction className="flex items-center gap-2">
              {saved && (
                <Check className="text-brand" data-icon="inline-start" />
              )}
              <Button
                type="button"
                size="sm"
                disabled={dirtyCount === 0 || saving !== null}
                onClick={saveAll}
              >
                {saving === "all" ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Guardar todo
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-8">
              {GROUPS.map((group) => (
                <section key={group} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/45">
                      {group}
                    </h2>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {fields
                      .filter((field) => field.group === group)
                      .map((field) => {
                        const isDirty =
                          values[field.key] !== baseline[field.key];
                        const isSaving = saving === field.key;
                        const length = values[field.key].length;

                        return (
                          <div
                            key={field.key}
                            className={cn(
                              "rounded-lg border border-foreground/12 bg-background/80 p-3",
                              field.multiline && "md:col-span-2",
                              isDirty && "border-brand/40 bg-brand/5"
                            )}
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <label
                                htmlFor={field.key}
                                className="text-xs font-medium text-foreground/70"
                              >
                                {field.label}
                              </label>
                              <span
                                className={cn(
                                  "text-[11px] tabular-nums text-muted-foreground",
                                  length > field.maxLength && "text-destructive"
                                )}
                              >
                                {length}/{field.maxLength}
                              </span>
                            </div>
                            {field.multiline ? (
                              <Textarea
                                id={field.key}
                                value={values[field.key]}
                                maxLength={field.maxLength}
                                onChange={(event) =>
                                  setValues((prev) => ({
                                    ...prev,
                                    [field.key]: event.target.value,
                                  }))
                                }
                                rows={field.multiline ? 3 : 1}
                                className="resize-none"
                              />
                            ) : (
                              <Input
                                id={field.key}
                                value={values[field.key]}
                                maxLength={field.maxLength}
                                onChange={(event) =>
                                  setValues((prev) => ({
                                    ...prev,
                                    [field.key]: event.target.value,
                                  }))
                                }
                              />
                            )}
                            <div className="mt-3 flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={saving !== null}
                                onClick={() => restoreField(field)}
                              >
                                <RotateCcw data-icon="inline-start" />
                                Default
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!isDirty || saving !== null}
                                onClick={() =>
                                  setValues((prev) => ({
                                    ...prev,
                                    [field.key]: baseline[field.key],
                                  }))
                                }
                              >
                                <Undo2 data-icon="inline-start" />
                                Deshacer
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={!isDirty || saving !== null}
                                onClick={() => saveField(field)}
                              >
                                {isSaving ? (
                                  <Loader2
                                    className="animate-spin"
                                    data-icon="inline-start"
                                  />
                                ) : (
                                  <Save data-icon="inline-start" />
                                )}
                                Guardar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className={adminPanelClass}>
          <CardHeader className="border-b">
            <CardTitle>Vista rápida</CardTitle>
            <CardDescription>Resumen del contenido principal.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="rounded-lg border border-foreground/12 bg-[#050505] p-4 text-white dark:bg-background">
              <p className="font-heading text-4xl leading-none">
                {heroTitlePreview.map((line, index) => (
                  <span key={`${line}-${index}`}>
                    {line}
                    {index < heroTitlePreview.length - 1 && <br />}
                  </span>
                ))}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {values.home_hero_subtitle}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[#D6FF38] px-3 py-1 font-black text-[#050505]">
                  {values.home_hero_cta_primary}
                </span>
                <span className="rounded-full border border-white/18 px-3 py-1 text-white/70 dark:border-foreground/18 dark:text-muted-foreground">
                  {values.home_hero_cta_secondary}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
