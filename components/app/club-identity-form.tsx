"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import {
  COURT_TYPES,
  totalCourts,
  type ClubIdentity,
  type CourtTypeId,
  type Courts,
} from "@/lib/club-identity";

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-70";

/**
 * Ficha de identificación del club con el que se trabaja (Perfil, en modo
 * club): nombre completo, dirección, pistas por tipo y año de fundación. La
 * edita el propietario; el resto de monitores del club la ven.
 */
export function ClubIdentityForm({
  clubId,
  initial,
  canEdit,
}: {
  clubId: string;
  initial: ClubIdentity;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [courts, setCourts] = useState<Courts>(initial.courts ?? {});
  const [foundedYear, setFoundedYear] = useState(
    initial.foundedYear ? String(initial.foundedYear) : ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function setCourt(id: CourtTypeId, raw: string) {
    const value = raw === "" ? undefined : Math.max(0, Math.floor(Number(raw)));
    setCourts((prev) => ({
      ...prev,
      [id]: Number.isFinite(value) ? value : undefined,
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const year = foundedYear.trim() ? Number(foundedYear) : null;
    if (
      year !== null &&
      (!Number.isInteger(year) ||
        year < 1800 ||
        year > new Date().getFullYear())
    ) {
      setMessage({ ok: false, text: "El año de fundación no es válido." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/identity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim() || null,
          address: address.trim() || null,
          courts,
          foundedYear: year,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: unknown;
        };
        setMessage({
          ok: false,
          text:
            typeof json.error === "string"
              ? json.error
              : "No se pudo guardar la ficha del club.",
        });
        return;
      }
      setMessage({ ok: true, text: "Ficha del club guardada." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Error de red. Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="tp-panel space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 size-5 shrink-0 text-brand" />
        <div>
          <h2 className="text-sm font-black uppercase text-foreground">
            Ficha del club · {initial.name}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-foreground/55">
            Datos de identificación del club con el que trabajas.
            {!canEdit && " Solo el propietario del club puede cambiarlos."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-semibold text-foreground">
            Nombre completo
          </span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={255}
            disabled={!canEdit}
            placeholder="Ej: Club de Tenis Tenerife"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-semibold text-foreground">
            Dirección
          </span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={500}
            disabled={!canEdit}
            placeholder="Calle, número, código postal y municipio"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold text-foreground">
            Año de fundación{" "}
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1800}
            max={new Date().getFullYear()}
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
            disabled={!canEdit}
            placeholder="Ej: 1985"
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">
          Número de pistas por tipo{" "}
          <span className="font-normal text-muted-foreground">
            · {totalCourts(courts)} en total
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COURT_TYPES.map((c) => (
            <label key={c.id} className="space-y-1">
              <span className="block text-xs font-semibold text-foreground/70">
                {c.label}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                value={courts[c.id] ?? ""}
                onChange={(e) => setCourt(c.id, e.target.value)}
                disabled={!canEdit}
                placeholder="0"
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </fieldset>

      {message && (
        <p
          className={
            message.ok
              ? "text-xs font-semibold text-brand"
              : "text-xs font-semibold text-destructive"
          }
        >
          {message.text}
        </p>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-5 py-2 text-sm font-black text-[#050505] transition-colors hover:bg-[#c8ef2f] disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar ficha
          </button>
        </div>
      )}
    </form>
  );
}
