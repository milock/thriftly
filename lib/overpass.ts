import type { LatLng, Store } from "@/lib/types";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const FALLBACK = "https://overpass.kumi.systems/api/interpreter";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
interface OverpassResponse { elements: OverpassElement[] }

function buildQuery(center: LatLng, radiusMiles: number): string {
  const radiusM = Math.round(radiusMiles * 1609.34);
  const { lat, lon } = center;
  return `[out:json][timeout:25];
(
  nwr["shop"="charity"]["name"~"Goodwill",i](around:${radiusM},${lat},${lon});
  nwr["brand"~"Goodwill",i](around:${radiusM},${lat},${lon});
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
    const addr = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"], tags["addr:state"]]
      .filter(Boolean)
      .join(" ");
    stores.push({
      id,
      name,
      location: { lat, lon },
      address: addr || undefined,
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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    next: { revalidate: 86400 }, // cache a day
  };
  let res: Response;
  try {
    res = await fetch(ENDPOINT, opts);
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
  } catch {
    res = await fetch(FALLBACK, opts);
  }
  const data = (await res.json()) as OverpassResponse;
  return parseOverpass(data);
}
