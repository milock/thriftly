import type { LatLng } from "@/lib/types";
import { toStateAbbr } from "@/lib/us-states";

const GEOCODER = "https://geocoding.geo.census.gov/geocoder";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function geocodeAddress(query: string): Promise<LatLng | null> {
  const url = `${GEOCODER}/locations/onelineaddress?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const m = data?.result?.addressMatches?.[0];
      if (m) return { lat: m.coordinates.y, lon: m.coordinates.x };
    }
  } catch {
    // fall through to Nominatim
  }
  const nUrl = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&countrycodes=us&limit=1`;
  const nRes = await fetch(nUrl, {
    headers: { "User-Agent": "thriftly/1.0 (+https://thriftly.xyz)" },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(6000),
  });
  if (!nRes.ok) return null;
  let arr: unknown;
  try {
    arr = await nRes.json();
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) };
}

export async function getStateForPoint(p: LatLng): Promise<string | null> {
  const url =
    `${GEOCODER}/geographies/coordinates?x=${p.lon}&y=${p.lat}` +
    `&benchmark=Public_AR_Current&vintage=Census2020_Current&format=json`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.geographies?.["Census Tracts"]?.[0]?.STATE ?? null;
  } catch {
    return null; // timeout/network: skip scoring rather than hang the render
  }
}

export interface ReverseAddress {
  street?: string; // "1145 Artesia Blvd"
  neighborhood?: string; // "North Park"
  locality?: string; // city, "San Diego"
  region?: string; // "CA"
}

const PHOTON_REVERSE = "https://photon.komoot.io/reverse";

/**
 * Best-effort structured street address for a coordinate (Photon reverse).
 * Used to backfill store addresses that OpenStreetMap never tagged. Cached a
 * week since a store's address doesn't move. Returns null on miss/error so the
 * caller keeps whatever it already had.
 */
async function reverseViaPhoton(lat: number, lon: number): Promise<ReverseAddress | null> {
  const url = `${PHOTON_REVERSE}?lat=${lat}&lon=${lon}&lang=en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "thriftly/1.0 (+https://thriftly.xyz)" },
    next: { revalidate: 604800 },
    signal: AbortSignal.timeout(4500),
  });
  if (!res.ok) return null;
  const p = (await res.json())?.features?.[0]?.properties ?? {};
  if (p.countrycode && p.countrycode !== "US") return null;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ") || undefined;
  const neighborhood = p.district || p.suburb || p.neighbourhood || p.locality || undefined;
  const locality = p.city || p.town || p.village || undefined;
  const region = toStateAbbr(p.state);
  if (!street && !neighborhood && !locality) return null;
  return { street, neighborhood, locality, region };
}

/** Cached Photon lookup. Do not fan out bulk requests to public Nominatim. */
export async function reverseAddress(lat: number, lon: number): Promise<ReverseAddress | null> {
  try { return await reverseViaPhoton(lat, lon); } catch { return null; }
}
