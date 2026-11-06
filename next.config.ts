import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isDev = process.env.NODE_ENV !== "production";

const ContentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' is needed only by the dev HMR runtime; production stays strict.
  `script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com${isDev ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://maps.gstatic.com https://maps.googleapis.com https://maps.google.com https://khms0.googleapis.com https://khms1.googleapis.com https://mt0.googleapis.com https://mt1.googleapis.com https://streetviewpixels-pa.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Geocoding runs in the browser (the user's own IP) against the OSM geocoders —
  // the server's datacenter IP gets rate-limited/blocked, so client-side is the
  // only path that works everywhere. These two origins must be reachable.
  // Ratings are server-fetched; only the Google Maps renderer connects directly.
  "connect-src 'self' https://photon.komoot.io https://nominatim.openstreetmap.org https://maps.googleapis.com https://maps.gstatic.com https://maps.google.com https://khms0.googleapis.com https://khms1.googleapis.com https://mt0.googleapis.com https://mt1.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  experimental: {globalNotFound: true},
  // Bundle independent scores plus durable Google identity confirmations.
  outputFileTracingIncludes: {
    "/*": ["./data/stores-us.json", "./data/store-access.json", "./data/google-place-ids.json"],
    // Public results require the same confirmed registry on every route.
    "/api/enrich": ["./data/stores-us.json", "./data/google-place-ids.json"],
    "/api/stores": ["./data/stores-us.json", "./data/google-place-ids.json"],
    "/[locale]/goodwill/[slug]": [
      "./data/stores-us.json",
      "./data/city-centroids.json",
      "./data/google-place-ids.json",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
