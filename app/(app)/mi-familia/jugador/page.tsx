import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CircleCheck,
  CircleX,
  Clock,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getFamilyPlayers,
  getPlayerCalendar,
  pickPlayer,
  type FamilySession,
} from "@/lib/family-data";
import { holidayAppliesTo } from "@/lib/calendar/holidays";
import { ageFromBirthDate, attendanceSummary } from "@/lib/family-view";
import {
  FamilyHeader,
  NoPlayers,
  PlayerSwitcher,
} from "@/components/family/family-header";
import { LocalDateTime } from "@/components/family/local-time";

const DAY = 24 * 60 * 60 * 1000;
const PAST_DAYS = 90;
const LIST_LIMIT = 10;

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

function formatBirthDate(value: string) {
  return value.split("-").reverse().join("/");
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-foreground/45">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function AttendanceBadge({ attended }: { attended: boolean | null }) {
  if (attended === true)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
        <CircleCheck className="size-3.5" />
        Asistió
      </span>
    );
  if (attended === false)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e11d48]/15 px-2.5 py-1 text-[11px] font-black text-[#be123c] dark:text-[#fda4af]">
        <CircleX className="size-3.5" />
        No asistió
      </span>
    );
  return (
    <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
      Sin anotar
    </span>
  );
}

export default async function FamilyPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { alumno } = await searchParams;
  const players = await getFamilyPlayers(user.id);
  const player = pickPlayer(players, alumno);

  const now = new Date();
  const calendar = player
    ? await getPlayerCalendar(
        player,
        new Date(now.getTime() - PAST_DAYS * DAY),
        new Date(now.getTime() + 120 * DAY)
      )
    : null;

  // Una sesión cancelada, o que cae en un festivo que le afecta, no cuenta
  // para la asistencia ni como próxima clase.
  function isOff(s: FamilySession) {
    if (s.status === "cancelled") return true;
    const k = s.scheduledAt.toISOString().slice(0, 10);
    return (calendar?.holidays ?? []).some((h) =>
      holidayAppliesTo(h, k, s.groupId)
    );
  }
  const all = calendar?.sessions ?? [];
  const past = all.filter((s) => s.scheduledAt < now && !isOff(s));
  const upcoming = all.filter((s) => s.scheduledAt >= now && !isOff(s));
  const summary = attendanceSummary(past);
  const age = player ? ageFromBirthDate(player.birthDate) : null;
  const groupNames = new Map((player?.groups ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={UserRound}
          kicker="Panel de familias"
          title={player?.name ?? "Jugador"}
          description="Datos del jugador, asistencia y las clases a las que ha ido y a las que irá, con el objetivo de cada una."
        />
        {!player || !calendar ? (
          <NoPlayers />
        ) : (
          <>
            <PlayerSwitcher
              players={players}
              current={player.studentId}
              basePath="/mi-familia/jugador"
            />

            <section className="tp-panel space-y-4 p-5">
              <h2 className="text-lg font-black text-foreground">
                Datos personales
              </h2>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Nombre" value={player.name} />
                <Field
                  label="Fecha de nacimiento"
                  value={
                    player.birthDate
                      ? `${formatBirthDate(player.birthDate)}${age !== null ? ` (${age} años)` : ""}`
                      : null
                  }
                />
                <Field label="Nivel" value={player.playerLevel} />
                <Field
                  label="Mano dominante"
                  value={
                    player.dominantHand === "left"
                      ? "Zurda"
                      : player.dominantHand === "right"
                        ? "Diestra"
                        : null
                  }
                />
                <Field label="Club" value={player.clubName} />
                <Field
                  label="Grupo"
                  value={
                    player.groups.length > 0
                      ? player.groups.map((g) => g.name).join(", ")
                      : null
                  }
                />
              </dl>
              <p className="text-xs leading-5 text-muted-foreground">
                Si algún dato no es correcto, díselo al club o a su monitor.
              </p>
            </section>

            <section className="tp-panel space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
                <CalendarCheck className="size-5 text-brand" />
                Asistencia · últimos {PAST_DAYS} días
              </h2>
              {summary.rate === null ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay asistencia anotada en este periodo.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-brand/10 p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.rate}%
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      Asistencia
                    </p>
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.04] p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.present}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      Clases a las que fue
                    </p>
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.04] p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.absent}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      Faltas
                    </p>
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.04] p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.unrecorded}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      Sin anotar
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-black text-foreground">
                Próximas clases
              </h2>
              {upcoming.length === 0 ? (
                <div className="tp-panel border-dashed p-6 text-center text-sm text-muted-foreground">
                  No hay clases programadas próximamente.
                </div>
              ) : (
                upcoming.slice(0, LIST_LIMIT).map((s) => (
                  <div key={s.id} className="tp-panel space-y-1.5 p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1 rounded-full bg-brand/15 px-3 py-1 text-xs font-black capitalize text-brand">
                        <Clock className="size-3" />
                        <LocalDateTime
                          iso={s.scheduledAt.toISOString()}
                          options={dateTimeOptions}
                        />
                      </span>
                      <p className="text-sm font-semibold text-foreground">
                        {s.title}
                      </p>
                      {s.groupId && groupNames.get(s.groupId) && (
                        <span className="text-xs text-muted-foreground">
                          Grupo {groupNames.get(s.groupId)}
                        </span>
                      )}
                    </div>
                    {s.objective && (
                      <p className="text-sm leading-6 text-foreground/75">
                        <span className="font-black text-foreground">
                          Objetivo:{" "}
                        </span>
                        {s.objective}
                      </p>
                    )}
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-black text-foreground">
                Clases anteriores
              </h2>
              {past.length === 0 ? (
                <div className="tp-panel border-dashed p-6 text-center text-sm text-muted-foreground">
                  Todavía no hay clases anteriores en este periodo.
                </div>
              ) : (
                [...past]
                  .reverse()
                  .slice(0, LIST_LIMIT)
                  .map((s) => (
                    <div key={s.id} className="tp-panel space-y-1.5 p-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-xs font-black capitalize text-foreground/70">
                          <LocalDateTime
                            iso={s.scheduledAt.toISOString()}
                            options={dateTimeOptions}
                          />
                        </span>
                        <p className="text-sm font-semibold text-foreground">
                          {s.title}
                        </p>
                        <span className="ml-auto">
                          <AttendanceBadge attended={s.attended} />
                        </span>
                      </div>
                      {s.objective && (
                        <p className="text-sm leading-6 text-foreground/75">
                          <span className="font-black text-foreground">
                            Objetivo:{" "}
                          </span>
                          {s.objective}
                        </p>
                      )}
                    </div>
                  ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
