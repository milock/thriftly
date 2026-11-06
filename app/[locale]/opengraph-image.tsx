import { ImageResponse } from "next/og";
import {createTranslator} from "next-intl";
import {isLocale} from "@/i18n/routing";

export async function generateImageMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const language = isLocale(locale) ? locale : 'en';
  const messages = (await import(`@/messages/pages/${language}.json`)).default;
  const t = createTranslator({locale: language, messages});
  return [{id: '0', alt: t('hero'), size, contentType}];
}
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
            Thriftly
          </div>
          <div style={{ fontSize: 34, color: "#a1a1aa", maxWidth: 880, lineHeight: 1.3 }}>
            thriftly.xyz
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
            T
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 600 }}>Thrift &amp; resale</div>
            <div style={{ fontSize: 26, color: "#71717a" }}>Thriftly</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
