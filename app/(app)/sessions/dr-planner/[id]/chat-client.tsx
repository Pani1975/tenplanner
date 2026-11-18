"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Plus,
  X,
  CalendarCheck,
  Trash2,
  UserPlus,
  MapPin,
  Tag,
  Flame,
  Dumbbell,
  Calendar,
  GraduationCap,
  Brain,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";
import { useLocale } from "next-intl";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "technique" | "tactics" | "fitness" | "warm-up";
type Difficulty = "beginner" | "intermediate" | "advanced";

interface ExerciseItem {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  durationMinutes: number;
  description?: string;
  objectives?: string;
  isAiGenerated?: boolean;
  isPersonal?: boolean;
}
type PreguntaTipo = "texto" | "numero" | "select";
interface Pregunta {
  id: string;
  label: string;
  tipo: PreguntaTipo;
  opciones?: string[];
  placeholder?: string;
}

interface StudentItem {
  id: string;
  name: string;
  playerLevel?: string | null;
  gender?: string | null;
  dominantHand?: string | null;
}

interface SessionMetaInput {
  objective?: string;
  intensity?: number;
  tags?: string[];
  location?: string;
  scheduledAt?: string;
  durationMinutes?: number;
}

type MentionResult =
  | {
      type: "ejercicio";
      id: string;
      name: string;
      category: string;
      durationMinutes: number;
    }
  | { type: "sesion"; id: string; title: string; scheduledAt: string }
  | { type: "alumno"; id: string; name: string; playerLevel: string | null };

interface BuscarContextoResult {
  tipo: "ejercicio" | "sesion" | "alumno";
  resultados: Array<{
    id: string;
    name?: string;
    title?: string;
    category?: string;
    difficulty?: string;
    durationMinutes?: number;
    description?: string | null;
    objectives?: string | null;
    isAiGenerated?: boolean;
    scheduledAt?: string | Date | null;
    objective?: string | null;
    playerLevel?: string | null;
    dominantHand?: string | null;
    gender?: string | null;
  }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CAT: Record<Category, { label: string; code: string }> = {
  technique: { label: "Técnica", code: "TÉC" },
  tactics: { label: "Táctica", code: "TÁC" },
  fitness: { label: "Fitness", code: "FÍS" },
  "warm-up": { label: "Calentamiento", code: "CAL" },
};
const DIFF: Record<Difficulty, { label: string; bars: number }> = {
  beginner: { label: "Principiante", bars: 2 },
  intermediate: { label: "Intermedio", bars: 3 },
  advanced: { label: "Avanzado", bars: 5 },
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  amateur: "Amateur",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  competitive: "Competición",
};

const LEVEL_CODE: Record<string, string> = {
  beginner: "L1",
  amateur: "L2",
  intermediate: "L3",
  advanced: "L4",
  competitive: "L5",
};

const STREAM_CONNECT_TIMEOUT_MS = 45_000;

async function fetchWithChatTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    STREAM_CONNECT_TIMEOUT_MS
  );

  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => timeoutController.abort();

  if (upstreamSignal) {
    if (upstreamSignal.aborted) timeoutController.abort();
    else
      upstreamSignal.addEventListener("abort", abortFromUpstream, {
        once: true,
      });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: timeoutController.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (upstreamSignal) {
      upstreamSignal.removeEventListener("abort", abortFromUpstream);
    }
  }
}

// ─── Mention chip (inline in user messages) ──────────────────────────────────

// Matches both @[nombre] (new) and @[tipo:nombre] (legacy stored messages)
const MENTION_RE = /(@\[(?:(?:ejercicio|sesion|alumno):)?[^\]]+\])/g;

function parseMentionName(part: string): string | null {
  const legacy = part.match(/^@\[(?:ejercicio|sesion|alumno):([^\]]+)\]$/);
  if (legacy) return legacy[1];
  const simple = part.match(/^@\[([^\]]+)\]$/);
  if (simple) return simple[1];
  return null;
}

function MentionBadge({ nombre, dark }: { nombre: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold text-[11px] align-middle",
        dark
          ? "bg-white/20 text-white border border-white/20"
          : "bg-brand/15 border border-brand/30 text-brand"
      )}
    >
      @ {nombre}
    </span>
  );
}

