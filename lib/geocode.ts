import type { LatLng } from "@/lib/types";

const GEOCODER = "https://geocoding.geo.census.gov/geocoder";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export async function geocodeAddress(query: string): Promise<LatLng | null> {
  const url = `${GEOCODER}/locations/onelineaddress?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
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
    headers: { "User-Agent": "goodwill-locator/1.0" },
    next: { revalidate: 86400 },
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
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = await res.json();
  const tract = data?.result?.geographies?.["Census Tracts"]?.[0];
  return tract?.STATE ?? null;
}
