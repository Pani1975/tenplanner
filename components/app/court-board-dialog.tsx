"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CircleDot,
  Download,
  Eraser,
  Loader2,
  Move,
  Pencil,
  Save,
  Trash2,
  Triangle,
  Type,
  Undo2,
  User,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { embedPngText, readPngText } from "@/lib/png-text";
import { cn } from "@/lib/utils";
import type { ResourceData } from "@/components/app/resource-form-dialog";
import {
  COURT,
  COURT_VIEWBOX,
  DRAWINGS_FOLDER,
  arrowHead,
  distance,
  distanceToShape,
  drawingDataUrl,
  hitTest,
  translateShape,
  type DragPart,
  isDrawingUrl,
  parseBoardDoc,
  type BoardDoc,
  type CourtMode,
  type Pt,
  type Shape,
} from "@/lib/court-board";

const RESOURCES_BUCKET = "resources";
const BOARD_KEY = "tenplanner-board";

type Tool =
  | "select"
  | "move"
  | "ball-path"
  | "free"
  | "alumno"
  | "monitor"
  | "cone"
  | "ball"
  | "text"
  | "erase";

const TOOLS: { id: Tool; label: string; icon: typeof Pencil }[] = [
  { id: "select", label: "Mover", icon: Move },
  { id: "move", label: "Movimiento", icon: ArrowRight },
  { id: "ball-path", label: "Trayectoria", icon: ArrowRight },
  { id: "free", label: "Lápiz", icon: Pencil },
  { id: "alumno", label: "Alumno", icon: User },
  { id: "monitor", label: "Monitor", icon: UserRound },
  { id: "cone", label: "Cono", icon: Triangle },
  { id: "ball", label: "Pelota", icon: CircleDot },
  { id: "text", label: "Texto", icon: Type },
  { id: "erase", label: "Borrar", icon: Eraser },
];

const COLORS = {
  surround: "#3d8b5a",
  court: "#2f6fa8",
  line: "#ffffff",
  move: "#ffd23f",
  path: "#ffffff",
  alumno: "#f0902f",
  monitor: "#d94a3d",
  cone: "#ffd23f",
  ball: "#d6ff38",
};

