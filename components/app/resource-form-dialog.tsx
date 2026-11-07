"use client";

import { useRef, useState } from "react";
import {
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

export interface ResourceData {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  documentUrl: string | null;
  documentName: string | null;
  imageUrl: string | null;
  isFavorite: boolean;
  createdAt: string;
  /** Autor del recurso (en el espacio del club hay recursos de varios). */
  userId?: string;
  authorName?: string;
  clubId?: string | null;
}

const RESOURCES_BUCKET = "resources";

export function ResourceFormDialog({
  open,
  onOpenChange,
  userId,
  resource,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  resource?: ResourceData | null;
  onSaved: (resource: ResourceData) => void;
}) {
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    resource?.imageUrl ?? null
  );
  const [documentUrl, setDocumentUrl] = useState<string | null>(
    resource?.documentUrl ?? null
  );
  const [documentName, setDocumentName] = useState<string | null>(
    resource?.documentName ?? null
  );

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const valid = title.trim().length > 0;

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Solo se admiten imágenes");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("La imagen no puede superar 8 MB");
      return;
    }
    setUploadingImage(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/img-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from(RESOURCES_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
      setImageUrl(publicUrl);
    } catch (e: unknown) {
      setUploadError(
        e instanceof Error ? e.message : "No se pudo subir la imagen"
      );
    } finally {
      setUploadingImage(false);
    }
  }

  async function uploadDocument(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      setUploadError("El documento no puede superar 15 MB");
      return;
    }
    setUploadingDoc(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${userId}/doc-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from(RESOURCES_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
      if (uploadErr) throw uploadErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
      setDocumentUrl(publicUrl);
      setDocumentName(file.name);
    } catch (e: unknown) {
      setUploadError(
        e instanceof Error ? e.message : "No se pudo subir el documento"
      );
    } finally {
      setUploadingDoc(false);
    }
  }

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        documentUrl,
        documentName,
        imageUrl,
      };
      const res = await fetch(
        resource ? `/api/resources/${resource.id}` : "/api/resources",
        {
          method: resource ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        setError("No se pudo guardar el recurso. Inténtalo de nuevo.");
        return;
      }
      const json = (await res.json()) as { data: ResourceData };
      onOpenChange(false);
      onSaved(json.data);
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {resource ? "Editar recurso" : "Nuevo recurso"}
          </DialogTitle>
          <DialogDescription>
            Enlaces, documentos o imágenes útiles para tu labor como monitor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="resource-title"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Título
            </label>
            <input
              id="resource-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder="Ej: Guía PMV nivel iniciación"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="resource-description"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Descripción
            </label>
            <textarea
              id="resource-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Para qué sirve este recurso (opcional)"
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="resource-url"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              <Link2 className="inline size-3 mr-1 -mt-0.5" />
              Enlace
            </label>
            <input
              id="resource-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Documento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Documento
              </label>
              {documentUrl ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                  <FileText className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {documentName ?? "Documento"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentUrl(null);
                      setDocumentName(null);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={uploadingDoc}
                  className="flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-brand/50 hover:bg-brand/5 hover:text-brand disabled:opacity-60"
                >
                  {uploadingDoc ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Paperclip className="size-5" />
                  )}
                  <span className="text-xs font-medium">Subir archivo</span>
                </button>
              )}
              <input
                ref={docInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDocument(f);
                }}
              />
            </div>

            {/* Imagen */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Imagen
              </label>
              {imageUrl ? (
                <div className="relative h-20 w-full overflow-hidden rounded-xl border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded/external url */}
                  <img
                    src={imageUrl}
                    alt="Vista previa"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex h-20 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-brand/50 hover:bg-brand/5 hover:text-brand disabled:opacity-60"
                >
                  {uploadingImage ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <ImageIcon className="size-5" />
                  )}
                  <span className="text-xs font-medium">Subir imagen</span>
                </button>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadImage(f);
                }}
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {uploadError}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Necesitas el bucket{" "}
            <code className="bg-muted px-1 rounded">resources</code> (público)
            en Supabase Storage.
          </p>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!valid || saving}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-bold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : resource ? (
                <Save className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {resource ? "Guardar cambios" : "Crear recurso"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
