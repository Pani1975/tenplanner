"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function SetupPage() {
  const tx = useTranslations("ui.s_setup_page");
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  async function handleBootstrap() {
    setStatus("loading");
    try {
      const headers = token.trim()
        ? { "x-bootstrap-token": token.trim() }
        : undefined;
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        setMessage(data.error ?? "Error inesperado.");
        setStatus("error");
      } else {
        setMessage(data.message ?? "Listo.");
        setStatus("done");
        setTimeout(() => router.push("/admin"), 1800);
      }
    } catch {
      setMessage(tx("noSePudoContactar"));
      setStatus("error");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F4F1] p-4 text-[#050505] dark:bg-[#050505] dark:text-white sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.045] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(5,5,5,.48) 1px, transparent 1px), linear-gradient(90deg, rgba(5,5,5,.48) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative w-full max-w-md rounded-[32px] border border-[#050505]/10 bg-white p-5 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e] sm:p-7">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-[#D6FF38] text-[#050505]">
              <Shield className="size-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-sm font-black">{tx("tenplanner")}</p>
              <p className="text-xs font-semibold text-foreground/45">
                {tx("arranqueSeguro")}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#050505]/10 px-3 py-1 text-[11px] font-black uppercase text-foreground/55 dark:border-white/10">
            {tx("setup")}
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-black leading-tight text-foreground">
            {tx("configuracionInicial")}
          </h1>
          <p className="text-sm leading-6 text-foreground/62">
            {tx("noHayAdministradorDetectado")}
          </p>
          <p className="rounded-2xl border border-[#050505]/10 bg-[#F4F4F1] px-4 py-3 text-xs font-semibold leading-5 text-foreground/58 dark:border-white/10 dark:bg-white/[0.04]">
            {tx("esteFlujoSeDesactiva")}
          </p>
        </div>

        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={tx("tokenDeArranqueOpcional")}
          className="tp-field mt-6 h-11 w-full px-4 text-sm font-medium placeholder:text-muted-foreground"
        />

        {status === "idle" && (
          <Button
            className="mt-4 h-11 w-full rounded-full"
            onClick={handleBootstrap}
          >
            {tx("hacermeAdministrador")}
          </Button>
        )}

        {status === "loading" && (
          <Button className="mt-4 h-11 w-full rounded-full" disabled>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {tx("configurando")}
          </Button>
        )}

        {status === "done" && (
          <div className="mt-4 rounded-3xl border border-brand/35 bg-brand/12 px-4 py-4">
            <div className="flex items-center justify-center gap-2 text-foreground">
              <CheckCircle2 className="size-4 shrink-0" />
              <p className="text-sm font-medium">{message}</p>
            </div>
            <p className="mt-1 text-center text-xs text-foreground/50">
              {tx("redirigiendoAlPanel")}
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 rounded-3xl border border-destructive/25 bg-destructive/10 px-4 py-4">
            <div className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <p className="text-sm font-medium">{message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
