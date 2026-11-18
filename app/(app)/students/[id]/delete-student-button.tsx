"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

export function DeleteStudentButton({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const tx = useTranslations("ui.s_id_deletestudentbutton");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/students/${studentId}`, { method: "DELETE" });
    if (!res.ok) {
      setError(tx("noSePudoEliminar"));
      setDeleting(false);
      return;
    }
    router.push("/students");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive border border-destructive/30 px-3 py-2 rounded-lg hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="size-3.5" />
        <span className="hidden sm:inline">{tx("eliminar")}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">
                  {tx("eliminarAlumno")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {tx("sureDeleteStudent")}{" "}
                  <span className="font-medium text-foreground">
                    {studentName}
                  </span>
                  {tx("questionCannotUndo")}
                </p>
              </div>
              <button
                onClick={() => !deleting && setOpen(false)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => !deleting && setOpen(false)}
                disabled={deleting}
                className="flex-1 text-sm font-medium text-muted-foreground border border-border px-4 py-2.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                {tx("cancelar")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-destructive/90 active:scale-95 transition-all duration-150 disabled:opacity-60"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                {tx("eliminar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
