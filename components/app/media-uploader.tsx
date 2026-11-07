"use client";

/* eslint-disable @next/next/no-img-element -- Dynamic upload/blob previews cannot be optimized reliably by next/image. */

import { useState, useRef, useEffect, DragEvent, KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Upload,
  Search,
  Link2,
  X,
  ImageIcon,
  Loader2,
  Check,
  ExternalLink,
  PenTool,
} from "lucide-react";
import { isDrawingUrl } from "@/lib/court-board";
import { cn } from "@/lib/utils";

type Tab = "upload" | "drawings" | "stock" | "url";

interface MyDrawing {
  id: string;
  title: string;
  imageUrl: string;
}

interface PexelsPhoto {
  id: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  src: { small: string; medium: string; large: string };
}

export interface MediaUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Path inside the bucket, without extension. E.g. "exercises/uuid/image" */
  storagePath: string;
  bucket?: string;
  label?: string;
  /** Pre-fill stock search box */
  searchSuggestion?: string;
}

export function MediaUploader({
  value,
  onChange,
  storagePath,
  bucket = "exercise-media",
  label = "Imagen",
  searchSuggestion = "deportes de raqueta",
}: MediaUploaderProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("upload");

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stock search
  const [searchQuery, setSearchQuery] = useState(searchSuggestion);
  const [searching, setSearching] = useState(false);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [stockError, setStockError] = useState<string | null>(null);

  // Mis dibujos (pizarra de Recursos)
  const [drawings, setDrawings] = useState<MyDrawing[] | null>(null);
  const [drawingsError, setDrawingsError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "drawings" || drawings !== null) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/resources");
        if (!res.ok) throw new Error("failed");
        const json = (await res.json()) as {
          data: Array<{ id: string; title: string; imageUrl: string | null }>;
        };
        if (!active) return;
        setDrawings(
          json.data
            .filter((r) => isDrawingUrl(r.imageUrl))
            .map((r) => ({
              id: r.id,
              title: r.title,
              imageUrl: r.imageUrl as string,
            }))
        );
      } catch {
        if (active) setDrawingsError("No se pudieron cargar tus dibujos.");
      }
    })();
    return () => {
      active = false;
    };
  }, [tab, drawings]);

  // URL
  const [urlInput, setUrlInput] = useState(value ?? "");

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Solo se admiten imágenes (JPG, PNG, WebP…)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("El archivo no puede superar 8 MB");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${storagePath}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setUploadError(error.message);
      setUploading(false);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(publicUrl);
    setOpen(false);
    setUploading(false);
  }

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setStockError(null);
    try {
      const res = await fetch(
        `/api/stock-images?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (data.error) {
        setStockError(data.error);
        setPhotos([]);
      } else setPhotos(data.photos ?? []);
    } catch {
      setStockError("Error al conectar con la API de imágenes");
    } finally {
      setSearching(false);
    }
  }

  function handleSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  function selectStock(photo: PexelsPhoto) {
    onChange(photo.src.large);
    setOpen(false);
  }

  function applyUrl() {
    const u = urlInput.trim();
    if (u) {
      onChange(u);
      setOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-foreground">
        {label}
      </label>

      {/* Preview / empty state */}
      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-border aspect-video max-h-52 bg-muted">
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setUrlInput(value);
              }}
              className="text-xs font-semibold text-white bg-white/20 backdrop-blur px-3 py-1.5 rounded-lg hover:bg-white/30 transition-colors"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs font-semibold text-white bg-destructive/60 backdrop-blur px-3 py-1.5 rounded-lg hover:bg-destructive/80 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full border-2 border-dashed border-border rounded-xl py-6 flex flex-col items-center gap-2 hover:border-brand/50 hover:bg-brand/5 transition-colors text-muted-foreground hover:text-brand group"
        >
          <ImageIcon className="size-7 group-hover:scale-110 transition-transform" />
          <div className="text-center">
            <p className="text-sm font-medium">Añadir imagen</p>
            <p className="text-xs opacity-70">
              Sube un archivo, busca en stock o pega una URL
            </p>
          </div>
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-lg">
          {/* Tab bar */}
          <div className="flex border-b border-border bg-muted/30">
            {(
              [
                { id: "upload" as Tab, label: "Subir archivo", icon: Upload },
                { id: "drawings" as Tab, label: "Mis dibujos", icon: PenTool },
                {
                  id: "stock" as Tab,
                  label: "Banco de imágenes",
                  icon: Search,
                },
                { id: "url" as Tab, label: "URL", icon: Link2 },
              ] as const
            ).map(({ id, label: lbl, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2",
                  tab === id
                    ? "text-brand border-brand bg-background"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{lbl}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 text-muted-foreground hover:text-foreground transition-colors border-l border-border"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="p-4">
            {/* ─── Upload ─── */}
            {tab === "upload" && (
              <div className="space-y-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none",
                    dragOver
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-border hover:border-brand/40 hover:bg-muted/40 text-muted-foreground"
                  )}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-7 animate-spin text-brand" />
                      <p className="text-sm font-medium text-brand">
                        Subiendo imagen…
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="size-7" />
                      <p className="text-sm font-medium">
                        Arrastra o haz clic para elegir
                      </p>
                      <p className="text-xs opacity-60">
                        JPG, PNG, WebP · Máx. 8 MB
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                  }}
                />
                {uploadError && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    {uploadError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Necesitas el bucket{" "}
                  <code className="bg-muted px-1 rounded">exercise-media</code>{" "}
                  (público) en Supabase Storage.
                </p>
              </div>
            )}

            {/* ─── Mis dibujos ─── */}
            {tab === "drawings" && (
              <div className="space-y-3">
                {drawingsError && (
                  <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    {drawingsError}
                  </p>
                )}
                {drawings === null && !drawingsError && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {drawings !== null && drawings.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Aún no tienes dibujos. Crea uno en Recursos con «Nueva
                    pizarra».
                  </p>
                )}
                {drawings !== null && drawings.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {drawings.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          onChange(d.imageUrl);
                          setOpen(false);
                        }}
                        className="group overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-brand"
                      >
                        <img
                          src={d.imageUrl}
                          alt={d.title}
                          className="aspect-[3/4] w-full object-cover"
                        />
                        <span className="block truncate px-2 py-1 text-[11px] font-medium">
                          {d.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Stock search ─── */}
            {tab === "stock" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKey}
                    placeholder="Ej: raqueta, entrenamiento, pista"
                    className="flex-1 h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={searching}
                    className="h-9 px-4 bg-brand text-brand-foreground text-xs font-semibold rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-60 flex items-center gap-1.5 shrink-0"
                  >
                    {searching ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
                    Buscar
                  </button>
                </div>

                {stockError ? (
                  <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                    {stockError}
                  </div>
                ) : photos.length > 0 ? (
                  <div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => selectStock(photo)}
                          className="relative aspect-video rounded-lg overflow-hidden group hover:ring-2 hover:ring-brand transition-all"
                        >
                          <img
                            src={photo.src.small}
                            alt={photo.alt}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Check className="size-5 text-white drop-shadow" />
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        Fotos por{" "}
                        <a
                          href="https://www.pexels.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-brand inline-flex items-center gap-0.5"
                        >
                          Pexels <ExternalLink className="size-2.5" />
                        </a>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Search className="size-7 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Busca fotos gratuitas de alta calidad
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Añade{" "}
                      <code className="bg-muted px-1 rounded">
                        PEXELS_API_KEY
                      </code>{" "}
                      al .env para activar
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ─── URL ─── */}
            {tab === "url" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    URL de la imagen
                  </label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyUrl()}
                    placeholder="https://…"
                    className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                {urlInput && (
                  <div className="rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                    <img
                      src={urlInput}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={applyUrl}
                  disabled={!urlInput.trim()}
                  className="w-full h-9 bg-brand text-brand-foreground text-sm font-semibold rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-40"
                >
                  Usar esta imagen
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
