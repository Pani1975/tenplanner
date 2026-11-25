import { redirect } from "next/navigation";
import { CalendarCheck, CircleCheck, CircleX, Clock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { LocalDateTime } from "@/components/family/local-time";
import { listClubSessionsForPlayer } from "@/lib/players/club";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sesiones" };

const DAY = 24 * 60 * 60 * 1000;
const dateTime: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

type Row = {
  id: string;
  title: string;
  scheduledAt: Date;
  status: string;
  objective: string | null;
  location: string | null;
  extra: string | null;
  attended?: boolean | null;
};

function SessionList({ rows, showAttendance }: { rows: Row[]; showAttendance: boolean }) {
  if (rows.length === 0)
    return <p className="text-sm text-foreground/55">No hay sesiones.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((s) => {
        const cancelled = s.status === "cancelled";
        return (
          <li key={s.id} className="tp-panel space-y-1.5 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-black text-foreground">
                <LocalDateTime iso={s.scheduledAt.toISOString()} options={dateTime} />
              </span>
              <p className={cn("text-sm font-semibold", cancelled && "line-through opacity-60")}>
                {s.title}
              </p>
              {s.extra && <span className="text-xs text-muted-foreground">{s.extra}</span>}
              {cancelled && (
                <span className="rounded-full bg-[#e11d48]/15 px-2.5 py-1 text-[11px] font-black text-[#be123c] dark:text-[#fda4af]">
                  Cancelada
                </span>
              )}
              {showAttendance && !cancelled && s.attended !== undefined && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-foreground/70">
                  {s.attended === true ? (
                    <>
                      <CircleCheck className="size-3.5" /> Asististe
                    </>
                  ) : s.attended === false ? (
                    <>
                      <CircleX className="size-3.5" /> No asististe
                    </>
                  ) : (
                    <>
                      <Clock className="size-3.5" /> Sin anotar
                    </>
                  )}
                </span>
              )}
            </div>
            {s.location && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                {s.location}
              </p>
            )}
            {s.objective && !cancelled && (
              <p className="text-sm leading-6 text-foreground/75">
                <span className="font-black text-foreground">Objetivo: </span>
                {s.objective}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Sesiones del club al que está vinculado el jugador, pasadas y próximas
 * (sin alumnos, ejercicios ni asistencia). Un jugador no crea sesiones.
 */
export default async function JugadorSesionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const from = new Date(now.getTime() - 180 * DAY);
  const to = new Date(now.getTime() + 180 * DAY);

  const rows: Row[] = (await listClubSessionsForPlayer(user.id, from, to).catch(() => [])).map(
    (s) => ({ ...s, extra: s.groupName ? `Grupo ${s.groupName}` : null })
  );
  rows.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const upcoming = rows.filter((r) => r.scheduledAt >= now);
  const past = rows.filter((r) => r.scheduledAt < now).reverse();

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={CalendarCheck}
          kicker="Jugador"
          title="Sesiones del club"
          description="Las sesiones de tu club, pasadas y próximas. Las crea el club; tú las consultas."
        />
        <section className="space-y-3">
          <h2 className="text-lg font-black">Próximas</h2>
          <SessionList rows={upcoming} showAttendance={false} />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-black">Pasadas</h2>
          <SessionList rows={past} showAttendance={false} />
        </section>
      </div>
    </div>
  );
}
