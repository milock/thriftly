import type { LatLng, Store } from "@/lib/types";

const FR = "https://overpass.openstreetmap.fr/api/interpreter";
const DE = "https://overpass-api.de/api/interpreter";

// Production uses .fr first. The precompute job sets OVERPASS_PRIMARY=de so its
// bulk traffic doesn't throttle the endpoint production depends on. Read at
// call time so the precompute can set it after this module is imported.
function endpoints(): string[] {
  return process.env.OVERPASS_PRIMARY === "de" ? [DE, FR] : [FR, DE];
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
  const opts: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "thriftly/1.0 (+https://thriftly.xyz)",
    },
    body,
    next: { revalidate: 86400 }, // cache a day
  };
  // Try each endpoint in order. A mirror intermittently returns HTTP 200 with
  // zero elements when it's under load, so we treat "no stores" the same as an
  // error and try the next endpoint rather than reporting an empty result.
  for (const endpoint of endpoints()) {
    try {
      const res = await fetch(endpoint, opts);
      if (!res.ok) continue;
      const data = (await res.json()) as OverpassResponse;
      const stores = parseOverpass(data);
      if (stores.length > 0) return stores;
    } catch {
      // try the next endpoint
    }
  }
  return [];
}
