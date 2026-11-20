"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Camera,
  Eye,
  EyeOff,
  Globe,
  ImagePlus,
  Loader2,
  Lock,
  Newspaper,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useApiError } from "../use-api-error";
import { useTournamentApi } from "../tournament-api";

type News = {
  id: string;
  title: string;
  body: string;
  authorType: "organizer" | "club";
  authorName: string;
  publishedAt: string | null;
};
type Person = {
  entryId: string;
  side: "player" | "partner";
  name: string;
  image: "yes" | "no" | "unknown";
};
type Photo = {
  id: string;
  url: string | null;
  caption: string | null;
  published: boolean;
  tags: Person[];
};

const key = (p: { entryId: string; side: string }) => `${p.entryId}:${p.side}`;

/** Modo prueba (sin cuenta): fotos y noticias por torneo. */
const GUEST_LIMIT = 5;

async function getData<T>(
  doFetch: (input: string) => Promise<Response>,
  url: string
): Promise<T | null> {
  const res = await doFetch(url);
  return res.ok ? ((await res.json()).data as T) : null;
}

/** Reduce la foto en el móvil (lado mayor 2000 px, WebP) antes de subirla. */
async function compress(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/webp", 0.82)
  );
  if (!blob) throw new Error("compress");
  return { blob, width, height };
}

/**
 * Noticias y fotos del torneo (gestión). Las noticias llevan autor (club u
 * organizador). Las fotos se etiquetan con inscritos; al publicar se avisa
 * de quién no tiene autorización de imagen, sin bloquear.
 */
export function MediaPanel({
  tournamentId,
  photosPublic,
  isPublic,
}: {
  tournamentId: string;
  photosPublic: boolean;
  isPublic: boolean;
}) {
  return (
    <div className="space-y-6">
      <NewsSection tournamentId={tournamentId} />
      <PhotosSection
        tournamentId={tournamentId}
        photosPublic={photosPublic}
        isPublic={isPublic}
      />
    </div>
  );
}

