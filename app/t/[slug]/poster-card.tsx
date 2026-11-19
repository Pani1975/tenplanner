import type { PosterData, PosterTemplate } from "@/lib/tournaments/poster-pdf";
import { qrMatrix, qrRuns } from "@/lib/tournaments/qr";
import { cn } from "@/lib/utils";

const LIME = "#d6f04a";

function Qr({ text, className }: { text: string; className?: string }) {
  const m = qrMatrix(text);
  const n = m.length;
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      className={className}
      role="img"
      aria-label="QR"
      shapeRendering="crispEdges"
    >
      <rect width={n} height={n} fill="#fff" />
      {qrRuns(m).map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={1} fill="#0b0d05" />
      ))}
    </svg>
  );
}

/**
 * Cartel del torneo en la web: el mismo diseño que el PDF (clásica, pista o
 * con imagen), en proporción A4. Solo servidor.
 */
export function PosterCard({
  d,
  template,
  imageUrl,
}: {
  d: PosterData;
  template: PosterTemplate;
  imageUrl: string | null;
}) {
  const dark = template === "court";
  const withImage = template === "image" && !!imageUrl;
  const facts = d.facts.slice(0, withImage ? 3 : 5);

  const title = (
    <div className="space-y-1">
      <p
        className="text-[9px] font-bold uppercase tracking-[0.18em]"
        style={{ color: LIME }}
      >
        {d.kicker}
      </p>
      <p className="font-sans text-xl font-extrabold leading-tight text-white">
        {d.name}
      </p>
      <p className="text-xs font-bold text-white">{d.dates}</p>
    </div>
  );

  const factList = (
    <dl className="space-y-1">
      {facts.map((f) => (
        <div key={f.label} className="flex gap-2 text-[10px] leading-snug">
          <dt
            className={cn(
              "w-20 shrink-0 font-bold uppercase tracking-wide",
              dark ? "text-white/60" : "text-black/55"
            )}
          >
            {f.label}
          </dt>
          <dd className={dark ? "text-white" : "text-black"}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );

  const qrCard = (
    <div
      className="flex items-center gap-2 rounded-lg bg-white p-2"
      style={dark ? undefined : { border: `2px solid ${LIME}` }}
    >
      <Qr text={d.url} className="size-14 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-black">{d.cta}</p>
        <p className="truncate text-[9px] text-black/70">{d.urlLabel}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-end justify-between gap-2">
      {d.organizer ? (
        <div className="min-w-0">
          <p
            className={cn(
              "text-[8px] uppercase tracking-wide",
              dark ? "text-white/60" : "text-black/55"
            )}
          >
            {d.organizedBy}
          </p>
          <p
            className={cn(
              "truncate text-[11px] font-bold",
              dark ? "text-white" : "text-black"
            )}
          >
            {d.organizer}
          </p>
        </div>
      ) : (
        <span />
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex aspect-[1/1.414] w-full flex-col overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10",
        dark ? "bg-[#050505]" : "bg-white"
      )}
    >
      {dark && (
        // Líneas de pista vistas desde arriba.
        <svg
          viewBox="0 0 595 842"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          <g stroke="#fff" strokeOpacity="0.16" strokeWidth="3" fill="none">
            <rect x="70" y="60" width="455" height="722" />
            <line x1="127" y1="60" x2="127" y2="782" />
            <line x1="468" y1="60" x2="468" y2="782" />
            <line x1="70" y1="421" x2="525" y2="421" strokeWidth="5" />
            <line x1="127" y1="252" x2="468" y2="252" />
            <line x1="127" y1="590" x2="468" y2="590" />
            <line x1="297.5" y1="252" x2="297.5" y2="590" />
          </g>
        </svg>
      )}

      {withImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl!} alt="" className="h-[42%] w-full object-cover" />
      )}

      {dark ? (
        <div className="relative flex flex-1 flex-col justify-between p-5">
          <span
            className="absolute right-5 top-5 size-8 rounded-full"
            style={{ background: LIME }}
          />
          <div className="pr-10 pt-4">{title}</div>
          <div className="rounded-lg bg-[#1c1f14] p-3">{factList}</div>
          <div className="space-y-2">
            {qrCard}
            {footer}
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "relative overflow-hidden bg-[#050505] px-5",
              withImage ? "py-3" : "pb-5 pt-8"
            )}
          >
            {!withImage && (
              <span
                className="absolute -right-6 -top-6 size-16 rounded-full"
                style={{ background: LIME }}
              />
            )}
            <div className={withImage ? "" : "pr-8"}>{title}</div>
          </div>
          <div className="flex flex-1 flex-col justify-between gap-2 p-5">
            {factList}
            <div className="space-y-2">
              {qrCard}
              {footer}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
