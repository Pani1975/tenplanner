import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { NotebookPen, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { clubCoachProfiles, clubs } from "@/db/schema";
import { COACH_PROFILE_LINK_EXPIRY_DAYS } from "@/lib/coach-profile";
import { FichaForm } from "./ficha-form";

export const metadata = {
  title: "Ficha de monitor",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

// Página pública (sin sesión): el monitor rellena su ficha con un enlace
// personal de un solo uso que le envía el gestor del club.
export default async function CoachProfileLinkPage({ params }: PageProps) {
  const { token } = await params;

  const [row] = await db
    .select({ profile: clubCoachProfiles, clubName: clubs.name })
    .from(clubCoachProfiles)
    .innerJoin(clubs, eq(clubs.id, clubCoachProfiles.clubId))
    .where(eq(clubCoachProfiles.profileToken, token))
    .limit(1);

  // Un enlace ya usado se anula, así que tampoco existe: mismo mensaje.
  if (!row) notFound();

  const { profile, clubName } = row;
  const expired =
    !profile.profileTokenExpiresAt ||
    profile.profileTokenExpiresAt < new Date();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F4F1] p-4 text-[#050505] dark:bg-[#050505] dark:text-white sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(5,5,5,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(5,5,5,.5) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className="relative my-6 w-full max-w-2xl">
        <div className="mb-5 flex items-center justify-between rounded-full border border-[#050505]/10 bg-white/85 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#D6FF38] text-[#050505]">
              <NotebookPen className="size-5" strokeWidth={2.3} />
            </div>
            <span className="text-sm font-black">
              ten<span className="text-brand">planner</span>
            </span>
          </div>
          <span className="rounded-full border border-[#050505]/10 px-3 py-1 text-[11px] font-black uppercase text-foreground/55 dark:border-white/10">
            Enlace personal
          </span>
        </div>

        <div className="rounded-[32px] border border-[#050505]/10 bg-white p-5 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e] sm:p-7">
          {expired ? (
            <div className="space-y-3 py-5 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
                <ShieldCheck className="size-5" />
              </div>
              <p className="text-xl font-black text-foreground">
                Enlace caducado
              </p>
              <p className="mx-auto max-w-sm text-sm leading-6 text-foreground/60">
                Este enlace ya no es válido. Pide al club que te envíe uno
                nuevo.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-2">
                <p className="tp-kicker">Ficha de monitor</p>
                <h1 className="text-3xl font-black leading-tight text-foreground">
                  Hola, {profile.fullName.split(" ")[0]}
                </h1>
                <p className="text-sm leading-6 text-foreground/62">
                  {clubName} te pide que rellenes tu ficha de monitor. Los datos
                  obligatorios son el nombre y apellidos, el email y el
                  teléfono; el resto es opcional.
                </p>
              </div>
              <FichaForm
                token={token}
                clubName={clubName}
                initial={{
                  fullName: profile.fullName,
                  email: profile.email,
                  phone: profile.phone,
                  academicTraining: profile.academicTraining,
                  tennisTraining: profile.tennisTraining,
                  availability: profile.availability,
                  startedTeachingYear: profile.startedTeachingYear,
                  experience: profile.experience ?? [],
                }}
              />
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] leading-5 text-foreground/50">
          Este enlace es personal, se puede usar una sola vez y caduca a los{" "}
          {COACH_PROFILE_LINK_EXPIRY_DAYS} días. Más información en la{" "}
          <Link
            href="/privacidad"
            target="_blank"
            className="font-semibold underline underline-offset-4 hover:text-foreground"
          >
            política de privacidad
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
