import { ImageResponse } from "next/og";

import { BALL_PNG } from "./ballData";

// Open Graph share card (LinkedIn, Twitter, etc.). Big Trionda ball + the
// title; Next auto-wires the og:image meta tags to this route.
export const runtime = "edge";
export const alt = "FIFA World Cup 2026 Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 64,
          padding: 72,
          background:
            "radial-gradient(circle at 75% 35%, #14532d 0%, #0a0e12 60%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BALL_PNG} width={400} height={400} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 44,
              color: "#a1a1aa",
              letterSpacing: 6,
            }}
          >
            FIFA WORLD CUP
          </div>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 900, lineHeight: 1 }}>
            2026
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 66,
              fontWeight: 700,
              color: "#34d399",
              marginTop: 4,
            }}
          >
            Tracker
          </div>
        </div>
      </div>
    ),
    size
  );
}
