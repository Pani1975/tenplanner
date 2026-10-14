import { ImageResponse } from "next/og";

export const alt =
  "TenPlanner: la clase la piensas tú, Ten Planner te ayuda. Planificación para monitores de tenis.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#050505",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 44,
          fontWeight: 700,
        }}
      >
        Ten<span style={{ color: "#d6ff38", margin: "0 10px" }}>·</span>
        Planner
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
          La clase la piensas tú.
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#d6ff38",
          }}
        >
          Ten Planner te ayuda.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: "rgba(255,255,255,0.62)",
        }}
      >
        Planificación para monitores de tenis · tenplanner.com
      </div>
    </div>,
    size
  );
}
