import { ImageResponse } from "next/og";
import { getMetro } from "@/lib/metros";

export const alt = "Best Goodwill stores, ranked by Thriftly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = getMetro(slug);
  const place = m ? `${m.city}, ${m.state}` : "your city";

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

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 36, color: "#34d399", fontWeight: 600 }}>Ranked by Goods Score</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 950 }}>
            Best Goodwill stores in {place}
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#a1a1aa" }}>
          Every nearby thrift store, ranked 0 to 100 by neighborhood affluence.
        </div>
      </div>
    ),
    size,
  );
}
