import { NextResponse } from "next/server";
import { reverseAddress } from "@/lib/geocode";

interface Point {
  lat: number;
  lon: number;
}

/**
 * Reverse-geocode a batch of store coordinates so the client search can fill in
 * neighborhood + street addresses progressively, after the ranked list has
 * already painted. Each lookup is cached a week server-side. Browsers can't call
 * the upstream geocoders directly (CORS + CSP), so this proxies it.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const raw = (body as { points?: unknown })?.points;
  const points: Point[] = Array.isArray(raw)
    ? raw
        .filter(
          (p): p is Point =>
            !!p &&
            typeof (p as Point).lat === "number" &&
            typeof (p as Point).lon === "number" &&
            (p as Point).lat >= -90 &&
            (p as Point).lat <= 90 &&
            (p as Point).lon >= -180 &&
            (p as Point).lon <= 180,
        )
        // Cap the batch so a crafted request can't fan out into huge upstream load.
        .slice(0, 60)
    : [];

  const enriched: Record<
    string,
    { neighborhood?: string; street?: string; locality?: string; region?: string }
  > = {};

  // Small worker pool: polite to the geocoder, bounded latency.
  let next = 0;
  const worker = async () => {
    while (next < points.length) {
      const p = points[next++];
      const rev = await reverseAddress(p.lat, p.lon);
      if (rev) enriched[`${p.lat},${p.lon}`] = rev;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, points.length) }, worker));

  return NextResponse.json({ enriched });
}
