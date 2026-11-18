"use client";

import { useState, type DragEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserPlus,
  UserMinus,
  Trash2,
  Loader2,
  Users,
  Search,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciación",
  amateur: "Amateur",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  competitive: "Competitivo",
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: "bg-sky-500/10 text-sky-400",
  amateur: "bg-emerald-500/10 text-emerald-400",
  intermediate: "bg-brand/10 text-brand",
  advanced: "bg-violet-500/10 text-violet-400",
  competitive: "bg-amber-500/10 text-amber-400",
};

interface Student {
  id: string;
  name: string;
  imageUrl: string | null;
  playerLevel: string | null;
}

interface Props {
  groupId: string;
  groupName: string;
  members: Student[];
  availableStudents: Student[];
  isOwner?: boolean;
}

function Avatar({
  name,
  imageUrl,
  size = 36,
}: {
  name: string;
  imageUrl: string | null;
  size?: number;
}) {
  const text = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 select-none items-center justify-center rounded-full bg-brand/15 font-black text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.33 }}
    >
      {text}
    </span>
  );
}

export function GroupDetailClient({
  groupId,
  groupName,
  members,
  availableStudents,
  isOwner = true,
}: Props) {
  const tx = useTranslations("ui.s_id_groupdetailclient");
  const router = useRouter();
  const [currentMembers, setCurrentMembers] = useState(members);
  const [available, setAvailable] = useState(availableStudents);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<{
    student: Student;
    from: "members" | "available";
  } | null>(null);

  const filteredAvailable = available.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  async function addStudent(student: Student) {
    setLoadingId(student.id);
    const newMembers = [...currentMembers, student].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: newMembers.map((m) => m.id) }),
    });
    if (res.ok) {
      setCurrentMembers(newMembers);
      setAvailable((prev) => prev.filter((s) => s.id !== student.id));
    }
    setLoadingId(null);
  }

  async function removeStudent(studentId: string) {
    setLoadingId(studentId);
    const newMembers = currentMembers.filter((m) => m.id !== studentId);
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: newMembers.map((m) => m.id) }),
    });
    if (res.ok) {
      const removed = currentMembers.find((m) => m.id === studentId)!;
      setCurrentMembers(newMembers);
      setAvailable((prev) =>
        [...prev, removed].sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    setLoadingId(null);
  }

  async function deleteGroup() {
    setDeletingGroup(true);
    const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/groups");
      router.refresh();
    }
    setDeletingGroup(false);
  }

  function onDropMembers(e: DragEvent) {
    e.preventDefault();
    if (isOwner && dragging?.from === "available")
      void addStudent(dragging.student);
    setDragging(null);
  }

  function onDropAvailable(e: DragEvent) {
    e.preventDefault();
    if (isOwner && dragging?.from === "members")
      void removeStudent(dragging.student.id);
    setDragging(null);
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
      {/* Members roster */}
      <div
        className="overflow-hidden rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropMembers}
      >
        <div className="flex items-center justify-between border-b border-[#050505]/10 px-4 py-4 dark:border-white/10 sm:px-6">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-brand" />
            <h2 className="text-[13px] font-black uppercase text-foreground">
              {tx("equipo")}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-black tabular-nums text-foreground">
            {currentMembers.length}
          </span>
        </div>

        {currentMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-[#050505]/10 bg-[#F4F4F1] dark:border-white/10 dark:bg-white/[0.04]">
              <Users className="size-5 text-foreground/20" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground/40">
                {tx("sinAlumnosTodavia")}
              </p>
              <p className="text-xs text-foreground/25 mt-0.5">
                {tx("anadeAlumnosDesdeEl")}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#050505]/10 dark:divide-white/10">
            {currentMembers.map((m, i) => (
              <div
                key={m.id}
                draggable={isOwner}
                onDragStart={() =>
                  isOwner && setDragging({ student: m, from: "members" })
                }
                onDragEnd={() => setDragging(null)}
                className="group/row flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F4F4F1] dark:hover:bg-white/[0.04] sm:px-5"
              >
                {/* Position number */}
                <span className="font-mono text-[10px] text-foreground/20 tabular-nums w-5 shrink-0 text-right">
                  {(i + 1).toString().padStart(2, "0")}
                </span>

                <Avatar name={m.name} imageUrl={m.imageUrl} size={34} />

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/students/${m.id}`}
                    className="group/link flex items-center gap-1 truncate text-[14px] font-black text-foreground transition-colors hover:text-brand"
                  >
                    {m.name}
                    <ChevronRight className="size-3 opacity-0 group-hover/link:opacity-100 -translate-x-1 group-hover/link:translate-x-0 transition-all" />
                  </Link>
                  {m.playerLevel && (
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                        LEVEL_COLOR[m.playerLevel] ??
                          "bg-foreground/10 text-foreground/40"
                      )}
                    >
                      {LEVEL_LABEL[m.playerLevel] ?? m.playerLevel}
                    </span>
                  )}
                </div>

                {isOwner && (
                  <button
                    onClick={() => removeStudent(m.id)}
                    disabled={loadingId === m.id}
                    aria-label={tx("quitarDelGrupo")}
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 md:opacity-0 md:group-hover/row:opacity-100"
                  >
                    {loadingId === m.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserMinus className="size-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: add students + danger zone */}
      <div className="space-y-4 lg:sticky lg:top-6">
        {/* Add students */}
        {isOwner && (
          <div
            className="overflow-hidden rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropAvailable}
          >
            <div className="flex items-center gap-2 border-b border-[#050505]/10 px-5 py-4 dark:border-white/10">
              <UserPlus className="size-4 text-brand" />
              <h2 className="text-[13px] font-black uppercase text-foreground">
                {tx("anadirAlumno")}
              </h2>
            </div>

            {available.length > 4 && (
              <div className="px-4 pt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-foreground/30 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={tx("buscarAlumno")}
                    className="tp-field h-10 w-full pl-8 pr-3 text-[13px] font-medium placeholder:text-foreground/30"
                  />
                </div>
              </div>
            )}

            <div className="mt-2 max-h-72 divide-y divide-[#050505]/10 overflow-y-auto dark:divide-white/10">
              {filteredAvailable.length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-muted-foreground italic text-center">
                  {available.length === 0
                    ? tx("todosTusAlumnosYa")
                    : "Sin resultados."}
                </p>
              ) : (
                filteredAvailable.map((s) => (
                  <button
                    key={s.id}
                    draggable
                    onDragStart={() =>
                      setDragging({ student: s, from: "available" })
                    }
                    onDragEnd={() => setDragging(null)}
                    onClick={() => addStudent(s)}
                    disabled={loadingId === s.id}
                    className="flex w-full touch-manipulation items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand/10 disabled:opacity-50"
                  >
                    <Avatar name={s.name} imageUrl={s.imageUrl} size={30} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {s.name}
                      </p>
                      {s.playerLevel && (
                        <p className="text-[10px] text-muted-foreground">
                          {LEVEL_LABEL[s.playerLevel] ?? s.playerLevel}
                        </p>
                      )}
                    </div>
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full text-brand">
                      {loadingId === s.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Danger zone */}
        {isOwner && (
          <div className="rounded-[28px] border border-destructive/20 bg-white p-5 shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:bg-[#10100e]">
            <h3 className="mb-3 text-[10px] font-black uppercase text-destructive/60">
              {tx("zonaDePeligro")}
            </h3>
            {showDeleteConfirm ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground leading-relaxed">
                  {tx("eliminar")}{" "}<strong>{groupName}</strong>{tx("questionCannotUndo")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-full border border-[#050505]/10 px-3 py-2 text-[13px] font-black text-muted-foreground transition-colors hover:bg-muted dark:border-white/10"
                  >
                    {tx("cancelar")}
                  </button>
                  <button
                    onClick={deleteGroup}
                    disabled={deletingGroup}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-destructive px-3 py-2 text-[13px] font-black text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {deletingGroup && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    {tx("eliminar2")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-2 text-[13px] font-black text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />{" "}{tx("eliminarGrupo")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
