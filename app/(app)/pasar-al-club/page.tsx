import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { classes, exercises, sessions } from "@/db/schema";
import { getClubAccountClubId, getCoachMemberships } from "@/lib/clubs";
import { TransferClient } from "./transfer-client";

/**
 * "Pasar al club": el monitor elige varios ejercicios, clases y sesiones de
 * su entorno particular y los pasa a un club al que está vinculado.
 * Ejercicios y clases se copian (el original sigue en su entorno
 * particular); las sesiones se mueven al club, como en "Enviar al club" de
 * cada sesión (si se copiaran, saldrían dos veces en su calendario).
 */
export default async function PasarAlClubPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const [memberships, clubAccountClubId] = await Promise.all([
    getCoachMemberships(user.id),
    getClubAccountClubId(user.id),
  ]);
  if (clubAccountClubId || memberships.length === 0) redirect("/dashboard");
  const clubs = memberships.map((m) => ({ id: m.club.id, name: m.club.name }));

  const [exerciseRows, classRows, sessionRows] = await Promise.all([
    db
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(
        and(
          eq(exercises.createdBy, user.id),
          isNull(exercises.clubId),
          eq(exercises.isGlobal, false)
        )
      )
      .orderBy(exercises.name)
      .limit(500),
    db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(and(eq(classes.createdBy, user.id), isNull(classes.clubId)))
      .orderBy(classes.name)
      .limit(500),
    db
      .select({
        id: sessions.id,
        title: sessions.title,
        scheduledAt: sessions.scheduledAt,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), isNull(sessions.clubId)))
      .orderBy(desc(sessions.scheduledAt))
      .limit(500),
  ]);

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <header className="tp-hero-panel p-6 text-white sm:p-8">
          <div className="mb-5 inline-flex rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
            Entorno particular
          </div>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Pasar al club
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
            Marca lo que quieras llevar a un club. Los ejercicios y las clases
            se copian: el original sigue en tu entorno particular. Las sesiones
            pasan al club y las sigues viendo como tuyas; sus alumnos y grupo no
            viajan.
          </p>
        </header>
        <TransferClient
          clubs={clubs}
          exercises={exerciseRows.map((r) => ({ id: r.id, label: r.name }))}
          classes={classRows.map((r) => ({ id: r.id, label: r.name }))}
          sessions={sessionRows.map((r) => ({
            id: r.id,
            label: r.title,
            date: r.scheduledAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