function NewsSection({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("tournaments.media");
  const apiError = useApiError();
  const api = useTournamentApi();
  const [items, setItems] = useState<News[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<News | null>(null);

  const fetchNews = useCallback(
    () => getData<News[]>(api.fetch, `/api/tournaments/${tournamentId}/news`),
    [tournamentId, api]
  );
  const load = async () => {
    const d = await fetchNews();
    if (d) setItems(d);
  };
  useEffect(() => {
    let on = true;
    fetchNews().then((d) => on && d && setItems(d));
    return () => {
      on = false;
    };
  }, [fetchNews]);

  async function create(publish: boolean) {
    setBusy(publish ? "publish" : "draft");
    const res = await api.fetch(`/api/tournaments/${tournamentId}/news`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, publish }),
    });
    setBusy(null);
    if (!res.ok) return toast.error(await apiError(res));
    setTitle("");
    setBody("");
    toast.success(t(publish ? "newsPublished" : "newsSaved"));
    load();
  }

  async function patch(n: News, published: boolean) {
    setBusy(n.id);
    const res = await api.fetch(
      `/api/tournaments/${tournamentId}/news/${n.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published }),
      }
    );
    setBusy(null);
    if (!res.ok) return toast.error(await apiError(res));
    load();
  }

  async function remove(n: News) {
    const res = await api.fetch(
      `/api/tournaments/${tournamentId}/news/${n.id}`,
      {
        method: "DELETE",
      }
    );
    if (!res.ok) return toast.error(await apiError(res));
    toast.success(t("newsDeleted"));
    load();
  }

  // Modo prueba: como mucho 5 noticias.
  const atLimit = api.guest && (items?.length ?? 0) >= GUEST_LIMIT;
  const canSend = title.trim() && body.trim() && !busy && !atLimit;
  return (
    <section className="space-y-3">
      <h2 className="tp-title flex items-center gap-2 text-2xl">
        <Newspaper className="size-5" />
        {t("newsTitle")}
        {api.guest && (
          <span className="text-sm font-normal text-foreground/60">
            ({items?.length ?? 0}/{GUEST_LIMIT})
          </span>
        )}
      </h2>
      {atLimit && (
        <p className="text-sm text-foreground/70">
          {t("guestNewsLimit", { max: GUEST_LIMIT })}
        </p>
      )}
      <div className="tp-card-soft space-y-3 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder={t("newsTitlePlaceholder")}
          aria-label={t("newsTitlePlaceholder")}
          className="tp-field h-11 w-full px-4 text-base"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={4}
          placeholder={t("newsBodyPlaceholder")}
          aria-label={t("newsBodyPlaceholder")}
          className="tp-field w-full px-4 py-3 text-base"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={!canSend}
            onClick={() => create(false)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-background px-5 text-sm font-bold disabled:opacity-50"
          >
            {busy === "draft" && <Loader2 className="size-4 animate-spin" />}
            {t("saveDraft")}
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => create(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black disabled:opacity-50"
          >
            {busy === "publish" && <Loader2 className="size-4 animate-spin" />}
            {t("publish")}
          </button>
        </div>
      </div>

      {items === null ? (
        <Loader2 className="size-5 animate-spin text-foreground/50" />
      ) : items.length === 0 ? (
        <p className="text-sm text-foreground/70">{t("newsEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="tp-card-soft space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{n.title}</p>
                  <p className="text-xs text-foreground/60">
                    {t(`author.${n.authorType}`, { name: n.authorName })} ·{" "}
                    {n.publishedAt ? t("published") : t("draft")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => patch(n, !n.publishedAt)}
                    disabled={busy === n.id}
                    aria-label={n.publishedAt ? t("unpublish") : t("publish")}
                    title={n.publishedAt ? t("unpublish") : t("publish")}
                    className="inline-flex size-11 items-center justify-center rounded-full bg-background"
                  >
                    {busy === n.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : n.publishedAt ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(n)}
                    aria-label={t("delete")}
                    title={t("delete")}
                    className="inline-flex size-11 items-center justify-center rounded-full bg-background text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-line text-sm text-foreground/80">
                {n.body}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("newsDeleteTitle")}
        description={toDelete?.title}
        confirmLabel={t("delete")}
        destructive
        onConfirm={async () => {
          if (toDelete) await remove(toDelete);
          setToDelete(null);
        }}
      />
    </section>
  );
}

function PhotosSection({
  tournamentId,
  photosPublic,
  isPublic,
}: {
  tournamentId: string;
  photosPublic: boolean;
  isPublic: boolean;
}) {
  const t = useTranslations("tournaments.media");
  const apiError = useApiError();
  const api = useTournamentApi();
  const [data, setData] = useState<{
    people: Person[];
    photos: Photo[];
  } | null>(null);
  const [uploading, setUploading] = useState(0);
  const [showPublic, setShowPublic] = useState(photosPublic);
  const [warn, setWarn] = useState<{
    photo: Photo;
    people: { name: string }[];
  } | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(
    () =>
      getData<{ people: Person[]; photos: Photo[] }>(
        api.fetch,
        `/api/tournaments/${tournamentId}/photos`
      ),
    [tournamentId, api]
  );
  const load = async () => {
    const d = await fetchPhotos();
    if (d) setData(d);
  };
  useEffect(() => {
    let on = true;
    fetchPhotos().then((d) => on && d && setData(d));
    return () => {
      on = false;
    };
  }, [fetchPhotos]);

  // Modo prueba: como mucho 5 fotos.
  const photoCount = data?.photos.length ?? 0;
  const photoFull = api.guest && photoCount >= GUEST_LIMIT;

  async function upload(files: FileList) {
    let list = [...files];
    if (api.guest) {
      const room = Math.max(0, GUEST_LIMIT - photoCount);
      if (list.length > room) {
        toast.error(t("guestPhotoLimit", { max: GUEST_LIMIT }));
        list = list.slice(0, room);
      }
      if (!list.length) return;
    }
    setUploading(list.length);
    let failed = 0;
    for (const f of list) {
      try {
        const { blob, width, height } = await compress(f);
        const form = new FormData();
        form.append("file", new File([blob], "foto.webp", { type: blob.type }));
        form.append("width", String(width));
        form.append("height", String(height));
        const res = await api.fetch(`/api/tournaments/${tournamentId}/photos`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          failed++;
          toast.error(await apiError(res));
        }
      } catch {
        failed++;
        toast.error(t("photoReadError"));
      }
      setUploading((n) => n - 1);
    }
    if (failed < list.length) toast.success(t("photosUploaded"));
    load();
  }

  async function patch(photo: Photo, body: object) {
    const res = await api.fetch(
      `/api/tournaments/${tournamentId}/photos/${photo.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (res.status === 409) {
      const b = (await res.json()) as {
        detail?: { people?: { name: string }[] };
      };
      setWarn({ photo, people: b.detail?.people ?? [] });
      return false;
    }
    if (!res.ok) {
      toast.error(await apiError(res));
      return false;
    }
    load();
    return true;
  }

  async function togglePublic(v: boolean) {
    const res = await api.fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photosPublic: v }),
    });
    if (!res.ok) return toast.error(await apiError(res));
    setShowPublic(v);
    toast.success(t(v ? "photosPublicOn" : "photosPublicOff"));
  }

  async function remove(photo: Photo) {
    const res = await api.fetch(
      `/api/tournaments/${tournamentId}/photos/${photo.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) return toast.error(await apiError(res));
    toast.success(t("photoDeleted"));
    load();
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="tp-title flex items-center gap-2 text-2xl">
          <Camera className="size-5" />
          {t("photosTitle")}
          {api.guest && (
            <span className="text-sm font-normal text-foreground/60">
              ({photoCount}/{GUEST_LIMIT})
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading > 0 || photoFull}
          title={
            photoFull ? t("guestPhotoLimit", { max: GUEST_LIMIT }) : undefined
          }
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black disabled:opacity-60"
        >
          {uploading > 0 ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {uploading > 0 ? t("uploading", { n: uploading }) : t("addPhotos")}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="tp-card-soft space-y-2 p-4">
        <p className="text-xs font-bold uppercase text-foreground/60">
          {t("whoSees")}
        </p>
        <div
          className="grid grid-cols-2 gap-1 rounded-full bg-background p-1"
          role="group"
          aria-label={t("whoSees")}
        >
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={showPublic === v}
              onClick={() => showPublic !== v && togglePublic(v)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-2 text-sm font-bold",
                showPublic === v
                  ? "bg-[#d6f04a] text-black"
                  : "text-foreground/70"
              )}
            >
              {v ? <Globe className="size-4" /> : <Lock className="size-4" />}
              {t(v ? "seesPublic" : "seesFamilies")}
            </button>
          ))}
        </div>
        <p className="text-sm text-foreground/75">
          {showPublic && !isPublic
            ? t("seesPublicButPrivate")
            : t(showPublic ? "seesPublicHelp" : "seesFamiliesHelp")}
        </p>
      </div>

      {data === null ? (
        <Loader2 className="size-5 animate-spin text-foreground/50" />
      ) : data.photos.length === 0 ? (
        <p className="text-sm text-foreground/70">{t("photosEmpty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              people={data.people}
              onPatch={(body) => patch(p, body)}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={warn !== null}
        onOpenChange={(o) => !o && setWarn(null)}
        title={t("consentWarnTitle")}
        description={
          warn
            ? t("consentWarnText", {
                names: warn.people.map((p) => p.name).join(", "),
              })
            : undefined
        }
        confirmLabel={t("publishAnyway")}
        onConfirm={async () => {
          if (warn) {
            await patch(warn.photo, { published: true, acknowledged: true });
          }
          setWarn(null);
        }}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("photoDeleteTitle")}
        description={t("photoDeleteText")}
        confirmLabel={t("delete")}
        destructive
        onConfirm={async () => {
          if (toDelete) await remove(toDelete);
          setToDelete(null);
        }}
      />
    </section>
  );
}

function PhotoCard({
  photo: p,
  people,
  onPatch,
  onDelete,
}: {
  photo: Photo;
  people: Person[];
  onPatch: (body: object) => Promise<boolean>;
  onDelete: () => void;
}) {
  const t = useTranslations("tournaments.media");
  const [tagging, setTagging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(p.tags.map(key))
  );
  const [caption, setCaption] = useState(p.caption ?? "");
  const [busy, setBusy] = useState(false);
  const missing = p.tags.filter((x) => x.image !== "yes");

  async function run(body: object) {
    setBusy(true);
    const ok = await onPatch(body);
    setBusy(false);
    return ok;
  }

  return (
    <li className="tp-card-soft overflow-hidden">
      {p.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.url}
          alt={p.caption ?? t("photoAlt")}
          className="aspect-[4/3] w-full bg-foreground/5 object-cover"
        />
      ) : (
        <div className="aspect-[4/3] w-full bg-foreground/5" />
      )}
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold",
              p.published
                ? "bg-emerald-600 text-white"
                : "bg-foreground/10 text-foreground/70"
            )}
          >
            {p.published ? t("published") : t("notPublished")}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTagging(!tagging)}
              aria-expanded={tagging}
              aria-label={t("tag")}
              title={t("tag")}
              className="inline-flex size-11 items-center justify-center rounded-full bg-background"
            >
              <Tag className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("delete")}
              title={t("delete")}
              className="inline-flex size-11 items-center justify-center rounded-full bg-background text-red-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        {p.tags.length > 0 && (
          <p className="text-sm">
            {p.tags.map((x, i) => (
              <span key={key(x)}>
                {i > 0 && ", "}
                <span
                  className={
                    x.image !== "yes"
                      ? "text-amber-700 dark:text-amber-400"
                      : ""
                  }
                >
                  {x.name}
                </span>
              </span>
            ))}
          </p>
        )}
        {missing.length > 0 && (
          <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t("missingConsent", { n: missing.length })}
          </p>
        )}

        {tagging && (
          <div className="space-y-2 rounded-xl bg-background p-3">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              placeholder={t("captionPlaceholder")}
              aria-label={t("captionPlaceholder")}
              className="tp-field h-11 w-full px-3 text-base"
            />
            <p className="text-xs font-bold uppercase text-foreground/60">
              {t("whoAppears")}
            </p>
            {people.length === 0 ? (
              <p className="text-sm text-foreground/70">{t("noPeople")}</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {people.map((x) => (
                  <li key={key(x)}>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={selected.has(key(x))}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(key(x));
                          else next.delete(key(x));
                          setSelected(next);
                        }}
                      />
                      <span className="flex-1">{x.name}</span>
                      {x.image !== "yes" && (
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          {t(`image.${x.image}`)}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const ok = await run({
                    caption: caption.trim() || null,
                    tags: people
                      .filter((x) => selected.has(key(x)))
                      .map((x) => ({ entryId: x.entryId, side: x.side })),
                  });
                  if (ok) setTagging(false);
                }}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {t("saveTags")}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => run({ published: !p.published })}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold disabled:opacity-50",
            p.published ? "bg-background" : "bg-[#d6f04a] text-black"
          )}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : p.published ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
          {p.published ? t("unpublish") : t("publish")}
        </button>
      </div>
    </li>
  );
}
