import {
  ASPECT_LABELS,
  GENDER_LABELS,
  type ClubDetailReport,
  type CountRow,
  type GenderKey,
  type RatedExercise,
} from "@/lib/club-report-detail";

// Bloques con los datos detallados del informe de gestión (los mismos que se
// pueden incluir en el PDF).

function num(value: number) {
  return String(value).replace(".", ",");
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-black text-foreground">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Big({ value, label }: { value: string | number; label?: string }) {
  return (
    <div>
      <p className="font-heading text-3xl font-black tabular-nums text-foreground">
        {value}
      </p>
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}

function Bars({
  rows,
  format = String,
}: {
  rows: { label: string; value: number }[];
  format?: (value: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate text-foreground/80">
            {r.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
            {format(r.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Reasons({ rows }: { rows: CountRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-[11px] font-black uppercase text-foreground/55">
        Motivos
      </p>
      <ul className="divide-y divide-border/60 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between gap-3 py-1.5">
            <span className="text-foreground/85">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RatedList({ rows }: { rows: RatedExercise[] }) {
  if (rows.length === 0) return <Empty>Sin datos todavía.</Empty>;
  return (
    <ul className="divide-y divide-border/60 text-sm">
      {rows.map((r) => (
        <li key={r.name} className="flex justify-between gap-3 py-1.5">
          <span className="text-foreground/85">{r.name}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {num(r.average)} / 5 ({r.count})
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReportBlocks({
  detail: d,
  phrase,
}: {
  detail: ClubDetailReport;
  phrase: string;
}) {
  const dateFmt = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const genders = (Object.keys(GENDER_LABELS) as GenderKey[])
    .map((k) => ({ label: GENDER_LABELS[k], value: d.students.gender[k] }))
    .filter((g) => g.value > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Alumnos y grupos" hint="Fichas y grupos del club.">
        <div className="flex gap-8">
          <Big value={d.students.total} label="alumnos" />
          <Big value={d.students.groups} label="grupos" />
        </div>
      </Block>

      <Block title="Alumnos por género">
        {genders.length === 0 ? (
          <Empty>No hay alumnos.</Empty>
        ) : (
          <Bars rows={genders} />
        )}
      </Block>

      <Block
        title="Edad"
        hint={`${d.students.agesCounted} de ${d.students.total} alumnos con fecha de nacimiento.`}
      >
        <div className="flex gap-8">
          <Big
            value={d.students.ageAverage === null ? "—" : num(d.students.ageAverage)}
            label="edad media (años)"
          />
          <Big
            value={d.students.ageMedian === null ? "—" : num(d.students.ageMedian)}
            label="edad mediana (años)"
          />
        </div>
      </Block>

      <Block
        title="De dónde vienen"
        hint={
          d.students.withoutLocality > 0
            ? `${d.students.withoutLocality} alumno(s) sin localidad.`
            : undefined
        }
      >
        {d.students.origins.length === 0 ? (
          <Empty>Ningún alumno tiene localidad registrada.</Empty>
        ) : (
          <Bars
            rows={d.students.origins
              .slice(0, 8)
              .map((o) => ({ label: o.label, value: o.count }))}
          />
        )}
      </Block>

      <Block
        title="Veces por semana que vienen"
        hint={`Media entre los ${d.weekly.students} alumno(s) con asistencia anotada en ${phrase}.`}
      >
        <Big
          value={d.weekly.average === null ? "—" : num(d.weekly.average)}
          label="clases por semana"
        />
      </Block>

      <Block title="Altas" hint={`Alumnos dados de alta en ${phrase}.`}>
        <Big value={d.signups.count} label="altas" />
        {d.signups.count > 0 && (
          <>
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-black uppercase text-foreground/55">
                Cómo nos conocieron
              </p>
              <Bars
                rows={d.signups.howFound.map((h) => ({
                  label: h.label,
                  value: h.count,
                }))}
              />
            </div>
            <ul className="mt-3 divide-y divide-border/60 text-sm">
              {d.signups.rows.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  className="flex justify-between gap-3 py-1.5"
                >
                  <span className="text-foreground/85">{r.name}</span>
                  <span className="text-muted-foreground">
                    {dateFmt.format(new Date(r.date))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Block>

      <Block title="Bajas" hint={`Alumnos dados de baja en ${phrase}.`}>
        <Big value={d.departures.count} label="bajas" />
        {d.departures.count > 0 && (
          <>
            <Reasons rows={d.departures.reasons} />
            <ul className="mt-3 divide-y divide-border/60 text-sm">
              {d.departures.rows.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  className="flex justify-between gap-3 py-1.5"
                >
                  <span className="text-foreground/85">{r.name}</span>
                  <span className="text-right text-muted-foreground">
                    {dateFmt.format(new Date(`${r.date}T12:00:00Z`))}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Block>

      <Block title="Clases por día de la semana">
        <Bars
          rows={d.weekdays.map((w) => ({ label: w.label, value: w.sessions }))}
        />
      </Block>

      <Block
        title="Ejercicios usados por monitor"
        hint="Usos totales y ejercicios distintos en las sesiones impartidas."
      >
        {d.exercisesByCoach.length === 0 ? (
          <Empty>No hay ejercicios en las sesiones del periodo.</Empty>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {d.exercisesByCoach.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-1.5">
                <span className="text-foreground/85">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {c.uses} usos · {c.distinct} distintos
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Ejercicio más repetido">
        {d.topExercises.length === 0 ? (
          <Empty>No hay ejercicios en las sesiones del periodo.</Empty>
        ) : (
          <>
            <p className="font-heading text-xl font-black text-foreground">
              {d.topExercises[0].name}
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              {d.topExercises[0].times} veces
            </p>
            {d.topExercises.length > 1 && (
              <Bars
                rows={d.topExercises.map((e) => ({
                  label: e.name,
                  value: e.times,
                }))}
              />
            )}
          </>
        )}
      </Block>

      <Block
        title="Aspectos del juego"
        hint="Porcentaje del tiempo de las sesiones por aspecto."
      >
        {d.aspects.every((a) => a.pct === 0) ? (
          <Empty>No hay tiempo clasificado por aspectos.</Empty>
        ) : (
          <Bars
            rows={d.aspects.map((a) => ({
              label: ASPECT_LABELS[a.key],
              value: a.pct,
            }))}
            format={(v) => `${v} %`}
          />
        )}
      </Block>

      <Block
        title="Valoración de las sesiones"
        hint={`${d.sessionRating.rated} de ${d.sessionRating.sessions} sesiones valoradas por el monitor.`}
      >
        <Big
          value={
            d.sessionRating.average === null
              ? "—"
              : `${num(d.sessionRating.average)} / 5`
          }
          label="valoración media"
        />
      </Block>

      <Block title="Ejercicios mejor valorados">
        <RatedList rows={d.bestExercises} />
      </Block>

      <Block title="Ejercicios peor valorados">
        <RatedList rows={d.worstExercises} />
      </Block>

      <Block title="Sesiones canceladas">
        <Big value={d.cancelled.count} />
        <Reasons rows={d.cancelled.reasons} />
      </Block>

      <Block
        title="Sesiones modificadas"
        hint={`Sesiones que no se dieron como estaba planificado (${d.modified.answered} con respuesta del monitor).`}
      >
        <Big value={d.modified.count} />
        <Reasons rows={d.modified.reasons} />
      </Block>
    </div>
  );
}
