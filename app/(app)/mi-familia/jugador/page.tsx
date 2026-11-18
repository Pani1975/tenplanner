import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  CalendarCheck,
  CircleCheck,
  CircleX,
  Clock,
  UserRound,
  Video,
} from "lucide-react";
import { db } from "@/db";
import { studentVideos } from "@/db/schema";
import { StudentVideosPanel } from "@/components/app/student-videos-panel";
import {
  createFamilyVideo,
  deleteFamilyVideo,
  updateFamilyVideo,
} from "./video-actions";
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
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

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
  const tx = useTranslations("ui.s_jugador_page");
  if (attended === true)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:text-emerald-300">
        <CircleCheck className="size-3.5" />
        {tx("asistio")}
      </span>
    );
  if (attended === false)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e11d48]/15 px-2.5 py-1 text-[11px] font-black text-[#be123c] dark:text-[#fda4af]">
        <CircleX className="size-3.5" />
        {tx("noAsistio")}
      </span>
    );
  return (
    <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
      {tx("sinAnotar")}
    </span>
  );
}

export default async function FamilyPlayerPage({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string }>;
}) {
  const tx = await getTranslations("ui.s_jugador_page");
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
  // Solo las fichas de vídeo que ha creado esta familia (no las del monitor).
  // Si la tabla aún no existe, el panel se muestra sin la sección.
  const videos = player
    ? await db
        .select({
          id: studentVideos.id,
          location: studentVideos.location,
          event: studentVideos.event,
          recordedOn: studentVideos.recordedOn,
          notes: studentVideos.notes,
          videoUrl: studentVideos.videoUrl,
        })
        .from(studentVideos)
        .where(
          and(
            eq(studentVideos.studentId, player.studentId),
            eq(studentVideos.createdBy, user.id)
          )
        )
        .orderBy(desc(studentVideos.recordedOn), desc(studentVideos.createdAt))
        .catch((error) => {
          console.error("[family] videos failed", error);
          return null;
        })
    : null;
  const age = player ? ageFromBirthDate(player.birthDate) : null;
  const groupNames = new Map((player?.groups ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={UserRound}
          kicker="Panel de familias"
          title={player?.name ?? "Jugador"}
          description={tx("datosDelJugadorAsistencia")}
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
                {tx("datosPersonales")}
              </h2>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label={tx("nombre")} value={player.name} />
                <Field
                  label={tx("fechaDeNacimiento")}
                  value={
                    player.birthDate
                      ? `${formatBirthDate(player.birthDate)}${age !== null ? tx("v1Anos", { v1: age }) : ""}`
                      : null
                  }
                />
                <Field label={tx("nivel")} value={player.playerLevel} />
                <Field
                  label={tx("manoDominante")}
                  value={
                    player.dominantHand === "left"
                      ? "Zurda"
                      : player.dominantHand === "right"
                        ? "Diestra"
                        : null
                  }
                />
                <Field label={tx("club")} value={player.clubName} />
                <Field
                  label={tx("grupo")}
                  value={
                    player.groups.length > 0
                      ? player.groups.map((g) => g.name).join(", ")
                      : null
                  }
                />
              </dl>
              <p className="text-xs leading-5 text-muted-foreground">
                {tx("siAlgunDatoNo")}
              </p>
            </section>

            {videos && (
              <section className="tp-panel p-5">
                <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
                  <Video className="size-5 text-brand" />
                  {tx("videos")}
                </h2>
                <StudentVideosPanel
                  studentId={player.studentId}
                  studentName={player.name}
                  canEdit
                  initialVideos={videos}
                  actions={{
                    create: createFamilyVideo,
                    update: updateFamilyVideo,
                    remove: deleteFamilyVideo,
                  }}
                />
              </section>
            )}

            <section className="tp-panel space-y-4 p-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
                <CalendarCheck className="size-5 text-brand" />
                {tx("asistenciaUltimos")}{" "}{PAST_DAYS}{" "}{tx("dias")}
              </h2>
              {summary.rate === null ? (
                <p className="text-sm text-muted-foreground">
                  {tx("todaviaNoHayAsistencia")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-brand/10 p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.rate}%
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {tx("asistencia")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.04] p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.present}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {tx("clasesALasQue")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.04] p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.absent}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {tx("faltas")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-foreground/[0.04] p-4">
                    <p className="text-3xl font-black text-foreground">
                      {summary.unrecorded}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {tx("sinAnotar")}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-black text-foreground">
                {tx("proximasClases")}
              </h2>
              {upcoming.length === 0 ? (
                <div className="tp-panel border-dashed p-6 text-center text-sm text-muted-foreground">
                  {tx("noHayClasesProgramadas")}
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
                          {tx("grupoV1", { v1: groupNames.get(s.groupId) ?? "" })}
                        </span>
                      )}
                    </div>
                    {s.objective && (
                      <p className="text-sm leading-6 text-foreground/75">
                        <span className="font-black text-foreground">
                          {tx("objetivo", {  })}
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
                {tx("clasesAnteriores")}
              </h2>
              {past.length === 0 ? (
                <div className="tp-panel border-dashed p-6 text-center text-sm text-muted-foreground">
                  {tx("todaviaNoHayClases")}
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
                            {tx("objetivo", {  })}
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
