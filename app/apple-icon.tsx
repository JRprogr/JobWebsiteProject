import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same mark as app/icon.svg, rendered as a filled square (iOS adds its own corner rounding)
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#003399",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path d="M22 16 L14 16 L14 48 L22 48" fill="none" stroke="#FFCC00" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M42 16 L50 16 L50 48 L42 48" fill="none" stroke="#FFCC00" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="32" cy="32" r="5" fill="#FFCC00" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