function ShapeView({ s }: { s: Shape }) {
  switch (s.t) {
    case "arrow": {
      const color = s.dashed ? COLORS.path : COLORS.move;
      return (
        <g>
          <line
            x1={s.a[0]}
            y1={s.a[1]}
            x2={s.b[0]}
            y2={s.b[1]}
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={s.dashed ? "2 11" : undefined}
          />
          <polygon
            points={arrowHead(s.a, s.b)}
            fill={color}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </g>
      );
    }
    case "free":
      return (
        <polyline
          points={s.pts.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={COLORS.move}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "alumno":
      return (
        <g>
          <circle
            cx={s.at[0]}
            cy={s.at[1]}
            r={15}
            fill={COLORS.alumno}
            stroke="#fff"
            strokeWidth={3}
          />
          <text
            x={s.at[0]}
            y={s.at[1] + 5}
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fill="#1b1306"
            fontFamily="system-ui, sans-serif"
          >
            {s.n}
          </text>
        </g>
      );
    case "monitor":
      return (
        <g>
          <circle
            cx={s.at[0]}
            cy={s.at[1]}
            r={15}
            fill={COLORS.monitor}
            stroke="#fff"
            strokeWidth={3}
          />
          <text
            x={s.at[0]}
            y={s.at[1] + 5}
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fill="#fff"
            fontFamily="system-ui, sans-serif"
          >
            M
          </text>
        </g>
      );
    case "cone":
      return (
        <polygon
          points={`${s.at[0]},${s.at[1] - 11} ${s.at[0] - 10},${s.at[1] + 9} ${s.at[0] + 10},${s.at[1] + 9}`}
          fill={COLORS.cone}
          stroke="#7a5b00"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      );
    case "ball":
      return (
        <circle
          cx={s.at[0]}
          cy={s.at[1]}
          r={7}
          fill={COLORS.ball}
          stroke="#4a5d00"
          strokeWidth={2}
        />
      );
    case "text":
      return (
        <text
          x={s.at[0]}
          y={s.at[1]}
          textAnchor="middle"
          fontSize={20}
          fontWeight={700}
          fill="#fff"
          stroke="#0f2a44"
          strokeWidth={4}
          paintOrder="stroke"
          fontFamily="system-ui, sans-serif"
        >
          {s.text}
        </text>
      );
  }
}

function CourtLines() {
  const stroke = { stroke: COLORS.line, strokeWidth: 3, fill: "none" } as const;
  return (
    <g>
      <rect x={0} y={0} width={400} height={800} fill={COLORS.surround} />
      <rect
        x={COURT.left}
        y={COURT.top}
        width={COURT.right - COURT.left}
        height={COURT.bottom - COURT.top}
        {...stroke}
        fill={COLORS.court}
      />
      <line
        x1={COURT.singlesLeft}
        y1={COURT.top}
        x2={COURT.singlesLeft}
        y2={COURT.bottom}
        {...stroke}
      />
      <line
        x1={COURT.singlesRight}
        y1={COURT.top}
        x2={COURT.singlesRight}
        y2={COURT.bottom}
        {...stroke}
      />
      <line
        x1={COURT.singlesLeft}
        y1={COURT.serviceTop}
        x2={COURT.singlesRight}
        y2={COURT.serviceTop}
        {...stroke}
      />
      <line
        x1={COURT.singlesLeft}
        y1={COURT.serviceBottom}
        x2={COURT.singlesRight}
        y2={COURT.serviceBottom}
        {...stroke}
      />
      <line
        x1={COURT.center}
        y1={COURT.serviceTop}
        x2={COURT.center}
        y2={COURT.serviceBottom}
        {...stroke}
      />
      <line
        x1={COURT.center}
        y1={COURT.top}
        x2={COURT.center}
        y2={COURT.top + 10}
        {...stroke}
      />
      <line
        x1={COURT.center}
        y1={COURT.bottom}
        x2={COURT.center}
        y2={COURT.bottom - 10}
        {...stroke}
      />
      <line
        x1={COURT.left - 14}
        y1={COURT.net}
        x2={COURT.right + 14}
        y2={COURT.net}
        stroke="#e8eef5"
        strokeWidth={6}
        strokeDasharray="3 5"
      />
    </g>
  );
}

export function CourtBoardDialog({
  open,
  onOpenChange,
  userId,
  resource,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Si se pasa un dibujo ya guardado, se abre para retocarlo. */
  resource?: ResourceData | null;
  onSaved: (resource: ResourceData) => void;
}) {
  const editing = resource && isDrawingUrl(resource.imageUrl) ? resource : null;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [court, setCourt] = useState<CourtMode>("full");
  const [shapes, setShapes] = useState<Shape[]>([]);
  // Estados anteriores, para que "Deshacer" revierta cualquier cambio.
  const [past, setPast] = useState<Shape[][]>([]);
  const [tool, setTool] = useState<Tool>(editing ? "select" : "move");
  const [dragging, setDragging] = useState(false);
  const [textValue, setTextValue] = useState("Saque");
  const [preview, setPreview] = useState<Shape | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(!!editing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const startRef = useRef<Pt | null>(null);
  const freeRef = useRef<Pt[]>([]);
  const dragRef = useRef<{
    index: number;
    part: DragPart;
    last: Pt;
    started: boolean;
  } | null>(null);

  const vb = COURT_VIEWBOX[court];

  /** Aplica un cambio guardando antes el estado actual para poder deshacerlo. */
  function change(fn: (prev: Shape[]) => Shape[]) {
    setPast((h) => [...h.slice(-49), shapes]);
    setShapes(fn);
  }

  function undo() {
    const last = past[past.length - 1];
    if (!last) return;
    setPast((h) => h.slice(0, -1));
    setShapes(last);
  }

  // Al retocar un dibujo, recupera sus datos editables.
  useEffect(() => {
    if (!editing?.imageUrl) return;
    let active = true;
    (async () => {
      try {
        // Los trazos viajan dentro del propio PNG.
        const res = await fetch(editing.imageUrl!);
        if (!res.ok) throw new Error("no data");
        const text = readPngText(
          new Uint8Array(await res.arrayBuffer()),
          BOARD_KEY
        );
        let doc = text ? parseBoardDoc(JSON.parse(text)) : null;
        if (!doc) {
          // Dibujos guardados con la primera versión: trazos en un .json aparte.
          const legacy = await fetch(drawingDataUrl(editing.imageUrl!));
          if (legacy.ok) doc = parseBoardDoc(await legacy.json());
        }
        if (!doc) throw new Error("bad data");
        if (active) {
          setShapes(doc.shapes);
          setCourt(doc.court);
        }
      } catch {
        if (active)
          setMessage(
            "Este dibujo se guardó sin trazos editables. Puedes dibujar uno nuevo y guardarlo encima."
          );
      } finally {
        if (active) setLoadingDoc(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editing?.imageUrl]);

  function toPoint(e: React.PointerEvent<SVGSVGElement>): Pt | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return [Math.round(p.x), Math.round(p.y)];
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const p = toPoint(e);
    if (!p) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setMessage(null);

    switch (tool) {
      case "select": {
        const hit = hitTest(p, shapes);
        if (hit) {
          dragRef.current = {
            index: hit.index,
            part: hit.part,
            last: p,
            started: false,
          };
          setDragging(true);
        }
        break;
      }
      case "move":
      case "ball-path":
        startRef.current = p;
        setPreview({ t: "arrow", a: p, b: p, dashed: tool === "ball-path" });
        break;
      case "free":
        freeRef.current = [p];
        setPreview({ t: "free", pts: [p] });
        break;
      case "alumno":
        change((prev) => {
          const n =
            prev.reduce(
              (max, s) => (s.t === "alumno" ? Math.max(max, s.n) : max),
              0
            ) + 1;
          return [...prev, { t: "alumno", at: p, n }];
        });
        break;
      case "monitor":
        change((prev) => [...prev, { t: "monitor", at: p }]);
        break;
      case "cone":
        change((prev) => [...prev, { t: "cone", at: p }]);
        break;
      case "ball":
        change((prev) => [...prev, { t: "ball", at: p }]);
        break;
      case "text":
        if (textValue.trim())
          change((prev) => [
            ...prev,
            { t: "text", at: p, text: textValue.trim().slice(0, 24) },
          ]);
        break;
      case "erase": {
        let best = -1;
        let bestD = 26;
        shapes.forEach((s, i) => {
          const d = distanceToShape(p, s);
          if (d <= bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best >= 0) change((prev) => prev.filter((_, i) => i !== best));
        break;
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (drag) {
      const q = toPoint(e);
      if (!q) return;
      const dx = q[0] - drag.last[0];
      const dy = q[1] - drag.last[1];
      if (dx === 0 && dy === 0) return;
      drag.last = q;
      // El estado previo se guarda al empezar a mover, no al solo tocar.
      if (!drag.started) {
        drag.started = true;
        setPast((h) => [...h.slice(-49), shapes]);
      }
      setShapes((prev) =>
        prev.map((s, i) =>
          i === drag.index ? translateShape(s, dx, dy, drag.part) : s
        )
      );
      return;
    }
    if (!preview) return;
    const p = toPoint(e);
    if (!p) return;
    if (preview.t === "arrow" && startRef.current) {
      setPreview({ ...preview, b: p });
    } else if (preview.t === "free") {
      const last = freeRef.current[freeRef.current.length - 1];
      if (!last || distance(last, p) > 3) {
        freeRef.current.push(p);
        setPreview({ t: "free", pts: [...freeRef.current] });
      }
    }
  }

  function onPointerUp() {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
    }
    if (preview) {
      if (preview.t === "arrow" && distance(preview.a, preview.b) > 14) {
        change((prev) => [...prev, preview]);
      } else if (preview.t === "free" && preview.pts.length > 2) {
        change((prev) => [...prev, preview]);
      }
    }
    setPreview(null);
    startRef.current = null;
    freeRef.current = [];
  }

  async function renderPng(): Promise<Blob> {
    const svg = svgRef.current;
    if (!svg) throw new Error("No hay dibujo");
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const width = 800;
    const height = Math.round((width * vb.h) / vb.w);
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo generar la imagen"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo generar la imagen");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No se pudo generar la imagen")),
        "image/png"
      )
    );
  }

  async function handleDownload() {
    setError(null);
    try {
      const blob = await renderPng();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title.trim() || "pizarra"}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo descargar la imagen"
      );
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Ponle un nombre al dibujo para guardarlo.");
      return;
    }
    if (shapes.length === 0) {
      setError("Dibuja algo antes de guardar.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const plain = await renderPng();
      const doc: BoardDoc = { v: 1, sport: "tenis", court, shapes };
      const png = new Blob(
        [
          embedPngText(
            new Uint8Array(await plain.arrayBuffer()),
            BOARD_KEY,
            JSON.stringify(doc)
          ),
        ],
        { type: "image/png" }
      );
      const base = `${userId}/${DRAWINGS_FOLDER}/${Date.now()}`;
      const supabase = createClient();

      const { error: pngErr } = await supabase.storage
        .from(RESOURCES_BUCKET)
        .upload(`${base}.png`, png, { contentType: "image/png", upsert: true });
      if (pngErr) throw pngErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from(RESOURCES_BUCKET).getPublicUrl(`${base}.png`);

      const res = await fetch(
        editing ? `/api/resources/${editing.id}` : "/api/resources",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: "Dibujo de la pizarra de pista",
            imageUrl: publicUrl,
          }),
        }
      );
      if (!res.ok) throw new Error("No se pudo guardar el recurso");
      const json = (await res.json()) as { data: ResourceData };
      onSaved(json.data);

      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el dibujo");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar dibujo" : "Pizarra de pista"}
          </DialogTitle>
          <DialogDescription>
            Dibuja el ejercicio sobre la pista. Puedes guardarlo en tus
            recursos, descargarlo como imagen o cerrarlo sin guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            id="court-board-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre del dibujo (p. ej. Cruzado de derecha)"
            maxLength={120}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border border-foreground/10 bg-background p-1">
              {(
                [
                  { id: "full" as CourtMode, label: "Pista completa" },
                  { id: "half" as CourtMode, label: "Media pista" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCourt(id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-black transition-colors",
                    court === id
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={undo}
                disabled={past.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/10 px-3 text-xs font-bold disabled:opacity-40"
              >
                <Undo2 className="size-3.5" /> Deshacer
              </button>
              <button
                type="button"
                onClick={() => change(() => [])}
                disabled={shapes.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/10 px-3 text-xs font-bold disabled:opacity-40"
              >
                <Trash2 className="size-3.5" /> Limpiar
              </button>
            </div>
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            role="toolbar"
            aria-label="Herramientas"
          >
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                aria-pressed={tool === id}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                  tool === id
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-foreground/10 text-foreground hover:border-brand/40"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {tool === "text" && (
            <input
              id="court-board-text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Texto a colocar (toca la pista)"
              maxLength={24}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          )}

          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-foreground/10 bg-muted">
            {loadingDoc && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                <Loader2 className="size-6 animate-spin" />
              </div>
            )}
            <svg
              ref={svgRef}
              viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
              role="img"
              aria-label="Pista de tenis para dibujar"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "62vh",
                display: "block",
                touchAction: "none",
                cursor:
                  tool === "select"
                    ? dragging
                      ? "grabbing"
                      : "grab"
                    : tool === "erase"
                      ? "pointer"
                      : "crosshair",
              }}
            >
              <CourtLines />
              {shapes.map((s, i) => (
                <ShapeView key={i} s={s} />
              ))}
              {preview && <ShapeView s={preview} />}
            </svg>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Mover: arrastra una figura (en una flecha, un extremo para girarla)
            · Movimiento: flecha continua · Trayectoria: flecha de puntos ·
            Borrar: toca una figura
          </p>

          {message && (
            <p className="text-sm font-medium text-foreground/80">{message}</p>
          )}
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-full border border-foreground/10 px-4 text-sm font-bold"
            >
              Cerrar sin guardar
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={shapes.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-foreground/10 px-4 text-sm font-bold disabled:opacity-40"
            >
              <Download className="size-4" /> Descargar imagen
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Guardar en mis recursos
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
