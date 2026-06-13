import { ImageResponse } from "next/og";

// Open Graph share card (LinkedIn, Twitter, etc.). Original World Cup 2026
// styling, not FIFA's trademarked artwork: big gold "26", dark/mint brand, a
// ball. Next auto-wires the og:image meta tags to this route.
export const runtime = "edge";
export const alt = "WC26 Tracker - FIFA World Cup 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BALL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#e9e9ee"/><polygon points="50,30 69,44 62,66 38,66 31,44" fill="#0a0e12"/><g stroke="#0a0e12" stroke-width="4"><line x1="50" y1="30" x2="50" y2="9"/><line x1="69" y1="44" x2="89" y2="37"/><line x1="62" y1="66" x2="75" y2="84"/><line x1="38" y1="66" x2="25" y2="84"/><line x1="31" y1="44" x2="11" y2="37"/></g></svg>'
)}`;

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "radial-gradient(circle at 78% 30%, #14532d 0%, #0a0e12 55%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 36 }}>
          <span style={{ color: "#34d399", fontWeight: 800 }}>WC26</span>
          <span style={{ color: "#a1a1aa", marginLeft: 12 }}>Tracker</span>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 300,
              fontWeight: 900,
              lineHeight: 1,
              color: "#e3b341",
              letterSpacing: -8,
            }}
          >
            26
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginLeft: 48,
            }}
          >
            <div style={{ display: "flex", fontSize: 40, color: "#a1a1aa", letterSpacing: 4 }}>
              FIFA WORLD CUP
            </div>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 800 }}>
              2026
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BALL} width={96} height={96} alt="" style={{ marginTop: 16 }} />
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 34, color: "#d4d4d8" }}>
          Live scores · Highlights · Stats · Never miss a goal
        </div>
      </div>
    ),
    size
  );
}
