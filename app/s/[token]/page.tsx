import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { NotebookPen, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { students, users } from "@/db/schema";
import { ProfileForm } from "./profile-form";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function StudentProfilePage({ params }: PageProps) {
  const tx = await getTranslations("ui.s_token_page");
  const { token } = await params;

  const [student] = await db
    .select({
      id: students.id,
      name: students.name,
      coachId: students.coachId,
      profileToken: students.profileToken,
      profileTokenExpiresAt: students.profileTokenExpiresAt,
    })
    .from(students)
    .where(eq(students.profileToken, token))
    .limit(1);

  if (!student) notFound();

  const [coach] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, student.coachId))
    .limit(1);

  const now = new Date();
  const expired =
    !student.profileTokenExpiresAt || student.profileTokenExpiresAt < now;

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

      <div className="relative w-full max-w-lg">
        <div className="mb-5 flex items-center justify-between rounded-full border border-[#050505]/10 bg-white/85 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#D6FF38] text-[#050505]">
              <NotebookPen className="size-5" strokeWidth={2.3} />
            </div>
            <span className="text-sm font-black">
              {tx("ten")}<span className="text-brand">{tx("planner")}</span>
            </span>
          </div>
          <span className="rounded-full border border-[#050505]/10 px-3 py-1 text-[11px] font-black uppercase text-foreground/55 dark:border-white/10">
            {tx("perfilSeguro")}
          </span>
        </div>

        <div className="rounded-[32px] border border-[#050505]/10 bg-white p-5 shadow-[0_28px_90px_-50px_rgba(5,5,5,0.65)] dark:border-white/10 dark:bg-[#10100e] sm:p-7">
          {expired ? (
            <div className="space-y-3 py-5 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
                <ShieldCheck className="size-5" />
              </div>
              <p className="text-xl font-black text-foreground">
                {tx("enlaceCaducado")}
              </p>
              <p className="mx-auto max-w-sm text-sm leading-6 text-foreground/60">
                {tx("esteEnlaceYaNo2")}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-2">
                <p className="tp-kicker">{tx("fichaDeJugador")}</p>
                <h1 className="text-3xl font-black leading-tight text-foreground">
                  {tx("holaV1", { v1: student.name })}
                </h1>
                <p className="text-sm leading-6 text-foreground/62">
                  {tx("v1TeHaInvitado", { v1: coach?.name ?? tx("yourCoach") })}</p>
              </div>
              <ProfileForm
                token={token}
                initialName={student.name}
                coachName={coach?.name ?? null}
              />
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] leading-5 text-foreground/50">
          Este enlace expira en 7 días y es de uso exclusivo para ti. Al
          enviarlo aceptas la{" "}
          <Link
            href="/privacidad"
            target="_blank"
            className="font-semibold underline underline-offset-4 hover:text-foreground"
          >
            {tx("politicaDePrivacidad")}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