function renderUserContent(content: string): React.ReactNode {
  const parts = content.split(MENTION_RE);
  if (parts.length === 1) return content;
  return parts.map((part, i) => {
    const name = parseMentionName(part);
    if (name) return <MentionBadge key={i} nombre={name} dark />;
    return <span key={i}>{part}</span>;
  });
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(raw: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(
        /`([^`]+)`/g,
        '<code class="font-mono text-[11px] text-brand bg-foreground/[0.04] px-1 py-0.5">$1</code>'
      );

  const lines = raw.split("\n");
  const out: string[] = [];
  let ulOpen = false,
    olOpen = false;

  const closeList = () => {
    if (ulOpen) {
      out.push("</ul>");
      ulOpen = false;
    }
    if (olOpen) {
      out.push("</ol>");
      olOpen = false;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      closeList();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(esc(lines[i]));
        i++;
      }
      out.push(
        `<pre class="my-2 border-l-2 border-brand/40 bg-foreground/[0.03] p-3 overflow-x-auto text-[11px] font-mono leading-relaxed whitespace-pre"><code>${code.join("\n")}</code></pre>`
      );
      i++;
      continue;
    }
    if (/^### /.test(line)) {
      closeList();
      out.push(
        `<h3 class="font-heading font-semibold text-sm mt-3 mb-0.5 text-foreground">${inline(line.slice(4))}</h3>`
      );
      i++;
      continue;
    }
    if (/^## /.test(line)) {
      closeList();
      out.push(
        `<h2 class="font-heading font-semibold text-base mt-4 mb-1 text-foreground">${inline(line.slice(3))}</h2>`
      );
      i++;
      continue;
    }
    if (/^# /.test(line)) {
      closeList();
      out.push(
        `<h1 class="font-heading font-bold text-lg mt-4 mb-1 text-foreground">${inline(line.slice(2))}</h1>`
      );
      i++;
      continue;
    }
    if (line.trim() === "---") {
      closeList();
      out.push('<hr class="border-foreground/15 my-3">');
      i++;
      continue;
    }

    const ul = line.match(/^[*-] (.+)/);
    if (ul) {
      if (olOpen) {
        out.push("</ol>");
        olOpen = false;
      }
      if (!ulOpen) {
        out.push('<ul class="space-y-0.5 my-1.5">');
        ulOpen = true;
      }
      out.push(
        `<li class="flex gap-2 text-sm"><span class="text-brand shrink-0 mt-0.5 leading-5">•</span><span class="leading-5">${inline(ul[1])}</span></li>`
      );
      i++;
      continue;
    }
    const ol = line.match(/^(\d+)\. (.+)/);
    if (ol) {
      if (ulOpen) {
        out.push("</ul>");
        ulOpen = false;
      }
      if (!olOpen) {
        out.push('<ol class="space-y-0.5 my-1.5">');
        olOpen = true;
      }
      out.push(
        `<li class="flex gap-2 text-sm"><span class="text-muted-foreground shrink-0 tabular-nums w-4">${ol[1]}.</span><span class="leading-5">${inline(ol[2])}</span></li>`
      );
      i++;
      continue;
    }
    if (line.trim() === "") {
      closeList();
      out.push('<div class="h-1.5"></div>');
      i++;
      continue;
    }

    closeList();
    out.push(`<p class="text-sm leading-relaxed">${inline(line)}</p>`);
    i++;
  }
  closeList();
  return out.join("");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseQuestions(content: string): Pregunta[] | null {
  const m = content.match(/<preguntas>([\s\S]*?)<\/preguntas>/);
  if (!m) return null;
  try {
    const p = JSON.parse(m[1]);
    return Array.isArray(p) ? p : null;
  } catch {
    return null;
  }
}
function stripQuestions(content: string) {
  return content.replace(/<preguntas>[\s\S]*?<\/preguntas>/g, "").trim();
}
function getToolParts(
  parts: Array<{ type: string; [k: string]: unknown }>,
  name: string
) {
  return parts.filter(
    (p) =>
      p.type === `tool-${name}` ||
      (p.type === "dynamic-tool" &&
        (p as { toolName?: string }).toolName === name)
  ) as Array<{
    type: string;
    state: string;
    input?: unknown;
    output?: unknown;
  }>;
}

const TOOL_LABELS: Record<string, string> = {
  mostrar_ejercicios: "Seleccionando ejercicios",
  buscar_ejercicios_avanzado: "Buscando ejercicios",
  buscar_sesiones_similares: "Buscando sesiones similares",
  buscar_contexto: "Buscando referencias",
  analizar_alumno: "Analizando alumno",
  seleccionar_alumnos: "Preparando selector de alumnos",
  crear_alumno: "Creando alumno",
  crear_ejercicio: "Creando ejercicio",
  configurar_sesion_meta: "Preparando formulario",
  crear_sesion: "Creando sesión",
};

type AnyPart = {
  type: string;
  state?: string;
  toolName?: string;
  text?: string;
};

function findCurrentActivity(parts: AnyPart[]): string | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.state === "output-available") continue;
    if (p.type?.startsWith("tool-")) {
      const name = p.type.replace(/^tool-/, "");
      return TOOL_LABELS[name] ?? "Ejecutando herramienta";
    }
    if (p.type === "dynamic-tool" && p.toolName) {
      return TOOL_LABELS[p.toolName] ?? "Ejecutando herramienta";
    }
  }
  return null;
}

// ─── Components ───────────────────────────────────────────────────────────────

function ReasoningBubble({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const tx = useTranslations("ui.s_id_chatclient");
  const [open, setOpen] = useState(streaming);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- collapse when stream ends
    if (!streaming) setOpen(false);
  }, [streaming]);
  if (!text.trim()) return null;
  return (
    <div className="flex gap-3 justify-start">
      <div className="size-7 border border-foreground/20 bg-transparent flex items-center justify-center shrink-0 mt-1">
        <Brain
          className={cn("size-3.5 text-brand", streaming && "animate-pulse")}
          strokeWidth={1.6}
        />
      </div>
      <div className="max-w-[85%] w-full">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55 hover:text-foreground transition-colors"
        >
          {streaming ? (
            <>
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full bg-brand/60 opacity-75 animate-ping" />
                <span className="relative inline-flex size-1.5 bg-brand" />
              </span>
              <span className="text-brand">{tx("pensando")}</span>
            </>
          ) : (
            <span>{tx("razonamiento")}</span>
          )}
          <ChevronDown
            className={cn("size-3 transition-transform", open && "rotate-180")}
            strokeWidth={1.6}
          />
        </button>
        {open && (
          <div className="mt-2 border-l-2 border-brand/40 bg-foreground/[0.02] px-3.5 py-2.5 text-[12px] leading-relaxed text-foreground/65 whitespace-pre-wrap italic font-heading">
            {text}
            {streaming && (
              <span className="inline-block w-1.5 h-3 ml-0.5 bg-brand/60 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownBubble({ role, content }: { role: string; content: string }) {
  const isAssistant = role === "assistant";
  const clean = isAssistant ? stripQuestions(content) : content;
  if (!clean.trim()) return null;
  return (
    <div
      className={cn(
        "flex gap-3",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && (
        <div className="size-7 border border-foreground/20 bg-transparent flex items-center justify-center shrink-0 mt-1">
          <Bot className="size-3.5 text-brand" strokeWidth={1.6} />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3 shadow-sm",
          isAssistant
            ? "border border-l-2 border-foreground/12 border-l-brand/50 bg-card text-foreground"
            : "border border-brand bg-brand text-[14px] leading-relaxed text-brand-foreground"
        )}
      >
        {isAssistant ? (
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(clean) }} />
        ) : (
          <span>{renderUserContent(clean)}</span>
        )}
      </div>
      {!isAssistant && (
        <div className="size-7 border border-foreground/20 bg-transparent flex items-center justify-center shrink-0 mt-1">
          <User className="size-3.5 text-foreground/60" strokeWidth={1.6} />
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
  selected,
  onToggle,
  onModify,
}: {
  exercise: ExerciseItem;
  selected: boolean;
  onToggle: () => void;
  onModify: (ex: ExerciseItem) => void;
}) {
  const term = useTerm();
  const tx = useTranslations("ui.s_id_chatclient");
  const cat = CAT[exercise.category] ?? CAT.technique;
  const diff = DIFF[exercise.difficulty] ?? DIFF.intermediate;
  return (
    <div
      onClick={onToggle}
      className={cn(
        "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3.5 pl-4 shadow-sm transition-all group",
        selected
          ? "bg-brand/[0.06] border-brand"
          : "bg-card border-foreground/15 hover:border-foreground/35"
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 w-[2px] h-full",
          selected ? "bg-brand" : "bg-foreground/15"
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
            {cat.code} · {term(cat.label)}
          </span>
          {exercise.isAiGenerated && (
            <span className="font-sans text-[9px] uppercase tracking-[0.22em] text-brand">
              {tx("ia")}
            </span>
          )}
        </div>
        <div
          className={cn(
            "size-4 border flex items-center justify-center shrink-0 transition-all",
            selected
              ? "bg-brand border-brand"
              : "border-foreground/25 group-hover:border-foreground/50"
          )}
        >
          {selected && (
            <Check className="size-2.5 text-brand-foreground" strokeWidth={3} />
          )}
        </div>
      </div>
      <h3 className="font-heading italic text-[15px] text-foreground leading-snug">
        {exercise.name}
      </h3>
      {exercise.description && (
        <p className="text-[12px] text-foreground/55 leading-relaxed line-clamp-2">
          {exercise.description}
        </p>
      )}
      <div className="flex items-center justify-between pt-1 border-t border-foreground/10">
        <div className="flex items-center gap-3 text-[11px] text-foreground/55 tabular-nums">
          <span className="flex items-center gap-1">
            <Clock className="size-3" strokeWidth={1.6} />
            {exercise.durationMinutes}′
          </span>
          <span className="flex items-center gap-1">
            <span className="flex gap-[2px]">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "w-[2px] h-2",
                    n <= diff.bars ? "bg-brand" : "bg-foreground/15"
                  )}
                />
              ))}
            </span>
            {term(diff.label)}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onModify(exercise);
          }}
          className="flex items-center gap-1 text-[10px] tracking-[0.18em] uppercase text-foreground/50 hover:text-brand transition-colors"
        >
          {tx("modificar")}
        </button>
      </div>
    </div>
  );
}

function ExerciseGrid({
  ejercicios,
  selectedExercises,
  onToggle,
  onModify,
}: {
  ejercicios: ExerciseItem[];
  selectedExercises: Set<string>;
  onToggle: (id: string) => void;
  onModify: (ex: ExerciseItem) => void;
}) {
  const tx = useTranslations("ui.s_id_chatclient");
  if (!ejercicios.length) return null;
  const sel = ejercicios.filter((e) => selectedExercises.has(e.id)).length;
  return (
    <div className="ml-2 sm:ml-10 mt-2 space-y-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{ejercicios.length}</span>{" "}
        {tx("ejercicio")}{ejercicios.length !== 1 ? "s" : ""}
        {sel > 0 && (
          <span className="text-brand ml-1.5">
            {tx("v1SeleccionadoV2", { v1: sel, v2: sel !== 1 ? "s" : "" })}
          </span>
        )}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ejercicios.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            selected={selectedExercises.has(ex.id)}
            onToggle={() => onToggle(ex.id)}
            onModify={onModify}
          />
        ))}
      </div>
    </div>
  );
}

function ExerciseToolCard({
  part,
}: {
  part: { state: string; output?: unknown };
}) {
  const tx = useTranslations("ui.s_id_chatclient");
  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("guardandoEjercicio")}
      </div>
    );
  if (part.state !== "output-available") return null;
  const r = part.output as { ok: boolean; name?: string; error?: string };
  return r.ok ? (
    <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-3 border-l-2 border-brand bg-foreground/[0.02] px-4 py-2.5 max-w-sm animate-scale-in">
      <CheckCircle2
        className="size-3.5 text-brand shrink-0"
        strokeWidth={1.6}
      />
      <span className="font-heading italic text-[14px] text-foreground">
        {r.name}
      </span>
      <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/50">
        {tx("guardado")}
      </span>
      <span className="ml-auto font-sans text-[9px] uppercase tracking-[0.22em] text-brand shrink-0 flex items-center gap-1">
        <Sparkles className="size-2.5" />{" "}{tx("ia2")}
      </span>
    </div>
  ) : (
    <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 border-l-2 border-destructive bg-foreground/[0.02] px-4 py-2.5 max-w-sm animate-fade-in">
      <XCircle
        className="size-3.5 text-destructive shrink-0"
        strokeWidth={1.6}
      />
      <span className="text-[12px] text-destructive">{r.error}</span>
    </div>
  );
}

function SessionCreatedCard({
  part,
}: {
  part: { state: string; output?: unknown };
}) {
  const tx = useTranslations("ui.s_id_chatclient");
  const router = useRouter();
  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("creandoSesion")}
      </div>
    );
  if (part.state !== "output-available") return null;
  const r = part.output as {
    ok: boolean;
    sessionId?: string;
    title?: string;
    totalDuration?: number;
    error?: string;
  };
  if (!r.ok)
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 border-l-2 border-destructive bg-foreground/[0.02] px-4 py-2.5 max-w-sm animate-fade-in">
        <XCircle
          className="size-3.5 text-destructive shrink-0"
          strokeWidth={1.6}
        />
        <span className="text-[12px] text-destructive">{r.error}</span>
      </div>
    );
  return (
    <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-3 border-l-2 border-brand bg-foreground/[0.02] px-4 py-3 max-w-sm animate-scale-in">
      <div className="size-9 border border-foreground/20 flex items-center justify-center shrink-0">
        <CalendarCheck className="size-4 text-brand" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/50">
          {tx("sesionCreada")}
        </p>
        <p className="font-heading italic text-[14px] text-foreground truncate">
          {r.title}
        </p>
        {r.totalDuration ? (
          <p className="font-sans text-[10px] tabular-nums text-foreground/50">
            {r.totalDuration}′
          </p>
        ) : null}
      </div>
      <button
        onClick={() => router.push(`/sessions/${r.sessionId}`)}
        className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/70 border border-foreground/20 px-3 py-2 hover:border-brand hover:text-brand transition-colors shrink-0"
      >
        {tx("ver")}
      </button>
    </div>
  );
}

function QuestionForm({
  preguntas,
  onSubmit,
}: {
  preguntas: Pregunta[];
  onSubmit: (a: Record<string, string>) => void;
}) {
  const term = useTerm();
  const tx = useTranslations("ui.s_id_chatclient");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(preguntas.map((p) => [p.id, ""]))
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="ml-2 sm:ml-10 mt-2 border border-foreground/15 p-4 space-y-4 max-w-xs bg-foreground/[0.02]"
    >
      {preguntas.map((p) => (
        <div key={p.id} className="space-y-1.5">
          <label className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
            {term(p.label)}
          </label>
          {p.tipo === "select" && p.opciones ? (
            <select
              value={values[p.id]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [p.id]: e.target.value }))
              }
              required
              className="w-full text-[13px] bg-transparent border-0 border-b border-foreground/20 px-0 py-1.5 focus:outline-none focus:border-brand transition-colors"
            >
              <option value="">{tx("selecciona")}</option>
              {p.opciones.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={p.tipo === "numero" ? "number" : "text"}
              value={values[p.id]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [p.id]: e.target.value }))
              }
              placeholder={p.placeholder ?? ""}
              required
              min={p.tipo === "numero" ? 1 : undefined}
              className="w-full text-[13px] bg-transparent border-0 border-b border-foreground/20 px-0 py-1.5 focus:outline-none focus:border-brand transition-colors placeholder:text-foreground/30"
            />
          )}
        </div>
      ))}
      <button
        type="submit"
        className="w-full font-sans text-[11px] uppercase tracking-[0.22em] font-semibold bg-brand text-brand-foreground py-2.5 hover:bg-brand/90 transition-colors"
      >
        {tx("enviar")}
      </button>
    </form>
  );
}

function StudentPickerCard({
  part,
  onSend,
}: {
  part: { state: string; output?: unknown };
  onSend: (text: string) => void;
}) {
  const tx = useTranslations("ui.s_id_chatclient");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("cargandoAlumnos")}
      </div>
    );
  if (part.state !== "output-available") return null;

  const r = part.output as { estudiantes: StudentItem[]; pregunta?: string };
  const estudiantes = r.estudiantes ?? [];

  if (confirmed) {
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 border-l-2 border-brand bg-foreground/[0.02] px-4 py-2.5 max-w-sm">
        <CheckCircle2
          className="size-3.5 text-brand shrink-0"
          strokeWidth={1.6}
        />
        <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55">
          {tx("seleccionConfirmada")}
        </span>
      </div>
    );
  }

  if (estudiantes.length === 0) {
    return (
      <div className="ml-2 sm:ml-10 mt-2 border border-foreground/15 p-4 max-w-sm space-y-3 bg-foreground/[0.02]">
        <p className="text-[12px] text-foreground/65">
          {tx("aunNoTienesAlumnos")}
        </p>
        <Link
          href="/students/new"
          className="inline-flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/70 border border-foreground/20 px-3 py-2 hover:border-brand hover:text-brand transition-colors"
        >
          <UserPlus className="size-3" strokeWidth={1.6} />{" "}{tx("crearAlumno")}
        </Link>
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function confirm() {
    const names = estudiantes
      .filter((s) => selected.has(s.id))
      .map((s) => {
        const lvl = s.playerLevel
          ? ` (${LEVEL_LABEL[s.playerLevel] ?? s.playerLevel})`
          : "";
        return `${s.name}${lvl}`;
      });
    const text =
      names.length > 0
        ? `He seleccionado a: ${names.join(", ")}`
        : tx("continuarSinSeleccionarAlumnos");
    setConfirmed(true);
    onSend(text);
  }

  return (
    <div className="ml-2 sm:ml-10 mt-2 border border-foreground/15 p-4 max-w-sm space-y-3 bg-foreground/[0.02]">
      <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
        {r.pregunta ?? tx("paraQuienEsEsta")}
      </p>
      <div className="space-y-1">
        {estudiantes.map((s) => {
          const isSelected = selected.has(s.id);
          return (
            <div
              key={s.id}
              onClick={() => toggle(s.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 border cursor-pointer transition-all",
                isSelected
                  ? "bg-brand/[0.06] border-brand"
                  : "bg-transparent border-foreground/15 hover:border-foreground/35"
              )}
            >
              <div
                className={cn(
                  "size-4 border flex items-center justify-center shrink-0 transition-all",
                  isSelected ? "bg-brand border-brand" : "border-foreground/30"
                )}
              >
                {isSelected && (
                  <Check
                    className="size-2.5 text-brand-foreground"
                    strokeWidth={3}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-foreground truncate">{s.name}</p>
              </div>
              {s.playerLevel && (
                <span className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55 shrink-0">
                  {LEVEL_CODE[s.playerLevel] ?? "—"} ·{" "}
                  {LEVEL_LABEL[s.playerLevel] ?? s.playerLevel}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={confirm}
        className="w-full font-sans text-[11px] uppercase tracking-[0.22em] font-semibold bg-brand text-brand-foreground py-2.5 hover:bg-brand/90 transition-colors"
      >
        {tx("confirmarSeleccion")}
      </button>
    </div>
  );
}

function CrearAlumnoCard({
  part,
}: {
  part: { state: string; output?: unknown };
}) {
  const tx = useTranslations("ui.s_id_chatclient");
  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("creandoAlumno")}
      </div>
    );
  if (part.state !== "output-available") return null;
  const r = part.output as {
    ok: boolean;
    id?: string;
    name?: string;
    error?: string;
  };
  if (!r.ok)
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 border-l-2 border-destructive bg-foreground/[0.02] px-4 py-2.5 max-w-sm">
        <XCircle
          className="size-3.5 text-destructive shrink-0"
          strokeWidth={1.6}
        />
        <span className="text-[12px] text-destructive">{r.error}</span>
      </div>
    );
  return (
    <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-3 border-l-2 border-brand bg-foreground/[0.02] px-4 py-3 max-w-sm">
      <div className="size-9 border border-foreground/20 flex items-center justify-center shrink-0">
        <UserPlus className="size-4 text-brand" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/50">
          {tx("alumnoCreado")}
        </p>
        <p className="font-heading italic text-[14px] text-foreground truncate">
          {r.name}
        </p>
      </div>
      <Link
        href={`/students/${r.id}`}
        className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/70 border border-foreground/20 px-3 py-2 hover:border-brand hover:text-brand transition-colors shrink-0"
      >
        {tx("ver")}
      </Link>
    </div>
  );
}

function ConfigurarSesionMetaCard({
  part,
  onSend,
}: {
  part: { state: string; output?: unknown };
  onSend: (text: string) => void;
}) {
  const tx = useTranslations("ui.s_id_chatclient");
  const [confirmed, setConfirmed] = useState(false);
  const output = part.output as SessionMetaInput | undefined;

  const [objective, setObjective] = useState(output?.objective ?? "");
  const [intensity, setIntensity] = useState<number>(output?.intensity ?? 3);
  const [location, setLocation] = useState(output?.location ?? "");
  const [tagsInput, setTagsInput] = useState((output?.tags ?? []).join(", "));
  const [scheduledAt, setScheduledAt] = useState(output?.scheduledAt ?? "");

  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("preparandoConfiguracion")}
      </div>
    );
  if (part.state !== "output-available") return null;

  if (confirmed) {
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 border-l-2 border-brand bg-foreground/[0.02] px-4 py-2.5 max-w-sm">
        <CheckCircle2
          className="size-3.5 text-brand shrink-0"
          strokeWidth={1.6}
        />
        <span className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55">
          {tx("configuracionConfirmada")}
        </span>
      </div>
    );
  }

  function confirm() {
    const text = [
      "[FORM_META_CONFIRMED]",
      `objetivo=${objective.trim()}`,
      `intensidad=${intensity}`,
      `ubicacion=${location.trim()}`,
      `etiquetas=${tagsInput.trim()}`,
      `fecha=${scheduledAt.trim()}`,
    ].join(" | ");
    setConfirmed(true);
    onSend(text);
  }

  return (
    <div className="ml-2 sm:ml-10 mt-2 border border-foreground/15 p-4 max-w-sm space-y-4 bg-foreground/[0.02]">
      <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-brand">
        {tx("configurarSesion")}
      </p>

      <div className="space-y-1.5">
        <label className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
          {tx("objetivo")}
        </label>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          rows={2}
          placeholder={tx("ejMejorarLaVolea")}
          className="w-full text-[13px] bg-transparent border-0 border-b border-foreground/20 px-0 py-1.5 focus:outline-none focus:border-brand transition-colors resize-none placeholder:text-foreground/30"
        />
      </div>

      <div className="space-y-1.5">
        <label className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55 flex items-center gap-1.5">
          <Flame className="size-3" strokeWidth={1.6} />{" "}{tx("intensidad")}
        </label>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setIntensity(n)}
              className={cn(
                "flex-1 font-sans text-[11px] tabular-nums font-semibold py-2 border transition-all -ml-px first:ml-0",
                intensity === n
                  ? "bg-brand text-brand-foreground border-brand z-10"
                  : "bg-transparent border-foreground/20 text-foreground/55 hover:border-foreground/50"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55 flex items-center gap-1.5">
          <MapPin className="size-3" strokeWidth={1.6} />{" "}{tx("ubicacion")}
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={tx("ejPista3Club")}
          className="w-full text-[13px] bg-transparent border-0 border-b border-foreground/20 px-0 py-1.5 focus:outline-none focus:border-brand transition-colors placeholder:text-foreground/30"
        />
      </div>

      <div className="space-y-1.5">
        <label className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55 flex items-center gap-1.5">
          <Tag className="size-3" strokeWidth={1.6} />{" "}{tx("etiquetas")}
        </label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder={tx("tecnicaVoleaAvanzado")}
          className="w-full text-[13px] bg-transparent border-0 border-b border-foreground/20 px-0 py-1.5 focus:outline-none focus:border-brand transition-colors placeholder:text-foreground/30"
        />
      </div>

      <div className="space-y-1.5">
        <label className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
          {tx("fechaYHora")}
        </label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="w-full text-[13px] bg-transparent border-0 border-b border-foreground/20 px-0 py-1.5 focus:outline-none focus:border-brand transition-colors"
        />
      </div>

      <button
        onClick={confirm}
        className="w-full font-sans text-[11px] uppercase tracking-[0.22em] font-semibold bg-brand text-brand-foreground py-2.5 hover:bg-brand/90 transition-colors"
      >
        {tx("confirmarYCrearSesion")}
      </button>
    </div>
  );
}

function BuscarContextoCard({
  part,
}: {
  part: { state: string; output?: unknown };
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_id_chatclient");
  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("buscando")}
      </div>
    );
  if (part.state !== "output-available") return null;
  const r = part.output as BuscarContextoResult;
  if (!r?.resultados?.length)
    return (
      <div className="ml-2 sm:ml-10 mt-2 text-xs text-muted-foreground">
        {tx("sinResultados")}
      </div>
    );

  const iconForTipo = (tipo: string) => {
    if (tipo === "ejercicio")
      return (
        <Dumbbell
          className="size-3 text-foreground/60 shrink-0"
          strokeWidth={1.6}
        />
      );
    if (tipo === "sesion")
      return (
        <Calendar
          className="size-3 text-foreground/60 shrink-0"
          strokeWidth={1.6}
        />
      );
    return (
      <GraduationCap
        className="size-3 text-foreground/60 shrink-0"
        strokeWidth={1.6}
      />
    );
  };

  const labelForTipo: Record<string, string> = {
    ejercicio: "Ejercicios",
    sesion: "Sesiones",
    alumno: "Alumnos",
  };

  return (
    <div className="ml-2 sm:ml-10 mt-2 border border-foreground/15 p-3 max-w-sm bg-foreground/[0.02]">
      <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-brand mb-2">
        {labelForTipo[r.tipo] ?? r.tipo}
      </p>
      <ul>
        {r.resultados.map((item, idx) => {
          const name = item.name ?? item.title ?? "";
          const subtitle =
            item.category ??
            (item.scheduledAt
              ? new Date(item.scheduledAt).toLocaleDateString(intlLocale)
              : null) ??
            item.playerLevel ??
            null;
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 py-2 border-b border-foreground/5 last:border-0"
            >
              <span className="font-sans text-[9px] tabular-nums tracking-[0.18em] text-foreground/40 w-4">
                {String(idx + 1).padStart(2, "0")}
              </span>
              {iconForTipo(r.tipo)}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-foreground truncate">{name}</p>
                {subtitle && (
                  <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/45 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AnalizarAlumnoCard({
  part,
}: {
  part: { state: string; output?: unknown };
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_id_chatclient");
  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("analizandoAlumno")}
      </div>
    );
  if (part.state !== "output-available") return null;

  type AlumnoData = {
    ok: boolean;
    student?: {
      id: string;
      name: string;
      playerLevel: string | null;
      dominantHand: string | null;
      notes: string | null;
      yearsExperience: number | null;
    };
    totalSessions?: number;
    recentSessions?: Array<{
      id: string;
      title: string;
      scheduledAt: string | Date;
      durationMinutes: number;
      objective: string | null;
      intensity: number | null;
    }>;
    error?: string;
  };
  const r = part.output as AlumnoData;

  if (!r.ok)
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 max-w-sm">
        <XCircle className="size-4 text-destructive shrink-0" />
        <span className="text-xs text-destructive">{r.error}</span>
      </div>
    );

  const { student, totalSessions = 0, recentSessions = [] } = r;
  if (!student) return null;

  return (
    <div className="ml-2 sm:ml-10 mt-2 bg-card border border-foreground/15 p-4 max-w-sm space-y-3">
      <div className="flex items-center gap-3 pb-3 border-b border-foreground/10">
        <div className="size-10 border border-foreground/20 flex items-center justify-center shrink-0">
          <GraduationCap
            className="size-4 text-foreground/70"
            strokeWidth={1.6}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading italic text-[15px] text-foreground">
            {student.name}
          </p>
          <div className="flex items-center gap-3 font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/50 mt-0.5">
            {student.playerLevel && (
              <span>
                {LEVEL_CODE[student.playerLevel] ?? "—"} ·{" "}
                {LEVEL_LABEL[student.playerLevel] ?? student.playerLevel}
              </span>
            )}
            {student.dominantHand && (
              <span>
                {student.dominantHand === "right" ? "Diestra" : "Zurda"}
              </span>
            )}
            {student.yearsExperience != null && (
              <span>{tx("v1YExp", { v1: student.yearsExperience })}</span>
            )}
          </div>
        </div>
      </div>

      {student.notes && (
        <p className="font-heading italic text-[13px] text-foreground/75 border-l-2 border-brand/40 pl-3">
          {student.notes}
        </p>
      )}

      <div className="grid grid-cols-[auto_1fr] items-baseline gap-3 py-2 border-y border-foreground/10">
        <p className="font-heading text-3xl tabular-nums text-foreground leading-none">
          {totalSessions}
        </p>
        <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/50">
          {tx("sesiones2")}
          <br />
          {tx("registradas")}
        </p>
      </div>

      {recentSessions.length > 0 && (
        <div className="space-y-1">
          <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/50 mb-1.5">
            {tx("ultimasSesiones")}
          </p>
          {recentSessions.slice(0, 4).map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-0 py-2 border-b border-foreground/5 last:border-0"
            >
              <span className="font-sans text-[10px] tabular-nums tracking-[0.18em] text-foreground/40 w-4">
                {String(recentSessions.indexOf(s) + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-foreground truncate">
                  {s.title}
                </p>
                <p className="text-[10px] text-foreground/50 tabular-nums">
                  {new Date(s.scheduledAt).toLocaleDateString(intlLocale)} ·{" "}
                  {s.durationMinutes}′
                </p>
              </div>
              {s.intensity != null && (
                <div className="flex gap-[2px] shrink-0">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={cn(
                        "w-[2px] h-2.5",
                        n <= s.intensity! ? "bg-brand" : "bg-foreground/15"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Link
        href={`/students/${student.id}`}
        className="flex items-center justify-center gap-1.5 w-full text-[11px] tracking-[0.18em] uppercase text-foreground/70 border border-foreground/20 px-3 py-2 hover:border-brand hover:text-brand transition-colors"
      >
        {tx("verPerfilCompleto")}
      </Link>
    </div>
  );
}

function SesionesSimilaresCard({
  part,
}: {
  part: { state: string; output?: unknown };
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_id_chatclient");
  if (part.state === "input-streaming" || part.state === "input-available")
    return (
      <div className="ml-2 sm:ml-10 mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin text-brand" />
        {tx("buscandoSesiones")}
      </div>
    );
  if (part.state !== "output-available") return null;

  type SesionItem = {
    id: string;
    title: string;
    scheduledAt: string | Date;
    durationMinutes: number;
    objective: string | null;
    intensity: number | null;
    tags: string[] | null;
  };
  const r = part.output as { sesiones: SesionItem[] };

  if (!r.sesiones?.length)
    return (
      <div className="ml-2 sm:ml-10 mt-2 text-xs text-muted-foreground">
        {tx("noSeEncontraronSesiones")}
      </div>
    );

  return (
    <div className="ml-2 sm:ml-10 mt-2 space-y-2">
      <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
        <span className="tabular-nums text-brand">
          {String(r.sesiones.length).padStart(2, "0")}
        </span>{" "}
        {tx("sesion")}{r.sesiones.length !== 1 ? "es" : ""}{" "}{tx("encontrada")}
        {r.sesiones.length !== 1 ? "s" : ""}
      </p>
      <ul className="border-y border-foreground/10">
        {r.sesiones.map((s, idx) => (
          <li
            key={s.id}
            className="border-b border-foreground/10 last:border-0"
          >
            <Link
              href={`/sessions/${s.id}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 hover:bg-foreground/[0.02] transition-colors group"
            >
              <span className="font-sans text-[10px] tabular-nums tracking-[0.18em] text-foreground/40 w-6">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="font-heading italic text-[14px] text-foreground truncate group-hover:text-brand transition-colors">
                  {s.title}
                </p>
                <div className="flex items-center gap-2 font-sans text-[10px] tabular-nums tracking-[0.18em] text-foreground/50 mt-0.5">
                  <span>
                    {new Date(s.scheduledAt).toLocaleDateString(intlLocale)}
                  </span>
                  <span>·</span>
                  <span>{s.durationMinutes}′</span>
                  {s.intensity != null && (
                    <span className="flex gap-[2px]">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={cn(
                            "w-[2px] h-2",
                            n <= s.intensity! ? "bg-brand" : "bg-foreground/15"
                          )}
                        />
                      ))}
                    </span>
                  )}
                </div>
                {s.objective && (
                  <p className="text-[11px] text-foreground/50 mt-0.5 truncate italic">
                    {s.objective}
                  </p>
                )}
                {s.tags && s.tags.length > 0 && (
                  <div className="flex gap-2 mt-1 font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/50">
                    {s.tags.slice(0, 3).map((tag) => (
                      <span key={tag}>· {tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight
                className="size-3 text-foreground/40 group-hover:text-brand transition-colors shrink-0"
                strokeWidth={1.6}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MentionPopover({
  query,
  results,
  loading,
  onSelect,
}: {
  query: string;
  results: MentionResult[];
  loading: boolean;
  onSelect: (r: MentionResult) => void;
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_id_chatclient");
  const grouped = {
    ejercicio: results.filter((r) => r.type === "ejercicio") as Extract<
      MentionResult,
      { type: "ejercicio" }
    >[],
    sesion: results.filter((r) => r.type === "sesion") as Extract<
      MentionResult,
      { type: "sesion" }
    >[],
    alumno: results.filter((r) => r.type === "alumno") as Extract<
      MentionResult,
      { type: "alumno" }
    >[],
  };
  const hasResults = results.length > 0;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-background border border-foreground/20 overflow-hidden max-h-[280px] overflow-y-auto">
      {loading && (
        <div className="flex items-center gap-2 px-3 py-3 font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55">
          <Loader2
            className="size-3 animate-spin text-brand"
            strokeWidth={1.6}
          />{" "}
          {tx("buscando")}
        </div>
      )}
      {!loading && !hasResults && (
        <div className="px-3 py-3 font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55">
          {tx("sinResultadosParaV1", { v1: query })}</div>
      )}
      {!loading && hasResults && (
        <div className="py-1">
          {grouped.ejercicio.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1.5 font-sans text-[9px] uppercase tracking-[0.22em] text-brand border-b border-foreground/10">
                {tx("ejercicios")}
              </p>
              {grouped.ejercicio.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-foreground/[0.04] transition-colors text-left border-b border-foreground/5 last:border-0"
                >
                  <Dumbbell
                    className="size-3 text-foreground/55 shrink-0"
                    strokeWidth={1.6}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-foreground truncate">
                      {r.name}
                    </p>
                    <p className="font-sans text-[9px] uppercase tracking-[0.18em] text-foreground/50 truncate">
                      {r.category} · {r.durationMinutes}′
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
          {grouped.sesion.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1.5 font-sans text-[9px] uppercase tracking-[0.22em] text-brand border-y border-foreground/10">
                {tx("sesiones")}
              </p>
              {grouped.sesion.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-foreground/[0.04] transition-colors text-left border-b border-foreground/5 last:border-0"
                >
                  <Calendar
                    className="size-3 text-foreground/55 shrink-0"
                    strokeWidth={1.6}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-foreground truncate">
                      {r.title}
                    </p>
                    <p className="font-sans text-[9px] tabular-nums tracking-[0.18em] text-foreground/50 truncate">
                      {new Date(r.scheduledAt).toLocaleDateString(intlLocale)}
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
          {grouped.alumno.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1.5 font-sans text-[9px] uppercase tracking-[0.22em] text-brand border-y border-foreground/10">
                {tx("alumnos")}
              </p>
              {grouped.alumno.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-foreground/[0.04] transition-colors text-left border-b border-foreground/5 last:border-0"
                >
                  <GraduationCap
                    className="size-3 text-foreground/55 shrink-0"
                    strokeWidth={1.6}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-foreground truncate">
                      {r.name}
                    </p>
                    {r.playerLevel && (
                      <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/50 truncate">
                        {LEVEL_CODE[r.playerLevel] ?? "—"} ·{" "}
                        {LEVEL_LABEL[r.playerLevel] ?? r.playerLevel}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main chat component ───────────────────────────────────────────────────────

type ModelMode = "auto" | "reasoning" | "rapido";

const MODEL_MODES: { id: ModelMode; label: string; desc: string }[] = [
  {
    id: "auto",
    label: "Automático",
    desc: "El sistema elige el modelo según la complejidad",
  },
  {
    id: "reasoning",
    label: "Razonamiento",
    desc: "Sonnet — respuestas más profundas",
  },
  { id: "rapido", label: "Rapidez", desc: "Haiku — respuestas más rápidas" },
];

export function DrPlannerChat({
  chatId,
  initialTitle,
  initialMessages,
}: {
  chatId: string;
  initialTitle: string;
  initialMessages: Record<string, unknown>[];
}) {
  const term = useTerm();
  const tx = useTranslations("ui.s_id_chatclient");
  const router = useRouter();
  const [modelMode, setModelMode] = useState<ModelMode>("auto");

  function updateModelMode(mode: ModelMode) {
    setModelMode(mode);
  }

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/dr-planner",
        body: { chatId, modelMode },
        fetch: fetchWithChatTimeout,
        prepareSendMessagesRequest: ({ body, messages }) => ({
          body: { ...body, messages },
        }),
      }),
    [chatId, modelMode]
  );

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    stop,
    error,
    clearError,
  } = useChat({
    transport,
    messages: initialMessages as unknown as UIMessage[],
    onError: (chatError) => {
      console.error("[Dr. Planner] chat error:", chatError);
    },
  });

  const [input, setInput] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(
    new Set()
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevStatus = useRef(status);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = status === "streaming" || status === "submitted";
  const lastMsgId = messages[messages.length - 1]?.id;
  const chatErrorText = error
    ? error.message.toLowerCase().includes("abort")
      ? tx("laConexionConLa")
      : error.message
    : null;

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Keep ref in sync so unmount/interval closures always see latest messages
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Save when stream completes normally
  useEffect(() => {
    if (
      prevStatus.current !== "ready" &&
      status === "ready" &&
      messages.length > 0
    ) {
      fetch(`/api/dr-planner/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (data.data?.title && data.data.title !== title)
            setTitle(data.data.title);
        })
        .catch(() => {});
    }
    prevStatus.current = status;
  }, [chatId, messages, status, title]);

  // Auto-save every 10s while streaming so work isn't lost mid-generation
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      if (messagesRef.current.length === 0) return;
      fetch(`/api/dr-planner/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesRef.current }),
      }).catch(() => {});
    }, 10_000);
    return () => clearInterval(interval);
  }, [isLoading, chatId]);

  // Save on unmount (page navigation) using keepalive so the request survives
  useEffect(() => {
    return () => {
      if (messagesRef.current.length === 0) return;
      fetch(`/api/dr-planner/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesRef.current }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [chatId]);

  // Fetch mention results when mentionQuery changes
  useEffect(() => {
    if (mentionQuery === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear on query reset
      setMentionResults([]);
      return;
    }
    if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
    mentionDebounceRef.current = setTimeout(async () => {
      setMentionLoading(true);
      const q = encodeURIComponent(mentionQuery);
      const [exRes, sesRes, stuRes] = await Promise.allSettled([
        fetch(`/api/exercises?search=${q}&limit=4`).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/api/sessions?limit=4`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/students`).then((r) => (r.ok ? r.json() : null)),
      ]);
      const combined: MentionResult[] = [];
      if (exRes.status === "fulfilled" && exRes.value?.data) {
        const items = (
          exRes.value.data as Array<{
            id: string;
            name: string;
            category: string;
            durationMinutes: number;
          }>
        )
          .filter(
            (e) =>
              !mentionQuery ||
              e.name.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 4);
        combined.push(
          ...items.map((e) => ({
            type: "ejercicio" as const,
            id: e.id,
            name: e.name,
            category: e.category,
            durationMinutes: e.durationMinutes,
          }))
        );
      }
      if (sesRes.status === "fulfilled" && sesRes.value?.data) {
        const items = (
          sesRes.value.data as Array<{
            id: string;
            title: string;
            scheduledAt: string;
          }>
        )
          .filter(
            (s) =>
              !mentionQuery ||
              s.title.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 4);
        combined.push(
          ...items.map((s) => ({
            type: "sesion" as const,
            id: s.id,
            title: s.title,
            scheduledAt: s.scheduledAt,
          }))
        );
      }
      if (stuRes.status === "fulfilled" && stuRes.value?.data) {
        const items = (
          stuRes.value.data as Array<{
            id: string;
            name: string;
            playerLevel: string | null;
          }>
        )
          .filter(
            (s) =>
              !mentionQuery ||
              s.name.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 4);
        combined.push(
          ...items.map((s) => ({
            type: "alumno" as const,
            id: s.id,
            name: s.name,
            playerLevel: s.playerLevel ?? null,
          }))
        );
      }
      setMentionResults(combined);
      setMentionLoading(false);
    }, 200);
  }, [mentionQuery]);

  // Close mention popover on click outside
  useEffect(() => {
    if (mentionQuery === null) return;
    function onClickOutside(e: MouseEvent) {
      if (
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(e.target as Node)
      ) {
        setMentionQuery(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [mentionQuery]);

  const toggleExercise = useCallback((id: string) => {
    setSelectedExercises((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const handleModify = useCallback((ex: ExerciseItem) => {
    setInput(`Quiero modificar el ejercicio "${ex.name}": `);
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      if (!text || isLoading) return;
      clearError();
      sendMessage({ text });
    },
    [clearError, isLoading, sendMessage]
  );

  function submit() {
    const text = input.trim();
    if (!text || isLoading) return;
    clearError();
    setInput("");
    setMentionQuery(null);
    sendMessage({ text });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setMentionQuery(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    // Detect @mention: find last @ before cursor
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx !== -1) {
      const afterAt = textBeforeCursor.slice(atIdx + 1);
      // Only open if no space in the query (space closes it)
      if (!afterAt.includes(" ")) {
        setMentionQuery(afterAt);
        return;
      }
    }
    setMentionQuery(null);
  }

  function handleMentionSelect(r: MentionResult) {
    const label = r.type === "sesion" ? r.title : r.name;
    const replacement = `@[${label}]`;
    // Find and replace the @query in the input
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx !== -1) {
      const newVal = input.slice(0, atIdx) + replacement + input.slice(cursor);
      setInput(newVal);
      // Move cursor after the replacement
      setTimeout(() => {
        const newCursor = atIdx + replacement.length;
        textareaRef.current?.setSelectionRange(newCursor, newCursor);
        textareaRef.current?.focus();
      }, 0);
    }
    setMentionQuery(null);
  }

  function getMessageText(m: (typeof messages)[number]) {
    return m.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  async function handleDelete() {
    await fetch(`/api/dr-planner/chats/${chatId}`, { method: "DELETE" });
    router.push("/sessions/dr-planner");
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-[#F4F4F1] text-[#050505] dark:bg-[#050505] dark:text-white md:h-dvh">
      {/* Header */}
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-[#050505]/10 bg-white/86 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86 sm:gap-4 sm:px-6 sm:py-4 md:px-10">
        <Link
          href="/sessions/dr-planner"
          className="whitespace-nowrap rounded-full border border-[#050505]/10 px-3 py-1.5 text-[10px] font-black uppercase text-foreground/55 transition-colors hover:text-brand dark:border-white/10"
        >
          <span className="sm:hidden">←</span>
          <span className="hidden sm:inline">{tx("drPlanner")}</span>
        </Link>
        <div className="min-w-0 text-center">
          <p className="hidden text-[9px] font-black uppercase text-foreground/45 sm:block">
            {tx("conversacionIa")}
          </p>
          <p className="truncate text-[14px] font-black text-foreground sm:mt-0.5 sm:text-[15px]">
            {title}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title={tx("limpiarConversacion")}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black uppercase text-foreground/55 transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="size-3" strokeWidth={1.6} />
              <span className="hidden sm:inline">{tx("limpiar")}</span>
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black uppercase text-foreground/55 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={tx("eliminar")}
          >
            <Trash2 className="size-3" strokeWidth={1.6} />
            <span className="hidden sm:inline">{tx("eliminar")}</span>
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10">
        {chatErrorText && (
          <div className="max-w-5xl mx-auto pt-4">
            <div className="flex items-start gap-3 rounded-[22px] border border-destructive/25 bg-destructive/10 px-4 py-3">
              <XCircle
                className="size-3.5 text-destructive shrink-0 mt-0.5"
                strokeWidth={1.6}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-destructive">
                  {tx("errorDeConexionIa")}
                </p>
                <p className="text-[12px] text-destructive/90 mt-1">
                  {chatErrorText}
                </p>
              </div>
              <button
                onClick={clearError}
                className="rounded-full px-2 py-1 text-[10px] font-black uppercase text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                {tx("cerrar")}
              </button>
            </div>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 max-w-xl mx-auto text-center pb-4">
            <p className="tp-kicker">{tx("consultaDrPlanner")}</p>
            <h2 className="text-4xl font-black leading-tight text-foreground md:text-5xl">
              {tx("queSesionNecesitasHoy")}
            </h2>
            <p className="text-[13px] text-foreground/60 leading-relaxed max-w-md">
              {tx("describeNivelDelGrupo")}
            </p>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                "Sesión de 60 min para nivel intermedio",
                "Técnica de volea para principiantes",
                "Entrenamiento físico para competición",
                "Táctica de juego de red para parejas",
              ].map((s, i) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    "rounded-[22px] border border-[#050505]/10 bg-white px-4 py-3.5 text-left text-[12px] font-semibold text-foreground/70 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:text-foreground dark:border-white/10 dark:bg-[#10100e]"
                  )}
                >
                  <span className="font-sans text-[9px] tabular-nums tracking-[0.22em] text-foreground/35 mr-2">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4 py-5">
            {messages.map((m) => {
              const text = getMessageText(m);
              const parts = m.parts as Array<{
                type: string;
                [k: string]: unknown;
              }>;
              const showParts = getToolParts(parts, "mostrar_ejercicios");
              const ejerciciosAvanzadoParts = getToolParts(
                parts,
                "buscar_ejercicios_avanzado"
              );
              const createParts = getToolParts(parts, "crear_ejercicio");
              const sessionParts = getToolParts(parts, "crear_sesion");
              const alumnosParts = getToolParts(parts, "seleccionar_alumnos");
              const crearAlumnoParts = getToolParts(parts, "crear_alumno");
              const sesionMetaParts = getToolParts(
                parts,
                "configurar_sesion_meta"
              );
              const buscarContextoParts = getToolParts(
                parts,
                "buscar_contexto"
              );
              const analizarAlumnoParts = getToolParts(
                parts,
                "analizar_alumno"
              );
              const sesionesSimilaresParts = getToolParts(
                parts,
                "buscar_sesiones_similares"
              );
              const questions =
                m.role === "assistant" && m.id === lastMsgId && !isLoading
                  ? parseQuestions(text)
                  : null;
              const reasoningParts =
                m.role === "assistant"
                  ? (
                      m.parts as Array<{
                        type: string;
                        text?: string;
                        state?: string;
                      }>
                    ).filter(
                      (p) =>
                        p.type === "reasoning" && typeof p.text === "string"
                    )
                  : [];
              return (
                <div key={m.id} className="space-y-2 animate-fade-up">
                  {reasoningParts.map((p, i) => (
                    <ReasoningBubble
                      key={`r-${i}`}
                      text={p.text ?? ""}
                      streaming={
                        p.state === "streaming" ||
                        (isLoading &&
                          m.id === lastMsgId &&
                          i === reasoningParts.length - 1 &&
                          p.state !== "done")
                      }
                    />
                  ))}
                  <MarkdownBubble role={m.role} content={text} />
                  {alumnosParts.map((p, i) => (
                    <StudentPickerCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                      onSend={handleSend}
                    />
                  ))}
                  {crearAlumnoParts.map((p, i) => (
                    <CrearAlumnoCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                    />
                  ))}
                  {sesionMetaParts.map((p, i) => (
                    <ConfigurarSesionMetaCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                      onSend={handleSend}
                    />
                  ))}
                  {buscarContextoParts.map((p, i) => (
                    <BuscarContextoCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                    />
                  ))}
                  {analizarAlumnoParts.map((p, i) => (
                    <AnalizarAlumnoCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                    />
                  ))}
                  {sesionesSimilaresParts.map((p, i) => (
                    <SesionesSimilaresCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                    />
                  ))}
                  {[...showParts, ...ejerciciosAvanzadoParts].map((p, i) => {
                    if (p.state !== "output-available") return null;
                    const d = p.output as { ejercicios?: ExerciseItem[] };
                    if (!d?.ejercicios?.length) return null;
                    return (
                      <ExerciseGrid
                        key={i}
                        ejercicios={d.ejercicios}
                        selectedExercises={selectedExercises}
                        onToggle={toggleExercise}
                        onModify={handleModify}
                      />
                    );
                  })}
                  {createParts.map((p, i) => (
                    <ExerciseToolCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                    />
                  ))}
                  {sessionParts.map((p, i) => (
                    <SessionCreatedCard
                      key={i}
                      part={p as { state: string; output?: unknown }}
                    />
                  ))}
                  {questions && (
                    <QuestionForm
                      preguntas={questions}
                      onSubmit={(a) =>
                        sendMessage({
                          text: questions
                            .map((p) => `${p.label}: ${a[p.id]}`)
                            .join(", "),
                        })
                      }
                    />
                  )}
                </div>
              );
            })}
            {isLoading &&
              (() => {
                const last = messages[messages.length - 1];
                const lastParts = (last?.parts ?? []) as AnyPart[];
                const lastIsAssistant = last?.role === "assistant";
                const hasVisibleText =
                  lastIsAssistant &&
                  getMessageText(last)
                    .replace(/<preguntas>[\s\S]*?<\/preguntas>/g, "")
                    .trim().length > 0;
                const lastReasoning = lastIsAssistant
                  ? [...lastParts]
                      .reverse()
                      .find(
                        (p) =>
                          p.type === "reasoning" &&
                          typeof p.text === "string" &&
                          p.text!.trim().length > 0
                      )
                  : undefined;
                const isReasoningStreaming =
                  lastReasoning?.state !== "done" && !hasVisibleText;
                if (lastIsAssistant && lastReasoning && isReasoningStreaming)
                  return null;
                const activity = lastIsAssistant
                  ? findCurrentActivity(lastParts)
                  : null;
                const label =
                  status === "submitted"
                    ? "Conectando…"
                    : (activity ??
                      (hasVisibleText ? "Redactando respuesta…" : "Pensando…"));
                return (
                  <div className="flex gap-3 justify-start">
                    <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-[#050505]/10 bg-white dark:border-white/10 dark:bg-[#10100e]">
                      <Bot className="size-3.5 text-brand" strokeWidth={1.6} />
                    </div>
                    <div className="flex items-center gap-3 rounded-full border border-brand/25 bg-brand/10 px-4 py-2.5">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full bg-brand/60 opacity-75 animate-ping" />
                        <span className="relative inline-flex size-1.5 bg-brand" />
                      </span>
                      <span className="text-[10px] font-black uppercase text-foreground/65">
                        {label}
                      </span>
                      <span className="flex gap-[3px]">
                        <span
                          className="size-1 bg-brand/40 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="size-1 bg-brand/40 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="size-1 bg-brand/40 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </span>
                    </div>
                  </div>
                );
              })()}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Floating bar — exercises selected */}
      {selectedExercises.size > 0 && (
        <div className="shrink-0 border-t border-brand/30 bg-brand/10 px-4 py-3 sm:px-6 md:px-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-black tabular-nums leading-none text-brand">
                {String(selectedExercises.size).padStart(2, "0")}
              </span>
              <span className="text-[10px] font-black uppercase text-foreground/65">
                {tx("ejercicioV1SeleccionadoV2", { v1: selectedExercises.size !== 1 ? "s" : "", v2: selectedExercises.size !== 1 ? "s" : "" })}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedExercises(new Set())}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black uppercase text-foreground/55 transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" strokeWidth={1.6} />{" "}{tx("limpiar")}
              </button>
              <button
                onClick={() =>
                  router.push(
                    `/sessions/new?exercises=${Array.from(selectedExercises).join(",")}`
                  )
                }
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-[11px] font-black uppercase text-brand-foreground transition-colors hover:bg-brand/90"
              >
                <Plus className="size-3" strokeWidth={2} />{" "}{tx("crearSesion")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input — fixed bottom with safe area padding on mobile */}
      <div className="shrink-0 border-t border-[#050505]/10 bg-white/86 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86 sm:px-6 md:px-10">
        <div ref={inputWrapperRef} className="relative">
          {mentionQuery !== null && (
            <MentionPopover
              query={mentionQuery}
              results={mentionResults}
              loading={mentionLoading}
              onSelect={handleMentionSelect}
            />
          )}
          <div className="flex items-end gap-3 rounded-[26px] border border-[#050505]/10 bg-[#F4F4F1] px-4 py-3 transition-all focus-within:border-brand dark:border-white/10 dark:bg-white/[0.04]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={tx("describeLaSesionQue")}
              rows={1}
              className="flex-1 text-[14px] bg-transparent focus:outline-none text-foreground placeholder:text-foreground/40 resize-none max-h-32 py-0.5"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={() => {
                  stop();
                  fetch(`/api/dr-planner/chats/${chatId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messages }),
                  }).catch(() => {});
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-destructive/40 text-destructive transition-colors hover:bg-destructive/10"
                title={tx("detenerGeneracion")}
              >
                <X className="size-3.5" strokeWidth={1.6} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!input.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-colors hover:bg-brand/90 disabled:bg-foreground/10 disabled:text-foreground/40 disabled:opacity-30"
              >
                <Send className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/40">
              {tx("introEnviarShiftIntro")}
            </p>
            <div className="flex items-center gap-1">
              {MODEL_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  title={term(m.desc)}
                  onClick={() => updateModelMode(m.id)}
                  className={cn(
                    "font-sans text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 border transition-colors",
                    modelMode === m.id
                      ? "border-brand text-brand bg-brand/10"
                      : "border-foreground/15 text-foreground/40 hover:text-foreground/70 hover:border-foreground/30"
                  )}
                >
                  {term(m.label)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
