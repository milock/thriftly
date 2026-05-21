import type { LatLng } from "@/lib/types";

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

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

/** Friendly "City, ST" label for a coordinate (Nominatim reverse geocoding). */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&zoom=12&addressdetails=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "thriftly/1.0 (+https://thriftly.xyz)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address ?? {};
    const place =
      a.city || a.town || a.village || a.suburb || a.neighbourhood || a.hamlet || a.county;
    const iso = a["ISO3166-2-lvl4"];
    const stateAbbr = typeof iso === "string" ? iso.split("-")[1] : undefined;
    if (place && stateAbbr) return `${place}, ${stateAbbr}`;
    if (place) return place;
    return typeof data?.display_name === "string"
      ? data.display_name.split(",").slice(0, 2).join(", ").trim()
      : null;
  } catch {
    return null;
  }
}

// Photon returns the full state name ("California"); cards want the postal code.
const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

function toStateAbbr(state: unknown): string | undefined {
  if (typeof state !== "string") return undefined;
  if (/^[A-Z]{2}$/.test(state)) return state;
  return US_STATE_ABBR[state.trim().toLowerCase()];
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
async function reverseViaNominatim(lat: number, lon: number): Promise<ReverseAddress | null> {
  const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "thriftly/1.0 (+https://thriftly.xyz)" },
    next: { revalidate: 604800 },
    signal: AbortSignal.timeout(4500),
  });
  if (!res.ok) return null;
  const a = (await res.json())?.address ?? {};
  if (a.country_code && a.country_code !== "us") return null;
  const street = [a.house_number, a.road].filter(Boolean).join(" ") || undefined;
  const neighborhood = a.neighbourhood || a.suburb || a.quarter || a.city_district || undefined;
  const locality = a.city || a.town || a.village || undefined;
  const iso = a["ISO3166-2-lvl4"];
  const region = typeof iso === "string" ? iso.split("-")[1] : toStateAbbr(a.state);
  if (!street && !neighborhood && !locality) return null;
  return { street, neighborhood, locality, region };
}

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

/**
 * Best-effort structured address for a coordinate, used to backfill store cards.
 * Nominatim is primary (richest neighborhood data, e.g. "Westwood"); Photon is
 * the fallback. Each is time-boxed and cached a week per coordinate, and the
 * whole thing soft-fails so a slow/unavailable geocoder just leaves OSM data.
 */
export async function reverseAddress(lat: number, lon: number): Promise<ReverseAddress | null> {
  // Race both geocoders; the first usable result wins. Photon is usually faster
  // and isn't rate-limited like Nominatim, so this avoids waiting on a throttled
  // Nominatim before falling back.
  try {
    return await Promise.any(
      [reverseViaPhoton(lat, lon), reverseViaNominatim(lat, lon)].map(async (task) => {
        const r = await task;
        if (!r) throw new Error("empty");
        return r;
      }),
    );
  } catch {
    return null;
  }
}

export interface PlaceSuggestion {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

const PHOTON = "https://photon.komoot.io/api";

/** Live address/ZIP autocomplete suggestions (Photon — built for typeahead). */
export async function suggestPlaces(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${PHOTON}/?q=${encodeURIComponent(q)}&limit=6&lang=en`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "thriftly/1.0 (+https://thriftly.xyz)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const feats = Array.isArray(data?.features) ? data.features : [];
    const out: PlaceSuggestion[] = [];
    const seen = new Set<string>();
    for (const f of feats) {
      const p = f?.properties ?? {};
      if (p.countrycode && p.countrycode !== "US") continue;
      const coords = f?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const primary =
        p.name ||
        [p.housenumber, p.street].filter(Boolean).join(" ") ||
        p.postcode ||
        p.city ||
        p.county;
      if (!primary) continue;
      const rest = [p.city && p.city !== primary ? p.city : null, p.state]
        .filter(Boolean)
        .join(", ");
      const label = [primary, rest].filter(Boolean).join(", ");
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ id: `${coords[1]},${coords[0]}:${label}`, label, lat: coords[1], lon: coords[0] });
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}
