import type { LatLng, Store } from "@/lib/types";

const FR = "https://overpass.openstreetmap.fr/api/interpreter";
const DE = "https://overpass-api.de/api/interpreter";
const KUMI = "https://overpass.kumi.systems/api/interpreter";

// Try multiple mirrors so one being slow/rate-limited doesn't blank results.
// Production uses .fr first; the precompute job sets OVERPASS_PRIMARY=de so its
// bulk traffic doesn't throttle the endpoint production depends on. Read at
// call time so the precompute can set it after this module is imported.
function endpoints(): string[] {
  return process.env.OVERPASS_PRIMARY === "de" ? [DE, KUMI, FR] : [FR, DE, KUMI];
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
}
interface OverpassResponse { elements: OverpassElement[] }

function buildQuery(center: LatLng, radiusMiles: number): string {
  const radiusM = Math.round(radiusMiles * 1609.34);
  const a = `around:${radiusM},${center.lat},${center.lon}`;
  // Prefix match catches "Goodwill Store", "Goodwill Outlet", "Goodwill Donation
  // Center", etc. - not just an exact "Goodwill" - while avoiding unrelated names
  // that merely contain the word. Case-sensitive on purpose: Goodwill names are
  // consistently capitalized, and the Overpass `,i` flag is unreliable on the
  // primary endpoint (silently returns nothing).
  return `[out:json][timeout:25];
(
  nwr["brand"~"^Goodwill"](${a});
  nwr["name"~"^Goodwill"](${a});
);
out center tags;`;
}

export function parseOverpass(data: OverpassResponse): Store[] {
  const seen = new Set<string>();
  const stores: Store[] = [];
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const name = tags.name ?? tags.brand ?? "Goodwill";
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
    const locality = tags["addr:city"];
    const region = tags["addr:state"];
    const addr = [street, locality, region].filter(Boolean).join(", ");
    stores.push({
      id,
      name,
      location: { lat, lon },
      address: addr || undefined,
      street: street || undefined,
      locality: locality || undefined,
      region: region || undefined,
      openingHours: tags.opening_hours,
      website: tags.website ?? tags["contact:website"],
      phone: tags.phone ?? tags["contact:phone"],
    });
  }
  return stores;
}

export async function fetchGoodwillStores(center: LatLng, radiusMiles: number): Promise<Store[]> {
  const body = `data=${encodeURIComponent(buildQuery(center, radiusMiles))}`;
  // Query all mirrors IN PARALLEL and take the first that returns stores. This is
  // fast (the quickest healthy mirror wins) and resilient (one mirror being slow
  // or rate-limited doesn't block the others). A single user search making a few
  // concurrent requests is well within Overpass limits — the earlier throttle
  // came from the bulk precompute, not from request-time lookups. Each response
  // is cached a day (Next data cache), so repeat searches are instant.
  const attempt = async (endpoint: string): Promise<Store[]> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Thriftly/1.0 (+https://thriftly.xyz; michael@clarityrcm.com)",
      },
      body,
      next: { revalidate: 86400 },
      // Short timeout: the bundled dataset is the source of truth and covers
      // virtually everything, so this fallback is rare. Failing fast means an
      // area genuinely without a nearby store returns its "nearest is N mi away"
      // hint quickly instead of hanging.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const stores = parseOverpass((await res.json()) as OverpassResponse);
    // Treat an empty response as a miss so another mirror can answer (mirrors
    // under load sometimes return 200 with zero elements).
    if (stores.length === 0) throw new Error("Overpass empty");
    return stores;
  };
  try {
    return await Promise.any(endpoints().map(attempt));
  } catch {
    // Every mirror failed or returned empty. Return [] (the caller falls back to
    // the bundled dataset, then to a graceful empty state).
    return [];
  }
}
