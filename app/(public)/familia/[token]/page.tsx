import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getGuardianInvite, guardianStatus } from "@/lib/guardians";
import { AcceptFamilyInvite } from "./accept-family-invite";
import { getTranslations } from "next-intl/server";

// Invitación para que una familia (o un alumno adulto) reciba los mensajes
// del club sobre un alumno. Ruta pública: hay que poder abrirla sin cuenta.

export default async function FamilyInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const tx = await getTranslations("ui.s_token_page");
  const { token } = await params;
  const invite = await getGuardianInvite(token).catch(() => null);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const card = (children: React.ReactNode) => (
    <div className="mx-auto my-10 w-full max-w-md px-4">
      <div className="rounded-[32px] border border-[#050505]/10 bg-white p-7 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e]">
        {children}
      </div>
    </div>
  );

  const status = invite ? guardianStatus(invite.guardian) : null;

  if (!invite || status === "active" || status === "revoked") {
    return card(
      <>
        <h1 className="text-2xl font-black text-foreground">
          {tx("invitacionNoDisponible")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/62">
          {tx("esteEnlaceNoEs")}
        </p>
        <Link
          href={user ? "/mensajes" : "/login?next=/mensajes"}
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-black text-brand-foreground"
        >
          {user ? tx("irAMensajes") : "Iniciar sesión"}
        </Link>
      </>
    );
  }

  const clubName = invite.clubName ?? "El club";
  const g = invite.guardian;

  if (status === "expired") {
    return card(
      <>
        <h1 className="text-2xl font-black text-foreground">
          {tx("invitacionCaducada")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/62">
          {tx("estaInvitacionDe")}{" "}<strong>{clubName}</strong> ha caducado. Pide al
          club que te envíe un enlace nuevo.
        </p>
      </>
    );
  }

  const isSelf = g.relationship === "alumno";
  const accountEmail = user?.email?.toLowerCase() ?? null;
  const emailMismatch =
    !!user && !!g.email && g.email.toLowerCase() !== accountEmail;
  const next = `/familia/${token}`;

  return card(
    <>
      <p className="tp-kicker">{tx("mensajesDelClub")}</p>
      <h1 className="mt-3 text-2xl font-black leading-tight text-foreground">
        {isSelf
          ? `${clubName} quiere enviarte sus mensajes`
          : `${clubName} quiere enviarte sus mensajes sobre ${invite.studentName}`}
      </h1>
      <p className="mt-3 text-sm leading-6 text-foreground/62">
        {tx("hola")}{" "}{g.name}. Al activar tu acceso recibirás en Ten Planner los avisos
        del club{isSelf ? "" : ` sobre ${invite.studentName}`}: cambios de
        horario, sesiones canceladas e información de su grupo.
        {g.email && (
          <>
            {" "}
            {tx("laInvitacionEsPara")}{" "}
            <span className="font-semibold text-foreground">{g.email}</span>.
          </>
        )}
      </p>

      {!user && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-bold uppercase text-foreground/50">
            {tx("entraOCreaTu", { v1: g.email ? tx("withEmailSuffix", { email: g.email }) : "" })}</p>
          <div className="flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-foreground/10 text-sm font-black text-foreground"
            >
              {tx("iniciarSesion")}
            </Link>
            <Link
              href={`/register?type=familia&next=${encodeURIComponent(next)}`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand text-sm font-black text-brand-foreground"
            >
              {tx("crearCuenta")}
            </Link>
          </div>
          <p className="text-xs leading-5 text-foreground/55">
            {tx("siCreasLaCuenta")}
          </p>
        </div>
      )}

      {emailMismatch && (
        <p className="mt-6 rounded-[22px] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {tx("hasIniciadoSesionComo", { v1: user?.email ?? "", v2: g.email ?? "" })}</p>
      )}

      {user && !emailMismatch && (
        <div className="mt-6">
          <AcceptFamilyInvite token={token} clubName={clubName} />
        </div>
      )}
    </>
  );
}
