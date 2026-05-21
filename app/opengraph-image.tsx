import { ImageResponse } from "next/og";

export const alt = "Thriftly: find the best Goodwill near you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          backgroundImage:
            "radial-gradient(900px circle at 80% -10%, rgba(52,211,153,0.18), transparent 60%)",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#a1a1aa" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fafafa",
              color: "#0a0a0a",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            T
          </div>
          thriftly.xyz
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 900 }}>
            Find the Goodwill with the best stuff.
          </div>
          <div style={{ fontSize: 34, color: "#a1a1aa", maxWidth: 880, lineHeight: 1.3 }}>
            Every nearby thrift store, ranked 0 to 100 by neighborhood affluence.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 92,
              height: 92,
              borderRadius: 999,
              background: "#34d399",
              color: "#0a0a0a",
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            89
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 600 }}>Goods Score</div>
            <div style={{ fontSize: 26, color: "#71717a" }}>U.S. Census + OpenStreetMap</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
