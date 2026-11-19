// Cartel del torneo en PDF (A4 vertical), con @react-pdf/renderer.
// Tres plantillas: clásica (blanca con franja azul), pista (azul con líneas
// de pista) y con imagen propia (foto arriba). Textos ya traducidos.

import {
  Document,
  Image,
  Line,
  Page,
  Rect,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { qrMatrix, qrRuns } from "./qr";

// Estilo de torneos: negro con letras blancas y detalles en lima.
export const POSTER_DARK = "#050505";
const DARK_PANEL = "#1c1f14";
const LIME = "#d6f04a";
const INK = "#0b0d05";

export type PosterTemplate = "classic" | "court" | "image";

export type PosterData = {
  name: string;
  kicker: string; // «Torneo · Tenis · Individual»
  dates: string;
  facts: { label: string; value: string }[];
  description: string | null;
  cta: string; // «Inscríbete» o «Consulta el cuadro»
  url: string;
  urlLabel: string; // sin https://
  organizer: string | null;
  organizedBy: string; // «Organiza»
  footer: string; // «Organizado con Ten Planner»
};

function Qr({
  text,
  size,
  color = INK,
}: {
  text: string;
  size: number;
  color?: string;
}) {
  const m = qrMatrix(text);
  const n = m.length;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
      {qrRuns(m).map(([x, y, w], i) => (
        <Rect key={i} x={x} y={y} width={w} height={1.02} fill={color} />
      ))}
    </Svg>
  );
}

function QrCard({ d, dark }: { d: PosterData; dark?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderRadius: 14,
        padding: 14,
        gap: 16,
        borderWidth: dark ? 0 : 2,
        borderColor: LIME,
      }}
    >
      <Qr text={d.url} size={112} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          style={{
            fontFamily: "Helvetica-Bold",
            fontSize: 20,
            color: POSTER_DARK,
          }}
        >
          {d.cta}
        </Text>
        <Text style={{ fontSize: 10.5, color: INK }}>{d.urlLabel}</Text>
      </View>
    </View>
  );
}

function Facts({
  d,
  color,
  big,
}: {
  d: PosterData;
  color: string;
  big?: boolean;
}) {
  return (
    <View style={{ gap: big ? 14 : 9 }}>
      {d.facts.map((f) => (
        <View key={f.label} style={{ flexDirection: "row", gap: 10 }}>
          <Text
            style={{
              width: 110,
              fontFamily: "Helvetica-Bold",
              fontSize: 9,
              letterSpacing: 1,
              color,
              opacity: 0.7,
              paddingTop: 2,
            }}
          >
            {f.label.toUpperCase()}
          </Text>
          <Text style={{ flex: 1, fontSize: big ? 16 : 13, color }}>
            {f.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ d, color }: { d: PosterData; color: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}
    >
      <View>
        {d.organizer && (
          <>
            <Text
              style={{ fontSize: 8.5, letterSpacing: 1, color, opacity: 0.7 }}
            >
              {d.organizedBy.toUpperCase()}
            </Text>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color }}>
              {d.organizer}
            </Text>
          </>
        )}
      </View>
      <Text style={{ fontSize: 8, color, opacity: 0.6 }}>{d.footer}</Text>
    </View>
  );
}

function Title({
  d,
  color,
  size = 40,
}: {
  d: PosterData;
  color: string;
  size?: number;
}) {
  const fontSize =
    d.name.length > 40 ? size * 0.7 : d.name.length > 24 ? size * 0.85 : size;
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontFamily: "Helvetica-Bold",
          fontSize: 10,
          letterSpacing: 2,
          color: color === "#ffffff" ? LIME : color,
          opacity: color === "#ffffff" ? 1 : 0.8,
        }}
      >
        {d.kicker.toUpperCase()}
      </Text>
      <Text
        style={{
          fontFamily: "Helvetica-Bold",
          fontSize,
          lineHeight: 1.05,
          color,
        }}
      >
        {d.name}
      </Text>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 18, color }}>
        {d.dates}
      </Text>
    </View>
  );
}

