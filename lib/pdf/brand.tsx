import { Path, Circle, Svg, Text, View } from "@react-pdf/renderer";

// Elementos visuales compartidos por todos los PDF de TenPlanner: paleta,
// marca de agua, tarjetas de cifras, barras y gráfico de anillo.

export const BRAND = "#2563EB";
export const BRAND_DARK = "#1E3A8A";
export const BRAND_LIGHT = "#EFF6FF";
export const BRAND_MUTED = "#93C5FD";
export const ACCENT = "#A3C520"; // verde pelota, el mismo que usa la app
export const SKY = "#38BDF8";
export const VIOLET = "#A78BFA";
export const AMBER = "#F59E0B";
export const GRAY = "#6B7280";
export const LIGHT_GRAY = "#F3F4F6";
export const BORDER = "#E5E7EB";

/** Colores en orden para series sin color propio. */
export const CHART_COLORS = [BRAND, ACCENT, VIOLET, SKY, AMBER, "#EC4899"];

/**
 * Marca de agua "TenPlanner" en diagonal, en todas las páginas. Se pone como
 * primer hijo de <Page> para que el contenido quede por encima.
 */
export function Watermark() {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 72,
          fontFamily: "Helvetica-Bold",
          color: BRAND,
          opacity: 0.06,
          transform: "rotate(-35deg)",
        }}
      >
        TenPlanner
      </Text>
    </View>
  );
}

/** Tarjeta con una cifra grande; `color` tiñe el borde izquierdo y el valor. */
export function StatTile({
  label,
  value,
  hint,
  color = BRAND,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 0,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: BORDER,
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderRadius: 6,
        padding: 9,
      }}
    >
      <Text
        style={{
          fontSize: 7,
          color: GRAY,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontFamily: "Helvetica-Bold",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 17,
          fontFamily: "Helvetica-Bold",
          color,
          marginTop: 3,
        }}
      >
        {value}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 7.5, color: GRAY, marginTop: 2 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Título de sección con barra de color a la izquierda. */
export function SectionHeading({
  children,
  color = BRAND,
}: {
  children: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 16,
        marginBottom: 8,
      }}
      minPresenceAhead={40}
    >
      <View
        style={{ width: 4, height: 13, borderRadius: 2, backgroundColor: color }}
      />
      <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>
        {children}
      </Text>
    </View>
  );
}

export interface BarRow {
  label: string;
  /** 0-100, ancho de la barra. */
  pct: number;
  /** Texto a la derecha de la barra (p. ej. "35 %"). */
  value: string;
  color?: string;
}

