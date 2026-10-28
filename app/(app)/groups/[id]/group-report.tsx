import { BarChart3 } from "lucide-react";
import { GROUP_LEVEL_LABEL, type GroupReport } from "@/lib/groups/report";

const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Madrid",
});

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bar({ percent }: { percent: number | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-brand"
        style={{ width: `${percent ?? 0}%` }}
      />
    </div>
  );
}

export function GroupReportSection({
  groupName,
  report,
}: {
  groupName: string;
  report: GroupReport;
}) {
  const pct = (value: number | null) => (value === null ? "—" : `${value}%`);
  const rating = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(1)} / 5`;

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="size-4 text-brand" />
        <h2 className="text-sm font-black uppercase tracking-wide text-foreground">
          Informe de {groupName}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Impartidas"
          value={String(report.taught)}
          hint={`${report.hoursTaught} h en total`}
        />
        <Stat
          label="Asistencia"
          value={pct(report.attendanceRate)}
          hint={
            report.unrecordedTaught > 0
              ? `${report.unrecordedTaught} sin registrar`
              : "Todas registradas"
          }
        />
        <Stat
          label="Valoración media"
          value={rating(report.avgRating)}
          hint={`${report.ratingsCount} valoraciones`}
        />
        <Stat
          label="Intensidad media"
          value={
            report.avgIntensity === null ? "—" : `${report.avgIntensity} / 5`
          }
          hint={
            report.lastTaughtAt
              ? `Última: ${dateFormat.format(report.lastTaughtAt)}`
              : "Sin sesiones impartidas"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">
            Alumnos
          </h3>
          {report.students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este grupo no tiene alumnos todavía.
            </p>
          ) : (
            <ul className="space-y-3">
              {report.students.map((s) => (
                <li key={s.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold text-foreground">
                      {s.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {s.sessionsRecorded > 0
                        ? `${s.attended}/${s.sessionsRecorded} asist. · ${pct(s.attendanceRate)}`
                        : "Sin registros"}
                      {s.avgRating !== null && ` · ★ ${s.avgRating.toFixed(1)}`}
                    </span>
                  </div>
                  <Bar percent={s.attendanceRate} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-muted-foreground">
            Niveles
          </h3>
          {report.levels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alumnos.</p>
          ) : (
            <ul className="space-y-2">
              {report.levels.map((l) => (
                <li
                  key={l.level}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-foreground">
                    {GROUP_LEVEL_LABEL[l.level] ?? "Sin nivel"}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {l.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 text-xs text-muted-foreground">
            {report.upcoming} próxima{report.upcoming !== 1 ? "s" : ""} sesión
            {report.upcoming !== 1 ? "es" : ""}
            {report.nextAt &&
              ` · la siguiente el ${dateFormat.format(report.nextAt)}`}
          </p>
        </div>
      </div>
    </section>
  );
}
