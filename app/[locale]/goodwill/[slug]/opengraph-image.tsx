import { ImageResponse } from "next/og";
import { getCity } from "@/lib/cities";
import {getTranslations} from "next-intl/server";

export async function generateImageMetadata({params}: {params: Promise<{locale: string; slug: string}>}) {
  const {locale, slug} = await params;
  const t = await getTranslations({locale:locale ?? 'en', namespace: 'pages'});
  const c = getCity(slug);
  return [{id: '0', alt: t('stateTitle', {place: c ? `${c.city}, ${c.state}` : t('yourCity')}), size, contentType}];
}
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug } = await params;
  const c = getCity(slug);
  const place = c ? `${c.city}, ${c.state}` : "Goodwill";

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
          <div style={{ fontSize: 36, color: "#34d399", fontWeight: 600 }}>Thriftly + Goodwill</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 950 }}>
            {place}
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#a1a1aa" }}>
          thriftly.xyz
        </div>
      </div>
    ),
    size,
  );
}
