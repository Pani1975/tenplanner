"use client";

/* eslint-disable @next/next/no-img-element -- Fotos subidas por el club (URLs públicas de Storage); next/image no aporta aquí. */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getYouTubeEmbedUrl } from "@/lib/video-embed";
import {
  COURT_TYPES,
  MAX_CLUB_PHOTOS,
  MAX_CLUB_VIDEOS,
  totalCourts,
  type ClubIdentity,
  type CourtTypeId,
  type Courts,
} from "@/lib/club-identity";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-70";

// Las fotos van al bucket público "resources", en la carpeta del usuario
// (igual que las imágenes de Recursos).
const PHOTOS_BUCKET = "resources";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function Optional() {
  return <span className="font-normal text-muted-foreground">(opcional)</span>;
}

/** Sí / No / sin indicar, con dos botones. */
function YesNo({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-semibold text-foreground">
        {label}
      </span>
      <div className="flex gap-2">
        {[
          { v: true, text: "Sí" },
          { v: false, text: "No" },
        ].map((opt) => (
          <button
            key={opt.text}
            type="button"
            disabled={disabled}
            aria-pressed={value === opt.v}
            onClick={() => onChange(value === opt.v ? null : opt.v)}
            className={cn(
              "h-10 min-w-16 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-70",
              value === opt.v
                ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                : "border-border text-foreground/70 hover:border-foreground/30"
            )}
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Ficha del club ("Mi club"): nombre (el que sale en las cabeceras del modo
 * club), contacto, portada, fotos, vídeos, instalaciones y año de fundación.
 * Los números de monitores y alumnos se calculan (no se editan). La edita el
 * propietario; el resto de monitores del club la ven.
 */
export function ClubIdentityForm({
  clubId,
  userId,
  initial,
  canEdit,
  stats,
}: {
  clubId: string;
  /** Usuario actual: carpeta donde se suben las fotos. */
  userId: string;
  initial: ClubIdentity;
  canEdit: boolean;
  /** Calculados: monitores dados de alta y alumnos del club. */
  stats?: { monitors: number; students: number };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [fullName, setFullName] = useState(initial.fullName ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [foundedYear, setFoundedYear] = useState(
    initial.foundedYear ? String(initial.foundedYear) : ""
  );
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl);
  const [photos, setPhotos] = useState<string[]>(initial.photos);
  const [videos, setVideos] = useState<string[]>(initial.videos);
  const [newVideo, setNewVideo] = useState("");
  const [courts, setCourts] = useState<Courts>(initial.courts ?? {});
  const [padelCourts, setPadelCourts] = useState(
    initial.padelCourts ? String(initial.padelCourts) : ""
  );
  const [hasCafeteria, setHasCafeteria] = useState(initial.hasCafeteria);
  const [hasParking, setHasParking] = useState(initial.hasParking);
  const [uploading, setUploading] = useState<"cover" | "photos" | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const photosInput = useRef<HTMLInputElement>(null);

  function setCourt(id: CourtTypeId, raw: string) {
    const value = raw === "" ? undefined : Math.max(0, Math.floor(Number(raw)));
    setCourts((prev) => ({
      ...prev,
      [id]: Number.isFinite(value) ? value : undefined,
    }));
  }

  async function uploadImage(file: File): Promise<string> {
    if (!file.type.startsWith("image/"))
      throw new Error("Solo se admiten imágenes (JPG, PNG, WebP…).");
    if (file.size > MAX_PHOTO_BYTES)
      throw new Error("Cada imagen puede ocupar como máximo 8 MB.");
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/club-${clubId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data
      .publicUrl;
  }

  async function onCoverSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading("cover");
    setMessage(null);
    try {
      setCoverImageUrl(await uploadImage(file));
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof Error ? e.message : "No se pudo subir la imagen.",
      });
    } finally {
      setUploading(null);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function onPhotosSelected(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_CLUB_PHOTOS - photos.length;
    const selected = Array.from(files).slice(0, Math.max(0, room));
    if (selected.length === 0) {
      setMessage({
        ok: false,
        text: `Máximo ${MAX_CLUB_PHOTOS} fotos.`,
      });
      return;
    }
    setUploading("photos");
    setMessage(null);
    try {
      const urls: string[] = [];
      for (const file of selected) urls.push(await uploadImage(file));
      setPhotos((prev) => [...prev, ...urls]);
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof Error ? e.message : "No se pudo subir la foto.",
      });
    } finally {
      setUploading(null);
      if (photosInput.current) photosInput.current.value = "";
    }
  }

  function addVideo() {
    const raw = newVideo.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      new URL(url);
    } catch {
      setMessage({ ok: false, text: "El enlace del vídeo no es válido." });
      return;
    }
    if (videos.length >= MAX_CLUB_VIDEOS) {
      setMessage({ ok: false, text: `Máximo ${MAX_CLUB_VIDEOS} vídeos.` });
      return;
    }
    setVideos((prev) => [...prev, url]);
    setNewVideo("");
    setMessage(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setMessage({ ok: false, text: "El nombre del club es obligatorio." });
      return;
    }
    if (!email.trim()) {
      setMessage({ ok: false, text: "El email del club es obligatorio." });
      return;
    }
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
    const padel = padelCourts.trim() ? Number(padelCourts) : null;
    if (padel !== null && (!Number.isInteger(padel) || padel < 0)) {
      setMessage({
        ok: false,
        text: "El número de pistas de pádel no es válido.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/identity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          fullName: fullName.trim() || null,
          email: email.trim(),
          phone: phone.trim() || null,
          website: website.trim() || null,
          address: address.trim() || null,
          coverImageUrl,
          photos,
          videos,
          courts,
          padelCourts: padel,
          hasCafeteria,
          hasParking,
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

  const disabled = !canEdit;

  return (
    <form onSubmit={save} className="tp-panel space-y-6 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 size-5 shrink-0 text-brand" />
        <div>
          <h2 className="text-sm font-black uppercase text-foreground">
            Ficha del club · {initial.name}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-foreground/55">
            {canEdit
              ? "El nombre del club es el que aparece en las cabeceras del espacio del club."
              : "Solo el propietario del club puede cambiar estos datos."}
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Monitores", value: stats.monitors },
            { label: "Alumnos", value: stats.students },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-background px-4 py-3"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-foreground/50">
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Portada */}
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-foreground">
          Foto de portada <Optional />
        </span>
        {coverImageUrl ? (
          <div className="relative overflow-hidden rounded-2xl border border-border">
            <img
              src={coverImageUrl}
              alt="Portada del club"
              className="aspect-[3/1] w-full object-cover"
            />
            {canEdit && (
              <div className="absolute right-2 top-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                  className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={() => setCoverImageUrl(null)}
                  aria-label="Quitar portada"
                  className="rounded-full bg-black/60 p-1.5 text-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={uploading !== null}
            className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-foreground/55 transition-colors hover:border-brand/60 hover:text-foreground disabled:opacity-60"
          >
            {uploading === "cover" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            Subir portada
          </button>
        ) : (
          <p className="text-xs italic text-muted-foreground">Sin portada.</p>
        )}
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void onCoverSelected(e.target.files)}
        />
      </div>

      {/* Datos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-semibold text-foreground">
            Nombre del club
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            required
            disabled={disabled}
            placeholder="Ej: CT Tenerife"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-semibold text-foreground">
            Nombre completo <Optional />
          </span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={255}
            disabled={disabled}
            placeholder="Ej: Club de Tenis Tenerife"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold text-foreground">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            required
            disabled={disabled}
            placeholder="info@club.com"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold text-foreground">
            Teléfono <Optional />
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={50}
            disabled={disabled}
            placeholder="922 000 000"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-semibold text-foreground">
            Dirección <Optional />
          </span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={500}
            disabled={disabled}
            placeholder="Calle, número, código postal y municipio"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold text-foreground">
            Web <Optional />
          </span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={255}
            disabled={disabled}
            placeholder="www.club.com"
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold text-foreground">
            Año de fundación <Optional />
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1800}
            max={new Date().getFullYear()}
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
            disabled={disabled}
            placeholder="Ej: 1985"
            className={inputClass}
          />
        </label>
      </div>

      {/* Instalaciones */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-black uppercase text-foreground/70">
          Instalaciones
        </legend>
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-foreground">
            Pistas de tenis por tipo{" "}
            <span className="font-normal text-muted-foreground">
              · {totalCourts(courts)} en total
            </span>
          </span>
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
                  disabled={disabled}
                  placeholder="0"
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="block text-sm font-semibold text-foreground">
              Pistas de pádel
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={padelCourts}
              onChange={(e) => setPadelCourts(e.target.value)}
              disabled={disabled}
              placeholder="0"
              className={inputClass}
            />
          </label>
          <YesNo
            label="Cafetería"
            value={hasCafeteria}
            onChange={setHasCafeteria}
            disabled={disabled}
          />
          <YesNo
            label="Aparcamiento"
            value={hasParking}
            onChange={setHasParking}
            disabled={disabled}
          />
        </div>
      </fieldset>

      {/* Fotos */}
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-foreground">
          Fotos <Optional />
        </span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((url) => (
            <div
              key={url}
              className="relative overflow-hidden rounded-xl border border-border"
            >
              <img
                src={url}
                alt="Foto del club"
                className="aspect-square w-full object-cover"
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    setPhotos((prev) => prev.filter((p) => p !== url))
                  }
                  aria-label="Quitar foto"
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {canEdit && photos.length < MAX_CLUB_PHOTOS && (
            <button
              type="button"
              onClick={() => photosInput.current?.click()}
              disabled={uploading !== null}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs text-foreground/55 transition-colors hover:border-brand/60 hover:text-foreground disabled:opacity-60"
            >
              {uploading === "photos" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ImagePlus className="size-5" />
              )}
              Añadir fotos
            </button>
          )}
        </div>
        {!canEdit && photos.length === 0 && (
          <p className="text-xs italic text-muted-foreground">Sin fotos.</p>
        )}
        <input
          ref={photosInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void onPhotosSelected(e.target.files)}
        />
      </div>

      {/* Vídeos */}
      <div className="space-y-2">
        <span className="block text-sm font-semibold text-foreground">
          Vídeos <Optional />
        </span>
        {videos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((url) => {
              const embed = getYouTubeEmbedUrl(url);
              return (
                <div
                  key={url}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  {embed ? (
                    <iframe
                      src={embed}
                      title="Vídeo del club"
                      className="aspect-video w-full"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex aspect-video items-center justify-center gap-2 bg-muted text-sm font-semibold text-foreground/70 hover:text-foreground"
                    >
                      <Video className="size-4" /> Ver vídeo
                    </a>
                  )}
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-xs text-foreground/55">
                      {url}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setVideos((prev) => prev.filter((v) => v !== url))
                        }
                        aria-label="Quitar vídeo"
                        className="shrink-0 rounded-full p-1 text-foreground/55 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {canEdit && videos.length < MAX_CLUB_VIDEOS && (
          <div className="flex gap-2">
            <input
              value={newVideo}
              onChange={(e) => setNewVideo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addVideo();
                }
              }}
              placeholder="Enlace de YouTube u otra web"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addVideo}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold text-foreground/70 hover:border-brand/60 hover:text-foreground"
            >
              <Plus className="size-4" /> Añadir
            </button>
          </div>
        )}
        {!canEdit && videos.length === 0 && (
          <p className="text-xs italic text-muted-foreground">Sin vídeos.</p>
        )}
      </div>

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
            disabled={saving || uploading !== null}
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
