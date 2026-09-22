import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "DS[Careers] — Defence & Space jobs in Europe";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "86px",
          background: "#050505",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 12% 14%, rgba(0,51,153,0.65), transparent 55%), radial-gradient(circle at 92% 82%, rgba(0,51,153,0.5), transparent 55%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
          <div style={{ display: "flex", fontSize: 26, color: "#FFCC00", letterSpacing: 3 }}>[ DEFENCE &amp; SPACE JOBS · EUROPE FIRST ]</div>
          <div style={{ display: "flex", fontSize: 128, fontWeight: 800, color: "#FFCC00", lineHeight: 1 }}>DS[Careers]</div>
          <div style={{ display: "flex", fontSize: 34, color: "#e7e7e7", maxWidth: 920, lineHeight: 1.4 }}>
            Open roles at defence and space companies, refreshed on every scrape.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
