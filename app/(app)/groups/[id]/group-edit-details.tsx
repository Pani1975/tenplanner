"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Botón "Editar grupo" para la cabecera: cambia el nombre y la descripción.
 * (Los alumnos se añaden y quitan desde el panel de la ficha. El club del
 * grupo se fija al crearlo según el modo de trabajo activo y no se edita
 * aquí — ver /perfil.)
 */
export function GroupEditDetails({
  groupId,
  name,
  description,
}: {
  groupId: string;
  name: string;
  description: string | null;
}) {
  const tx = useTranslations("ui.s_id_groupeditdetails");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [descriptionValue, setDescriptionValue] = useState(description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setNameValue(name);
    setDescriptionValue(description ?? "");
    setError(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = nameValue.trim();
    if (!trimmedName) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: descriptionValue.trim() || null,
        }),
      });
      if (!res.ok) {
        setError(tx("noSePudoGuardar"));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(tx("errorDeRedIntentalo"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-black text-white/80 transition-colors hover:bg-white/12 hover:text-white"
      >
        <Pencil className="size-4" />
        {tx("editarGrupo")}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full space-y-3 rounded-[24px] border border-white/12 bg-white/8 p-4 sm:max-w-sm"
    >
      <div className="space-y-1.5">
        <label
          htmlFor="group-edit-name"
          className="text-[11px] font-black uppercase text-white/55"
        >
          {tx("nombre")}{" "}<span className="text-[#D6FF38]">*</span>
        </label>
        <input
          id="group-edit-name"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          maxLength={255}
          required
          autoFocus
          className="h-11 w-full rounded-full border border-white/15 bg-black/30 px-4 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:border-[#D6FF38]"
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="group-edit-description"
          className="text-[11px] font-black uppercase text-white/55"
        >
          {tx("descripcion")}
        </label>
        <input
          id="group-edit-description"
          value={descriptionValue}
          onChange={(e) => setDescriptionValue(e.target.value)}
          placeholder={tx("nivelHorarioPista")}
          maxLength={255}
          className="h-11 w-full rounded-full border border-white/15 bg-black/30 px-4 text-sm font-medium text-white outline-none placeholder:text-white/30 focus:border-[#D6FF38]"
        />
      </div>
      {error && <p className="text-xs font-semibold text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-sm font-black text-white/70 transition-colors hover:bg-white/10"
        >
          {tx("cancelar")}
        </button>
        <button
          type="submit"
          disabled={saving || !nameValue.trim()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#D6FF38] px-4 py-2.5 text-sm font-black text-[#050505] transition-colors hover:bg-[#c8ef2f] disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {tx("guardar")}
        </button>
      </div>
    </form>
  );
}
