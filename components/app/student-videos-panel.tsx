"use client";

/* eslint-disable @next/next/no-img-element -- Miniaturas públicas de YouTube (i.ytimg.com); next/image no aporta aquí. */

import { useState } from "react";
import type { KeyboardEvent } from "react";
import {
  CalendarDays,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  normalizeVideoUrl,
} from "@/lib/video-embed";
import type {
  StudentVideoActions,
  StudentVideoItem,
  VideoActionResult,
} from "@/lib/student-videos";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

type FormValues = {
  location: string;
  event: string;
  recordedOn: string;
  notes: string;
  videoUrl: string;
};

const EMPTY: FormValues = {
  location: "",
  event: "",
  recordedOn: "",
  notes: "",
  videoUrl: "",
};

// Más recientes primero; las fichas sin fecha, al final.
function sortVideos(list: StudentVideoItem[]) {
  return [...list].sort((a, b) => {
    if (a.recordedOn === b.recordedOn) return 0;
    if (!a.recordedOn) return 1;
    if (!b.recordedOn) return -1;
    return a.recordedOn < b.recordedOn ? 1 : -1;
  });
}

function formatDay(isoDate: string, loc: string = "es-ES") {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(loc, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function linkLabel(url: string) {
  const kind = normalizeVideoUrl(url)?.kind;
  if (kind === "drive") return "Ver en Google Drive";
  if (kind === "youtube") return "Ver en YouTube";
  return "Ver vídeo";
}

export function StudentVideosPanel({
  studentId,
  studentName,
  canEdit,
  initialVideos,
  actions,
}: {
  studentId: string;
  studentName: string;
  canEdit: boolean;
  initialVideos: StudentVideoItem[];
  actions: StudentVideoActions;
}) {
  const tx = useTranslations("ui.s_app_studentvideospanel");
  const [videos, setVideos] = useState(() => sortVideos(initialVideos));
  // null = sin formulario abierto; "new" = alta; id = edición de esa ficha.
  const [editing, setEditing] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<StudentVideoItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(video: StudentVideoItem) {
    setDeletingId(video.id);
    setError(null);
    const res = await actions.remove(studentId, video.id);
    setDeletingId(null);
    if (!res.ok) {
      setError(tx("noSePudoBorrar"));
      return;
    }
    setVideos((list) => list.filter((v) => v.id !== video.id));
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-[13px] leading-relaxed text-foreground/60">
        {tx("guardaLosVideosDe", { v1: studentName })}</p>

      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      {videos.length === 0 && editing !== "new" && (
        <p className="text-[13px] italic text-foreground/45">
          {tx("todaviaNoHayFichas")}
        </p>
      )}

      {videos.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {videos.map((video) =>
            editing === video.id ? (
              <li key={video.id} className="md:col-span-2">
                <VideoForm
                  initial={{
                    location: video.location ?? "",
                    event: video.event ?? "",
                    recordedOn: video.recordedOn ?? "",
                    notes: video.notes ?? "",
                    videoUrl: video.videoUrl,
                  }}
                  submitLabel="Guardar cambios"
                  onCancel={() => setEditing(null)}
                  onSubmit={(values) =>
                    actions.update(studentId, video.id, values)
                  }
                  onSaved={(saved) => {
                    setVideos((list) =>
                      sortVideos(
                        list.map((v) => (v.id === saved.id ? saved : v))
                      )
                    );
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <VideoCard
                key={video.id}
                video={video}
                canEdit={canEdit}
                deleting={deletingId === video.id}
                onEdit={() => setEditing(video.id)}
                onDelete={() => setToDelete(video)}
              />
            )
          )}
        </ul>
      )}

      {canEdit &&
        (editing === "new" ? (
          <VideoForm
            initial={EMPTY}
            submitLabel="Añadir ficha"
            onCancel={() => setEditing(null)}
            onSubmit={(values) => actions.create(studentId, values)}
            onSaved={(saved) => {
              setVideos((list) => sortVideos([...list, saved]));
              setEditing(null);
            }}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing("new")}
          >
            <Plus className="size-3.5" />
            {tx("anadirFichaDeVideo")}
          </Button>
        ))}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={tx("borrarEstaFichaDe")}
        description={tx("seBorraLaFicha")}
        confirmLabel={tx("borrar")}
        destructive
        onConfirm={() => {
          if (toDelete) void onDelete(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}

function VideoCard({
  video,
  canEdit,
  deleting,
  onEdit,
  onDelete,
}: {
  video: StudentVideoItem;
  canEdit: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_app_studentvideospanel");
  const [playing, setPlaying] = useState(false);
  const thumbnail = getYouTubeThumbnailUrl(video.videoUrl);
  const embed = getYouTubeEmbedUrl(video.videoUrl);
  const title = video.event || video.location || tx("videoSinTitulo");

  return (
    <li className="overflow-hidden rounded-2xl border border-[#050505]/10 dark:border-white/10">
      {embed && thumbnail ? (
        <div className="relative aspect-video bg-black">
          {playing ? (
            <iframe
              src={`${embed}${embed.includes("?") ? "&" : "?"}autoplay=1`}
              title={title}
              className="absolute inset-0 size-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 size-full"
              aria-label={`Reproducir ${title}`}
            >
              <img
                src={thumbnail}
                alt=""
                loading="lazy"
                className="size-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-12 place-items-center rounded-full bg-black/70 text-white transition-transform group-hover:scale-110">
                  <Play className="size-5 fill-current" />
                </span>
              </span>
            </button>
          )}
        </div>
      ) : null}

      <div className="space-y-2 p-3">
        <p className="text-sm font-black text-foreground">{title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/60">
          {video.event && video.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {video.location}
            </span>
          )}
          {video.recordedOn && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {formatDay(video.recordedOn, intlLocale)}
            </span>
          )}
        </div>
        {video.notes && (
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground/75">
            {video.notes}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              size: "sm",
              variant: embed ? "ghost" : "default",
            })}
          >
            <ExternalLink className="size-3.5" />
            {linkLabel(video.videoUrl)}
          </a>
          {canEdit && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onEdit}
              >
                <Pencil className="size-3.5" />
                {tx("editar")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={deleting}
                onClick={onDelete}
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {tx("borrar")}
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function VideoForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
  onSaved,
}: {
  initial: FormValues;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: FormValues) => Promise<VideoActionResult>;
  onSaved: (video: StudentVideoItem) => void;
}) {
  const tx = useTranslations("ui.s_app_studentvideospanel");
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = normalizeVideoUrl(values.videoUrl);
  const thumbnail = link ? getYouTubeThumbnailUrl(link.url) : null;
  const set = (key: keyof FormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  // No es un <form>: el panel también vive dentro del formulario «Editar
  // alumno», y un formulario dentro de otro no es válido. Enter en un campo
  // guarda la ficha, no el alumno.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      void handleSubmit();
    }
  }

  async function handleSubmit() {
    if (!link) {
      setError(tx("pegaUnEnlaceValido"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await onSubmit({ ...values, videoUrl: link.url });
      if (!res.ok) {
        setError(
          res.error === "Forbidden" || res.error === "Unauthorized"
            ? tx("noTienesPermisoPara")
            : res.error === "Not found" || res.error === "Invalid input"
              ? tx("noSePudoGuardar")
              : res.error
        );
        return;
      }
      onSaved(res.video);
    } catch {
      setError(tx("noSePudoGuardar2"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onKeyDown={onKeyDown}
      className="space-y-3 rounded-2xl border border-dashed border-[#050505]/15 p-3 dark:border-white/15"
    >
      <div className="space-y-1.5">
        <Label htmlFor="video-url">{tx("enlaceAlVideo")}</Label>
        <Input
          id="video-url"
          type="url"
          inputMode="url"
          required
          placeholder={tx("httpsYoutuBeO")}
          value={values.videoUrl}
          maxLength={2000}
          onChange={set("videoUrl")}
          aria-invalid={values.videoUrl.trim() !== "" && !link}
        />
        {values.videoUrl.trim() !== "" && !link && (
          <p className="text-xs text-destructive">
            {tx("elEnlaceNoEs")}
          </p>
        )}
        {link && link.kind === "drive" && (
          <p className="text-xs text-foreground/55">
            {tx("enlaceDeGoogleDrive")}
          </p>
        )}
        {thumbnail && (
          <img
            src={thumbnail}
            alt={tx("vistaPreviaDelVideo")}
            className="mt-2 aspect-video w-full max-w-xs rounded-xl object-cover"
          />
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="video-event">{tx("eventoTorneo")}</Label>
          <Input
            id="video-event"
            value={values.event}
            maxLength={200}
            placeholder={tx("ejTorneoJuvenilDe")}
            onChange={set("event")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="video-location">{tx("lugarDeGrabacion")}</Label>
          <Input
            id="video-location"
            value={values.location}
            maxLength={200}
            placeholder={tx("ejClubDeTenis")}
            onChange={set("location")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="video-date">{tx("fecha")}</Label>
          <Input
            id="video-date"
            type="date"
            value={values.recordedOn}
            onChange={set("recordedOn")}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="video-notes">{tx("observaciones")}</Label>
        <Textarea
          id="video-notes"
          value={values.notes}
          maxLength={2000}
          rows={3}
          placeholder={tx("queSeVeEn")}
          onChange={set("notes")}
        />
      </div>
      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={() => void handleSubmit()}
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {submitLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          {tx("cancelar")}
        </Button>
      </div>
    </div>
  );
}
