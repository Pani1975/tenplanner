import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubInvites, clubs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteButton } from "./accept-invite-button";
import { SPORT_LABELS } from "@/lib/sport-constants";
import { getTranslations } from "next-intl/server";
import { getTerm } from "@/lib/i18n-terms";

function isInviteExpired(invite: { status: string; expiresAt: Date }) {
  return invite.status === "expired" || invite.expiresAt.getTime() < Date.now();
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const term = await getTerm();
  const tx = await getTranslations("ui.s_token_page");
  const { token } = await params;

  const [row] = await db
    .select({ invite: clubInvites, club: clubs })
    .from(clubInvites)
    .innerJoin(clubs, eq(clubs.id, clubInvites.clubId))
    .where(eq(clubInvites.token, token))
    .limit(1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const card = (children: React.ReactNode) => (
    <div className="mx-auto w-full max-w-md rounded-[32px] border border-[#050505]/10 bg-white p-7 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e]">
      {children}
    </div>
  );

  if (!row) {
    return card(
      <>
        <h1 className="text-2xl font-black text-foreground">
          {tx("invitacionNoEncontrada")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/62">
          {tx("esteEnlaceDeInvitacion")}
        </p>
      </>
    );
  }

  const { invite, club } = row;
  const isExpired = isInviteExpired(invite);
  const isUsable = invite.status === "pending" && !isExpired;

  if (invite.status === "accepted") {
    return card(
      <>
        <h1 className="text-2xl font-black text-foreground">
          {tx("yaFormasParteDe", { v1: club.name })}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/62">
          {tx("estaInvitacionYaFue")}
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-black text-brand-foreground"
        >
          {tx("irAlPanel")}
        </Link>
      </>
    );
  }

  if (!isUsable) {
    return card(
      <>
        <h1 className="text-2xl font-black text-foreground">
          {tx("invitacionNoDisponible")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-foreground/62">
          {tx("estaInvitacionDe")}{" "}<strong>{club.name}</strong> ha caducado o fue
          anulada. Pide al club que te envíe una nueva.
        </p>
      </>
    );
  }

  const accountEmail = user?.email?.toLowerCase();
  const inviteEmail = invite.email.toLowerCase();

  return card(
    <>
      <p className="tp-kicker">
        {invite.inviteeName
          ? `Hola, ${invite.inviteeName}`
          : tx("invitacionDeClub")}
      </p>
      <h1 className="mt-3 text-2xl font-black leading-tight text-foreground">
        {tx("v1QuiereVincularteComo", { v1: club.name, v2: SPORT_LABELS[invite.sport] })}
      </h1>
      <p className="mt-3 text-sm leading-6 text-foreground/62">
        {tx("invitacionEnviadaA")}{" "}
        <span className="font-semibold text-foreground">{invite.email}</span>{" "}
        {tx("para")}{" "}<strong>{term(SPORT_LABELS[invite.sport])}</strong>. Al aceptar, el club
        tendrá acceso compartido a tus sesiones, alumnos, grupos y calendario de
        ese deporte. Tu cuenta sigue siendo tuya.
      </p>

      {!user && (
        <div className="mt-6 space-y-2">
          <p className="text-xs font-bold uppercase text-foreground/50">
            {tx("entraOCreaTu2", { v1: invite.email })}</p>
          <div className="flex gap-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-foreground/10 text-sm font-black text-foreground"
            >
              {tx("iniciarSesion")}
            </Link>
            <Link
              href={`/register?type=monitor&next=${encodeURIComponent(`/invite/${token}`)}`}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand text-sm font-black text-brand-foreground"
            >
              {tx("crearCuenta")}
            </Link>
          </div>
        </div>
      )}

      {user && accountEmail !== inviteEmail && (
        <p className="mt-6 rounded-[22px] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {tx("hasIniciadoSesionComo2", { v1: user.email ?? "", v2: invite.email ?? "" })}</p>
      )}

      {user && accountEmail === inviteEmail && (
        <div className="mt-6">
          <AcceptInviteButton token={token} clubName={club.name} />
        </div>
      )}
    </>
  );
}