function Classic({ d }: { d: PosterData }) {
  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica" }}
    >
      <View
        style={{
          backgroundColor: POSTER_DARK,
          paddingHorizontal: 44,
          paddingTop: 84,
          paddingBottom: 56,
          paddingRight: 120,
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -50,
            top: -50,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: LIME,
          }}
        />
        <Title d={d} color="#ffffff" size={46} />
      </View>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 44,
          paddingVertical: 30,
          justifyContent: "space-between",
        }}
      >
        <View style={{ gap: 26, paddingTop: 10 }}>
          <Facts d={d} color={INK} big />
          {d.description && (
            <Text
              style={{
                fontSize: 11,
                lineHeight: 1.45,
                color: INK,
                opacity: 0.85,
              }}
            >
              {d.description}
            </Text>
          )}
        </View>
        <View style={{ gap: 22 }}>
          <QrCard d={d} />
          <Footer d={d} color={INK} />
        </View>
      </View>
    </Page>
  );
}

function CourtLines() {
  // Pista vista desde arriba, en blanco y con poca opacidad.
  const s = { stroke: "#ffffff", strokeWidth: 3, strokeOpacity: 0.16 };
  return (
    <View
      fixed
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <Svg width={595} height={842} viewBox="0 0 595 842">
        <Rect x={70} y={60} width={455} height={722} fill="none" {...s} />
        <Line x1={127} y1={60} x2={127} y2={782} {...s} />
        <Line x1={468} y1={60} x2={468} y2={782} {...s} />
        <Line x1={70} y1={421} x2={525} y2={421} {...s} strokeWidth={5} />
        <Line x1={127} y1={252} x2={468} y2={252} {...s} />
        <Line x1={127} y1={590} x2={468} y2={590} {...s} />
        <Line x1={297.5} y1={252} x2={297.5} y2={590} {...s} />
      </Svg>
    </View>
  );
}

function Court({ d }: { d: PosterData }) {
  return (
    <Page
      size="A4"
      style={{ backgroundColor: POSTER_DARK, fontFamily: "Helvetica" }}
    >
      <CourtLines />
      <View
        style={{
          position: "absolute",
          right: 46,
          top: 46,
          width: 70,
          height: 70,
          borderRadius: 35,
          backgroundColor: LIME,
        }}
      />
      <View
        style={{
          flex: 1,
          padding: 46,
          paddingTop: 70,
          justifyContent: "space-between",
        }}
      >
        <View style={{ gap: 26, paddingRight: 70 }}>
          <Title d={d} color="#ffffff" size={46} />
        </View>
        <View
          style={{
            backgroundColor: DARK_PANEL,
            borderRadius: 14,
            padding: 20,
            gap: 14,
          }}
        >
          <Facts d={d} color="#ffffff" />
          {d.description && (
            <Text
              style={{
                fontSize: 10.5,
                lineHeight: 1.45,
                color: "#ffffff",
                opacity: 0.85,
              }}
            >
              {d.description}
            </Text>
          )}
        </View>
        <View style={{ gap: 20 }}>
          <QrCard d={d} dark />
          <Footer d={d} color="#ffffff" />
        </View>
      </View>
    </Page>
  );
}

function WithImage({ d, image }: { d: PosterData; image: Buffer }) {
  return (
    <Page
      size="A4"
      style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica" }}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image
        src={image}
        style={{ width: 595, height: 360, objectFit: "cover" }}
      />
      <View
        style={{
          backgroundColor: POSTER_DARK,
          paddingHorizontal: 44,
          paddingVertical: 24,
        }}
      >
        <Title d={d} color="#ffffff" size={34} />
      </View>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 44,
          paddingVertical: 22,
          justifyContent: "space-between",
        }}
      >
        <Facts d={d} color={INK} />
        <View style={{ gap: 16 }}>
          <QrCard d={d} />
          <Footer d={d} color={INK} />
        </View>
      </View>
    </Page>
  );
}

export function PosterPdf({
  d,
  template,
  image,
}: {
  d: PosterData;
  template: PosterTemplate;
  image: Buffer | null;
}) {
  return (
    <Document title={d.name} author={d.organizer ?? "Ten Planner"}>
      {template === "image" && image ? (
        <WithImage d={d} image={image} />
      ) : template === "court" ? (
        <Court d={d} />
      ) : (
        <Classic d={d} />
      )}
    </Document>
  );
}