/** Barras horizontales con etiqueta y valor. */
export function HBars({ rows, color = BRAND }: { rows: BarRow[]; color?: string }) {
  return (
    <View style={{ gap: 5 }}>
      {rows.map((row, i) => (
        <View
          key={`${row.label}-${i}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          wrap={false}
        >
          <Text style={{ width: 82, fontSize: 8.5, color: "#374151" }}>
            {row.label}
          </Text>
          <View
            style={{
              flexGrow: 1,
              flexBasis: 0,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: LIGHT_GRAY,
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, row.pct))}%`,
                height: 9,
                borderRadius: 4.5,
                backgroundColor: row.color ?? color,
              }}
            />
          </View>
          <Text
            style={{
              width: 38,
              fontSize: 8.5,
              textAlign: "right",
              fontFamily: "Helvetica-Bold",
            }}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  // 0 rad = arriba, sentido horario.
  return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
}

/** Gráfico de anillo con leyenda a la derecha. */
export function Donut({
  slices,
  size = 96,
  centerLabel,
}: {
  slices: DonutSlice[];
  size?: number;
  centerLabel?: string;
}) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((sum, s) => sum + s.value, 0);
  const stroke = size * 0.2;
  const r = (size - stroke) / 2;
  const c = size / 2;
  let angle = 0;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={LIGHT_GRAY}
            strokeWidth={stroke}
            fill="none"
          />
          {total > 0 && data.length === 1 ? (
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={data[0].color}
              strokeWidth={stroke}
              fill="none"
            />
          ) : (
            data.map((s) => {
              const sweep = (s.value / total) * Math.PI * 2;
              const [x1, y1] = polar(c, c, r, angle);
              const [x2, y2] = polar(c, c, r, angle + sweep);
              const d = `M ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
              angle += sweep;
              return (
                <Path
                  key={s.label}
                  d={d}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                />
              );
            })
          )}
        </Svg>
        {centerLabel ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size,
              height: size,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: size * 0.17,
                fontFamily: "Helvetica-Bold",
                color: BRAND_DARK,
              }}
            >
              {centerLabel}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 4 }}>
        {data.map((s) => (
          <View
            key={s.label}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: s.color,
              }}
            />
            <Text style={{ fontSize: 8.5, color: "#374151" }}>
              {s.label} · {total > 0 ? Math.round((s.value / total) * 100) : 0} %
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Puntos de intensidad 1-5 (rellenos hasta `value`). */
export function IntensityDots({ value }: { value: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View
          key={n}
          style={{
            width: 9,
            height: 9,
            borderRadius: 4.5,
            backgroundColor: n <= value ? ACCENT : LIGHT_GRAY,
          }}
        />
      ))}
    </View>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Barra apilada (partes de un total) con leyenda debajo. */
export function StackedBar({ title, segments }: { title: string; segments: Segment[] }) {
  const data = segments.filter((s) => s.value > 0);
  const total = data.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;
  return (
    <View style={{ marginBottom: 8 }} wrap={false}>
      <Text
        style={{
          fontSize: 7,
          fontFamily: "Helvetica-Bold",
          color: GRAY,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      <View style={{ flexDirection: "row", height: 12, borderRadius: 6 }}>
        {data.map((s, i) => (
          <View
            key={s.label}
            style={{
              flexGrow: s.value,
              flexBasis: 0,
              backgroundColor: s.color,
              borderTopLeftRadius: i === 0 ? 6 : 0,
              borderBottomLeftRadius: i === 0 ? 6 : 0,
              borderTopRightRadius: i === data.length - 1 ? 6 : 0,
              borderBottomRightRadius: i === data.length - 1 ? 6 : 0,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
        {data.map((s) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: s.color }} />
            <Text style={{ fontSize: 8, color: "#374151" }}>
              {s.label} · {Math.round(s.value)} min ({Math.round((s.value / total) * 100)} %)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const PHASE_SEGMENT: { key: string; label: string; color: string }[] = [
  { key: "activation", label: "Calentamiento", color: SKY },
  { key: "main", label: "Parte principal", color: ACCENT },
  { key: "cooldown", label: "Vuelta a la calma", color: VIOLET },
];
const CATEGORY_SEGMENT: { key: string; label: string; color: string }[] = [
  { key: "technique", label: "Técnica", color: BRAND },
  { key: "tactics", label: "Táctica", color: AMBER },
  { key: "fitness", label: "Físico", color: "#EC4899" },
  { key: "warm-up", label: "Activación", color: SKY },
];

/** Reparto del tiempo por fase y por tipo de ejercicio de una clase/sesión. */
export function PlanCharts({
  exercises,
}: {
  exercises: {
    kind?: string;
    phase: string | null;
    category: string;
    durationMinutes: number | null;
  }[];
}) {
  const items = exercises.filter((e) => e.kind !== "text" && (e.durationMinutes ?? 0) > 0);
  if (items.length === 0) return null;
  const sum = (key: "phase" | "category", k: string) =>
    items.filter((e) => e[key] === k).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
  return (
    <View
      style={{
        marginBottom: 16,
        padding: 10,
        borderRadius: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <StackedBar
        title="Reparto por fase"
        segments={PHASE_SEGMENT.map((p) => ({ ...p, value: sum("phase", p.key) }))}
      />
      <StackedBar
        title="Reparto por tipo de ejercicio"
        segments={CATEGORY_SEGMENT.map((c) => ({ ...c, value: sum("category", c.key) }))}
      />
    </View>
  );
}
