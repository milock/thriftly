// Browser-side geocoding.
//
// Geocoding MUST run in the user's browser, not on the server. The free OSM
// geocoders (Photon, Nominatim) rate-limit/block requests by IP, and on Vercel
// every user's request leaves from the same handful of datacenter IPs — so a
// server-side geocode gets throttled to nothing and only cache-warmed areas
// (the San Diego default) appear to work. Running from each visitor's own IP
// spreads the load and Just Works, with no ZIP database to maintain.
//
// Photon (komoot's OSM geocoder) is the primary backend: one endpoint resolves
// ZIP codes, full street addresses, and city names, it's CORS-enabled, and it's
// built for typeahead. Nominatim is a submit-only fallback.

import type { LatLng } from "@/lib/types";
import { toStateAbbr } from "@/lib/us-states";

const PHOTON = "https://photon.komoot.io/api";
const PHOTON_REVERSE = "https://photon.komoot.io/reverse";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export interface PlaceSuggestion {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

interface PhotonProps {
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  locality?: string;
  county?: string;
  state?: string;
  countrycode?: string;
}

/** Human label for a Photon feature, tuned per result kind (ZIP / address / place). */
function labelFor(p: PhotonProps): string | null {
  const region = toStateAbbr(p.state);
  const cityish = p.city || p.district || p.locality || p.county;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  if (street) return [street, cityish, region].filter(Boolean).join(", ");
  // Postcode results carry no `name`; lead with the ZIP so it echoes what was typed.
  if (p.postcode && !p.name) {
    const place = [cityish, region].filter(Boolean).join(", ");
    return place ? `${p.postcode} · ${place}` : p.postcode;
  }
  const primary = p.name || cityish || p.postcode;
  if (!primary) return null;
  const rest = [cityish && cityish !== primary ? cityish : null, region].filter(Boolean).join(", ");
  return rest ? `${primary}, ${rest}` : primary;
}

// Bias results toward the current map center so "main st" or an ambiguous ZIP
// resolves near the user (and a US match beats a same-numbered foreign postcode).
function biasQs(bias?: LatLng): string {
  return bias ? `&lat=${bias.lat}&lon=${bias.lon}&location_bias_scale=0.3` : "";
}

function usFeatures(feats: unknown): { props: PhotonProps; coords: [number, number] }[] {
  if (!Array.isArray(feats)) return [];
  const out: { props: PhotonProps; coords: [number, number] }[] = [];
  for (const f of feats) {
    const props: PhotonProps = f?.properties ?? {};
    if (props.countrycode && props.countrycode !== "US") continue;
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    out.push({ props, coords: [c[0], c[1]] });
  }
  return out;
}

/** Live typeahead suggestions (ZIP / address / city), US-only, optionally biased. */
export async function suggestPlaces(
  query: string,
  bias?: LatLng,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(`${PHOTON}/?q=${encodeURIComponent(q)}&limit=6&lang=en${biasQs(bias)}`, { signal });
    if (!res.ok) return [];
    const out: PlaceSuggestion[] = [];
    const seen = new Set<string>();
    for (const { props, coords } of usFeatures((await res.json())?.features)) {
      const label = labelFor(props);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ id: `${coords[1]},${coords[0]}:${label}`, label, lat: coords[1], lon: coords[0] });
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function geocodeViaPhoton(query: string, bias?: LatLng): Promise<LatLng | null> {
  const res = await fetch(
    `${PHOTON}/?q=${encodeURIComponent(query)}&limit=6&lang=en${biasQs(bias)}`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) return null;
  const [first] = usFeatures((await res.json())?.features);
  return first ? { lat: first.coords[1], lon: first.coords[0] } : null;
}

async function geocodeViaNominatim(query: string): Promise<LatLng | null> {
  // No custom User-Agent: browsers forbid setting it, and Nominatim accepts the
  // automatic Referer instead. Submit-only fallback (not used for typeahead).
  const res = await fetch(
    `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&countrycodes=us&limit=1`,
    { signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr[0]) return null;
  const lat = parseFloat(arr[0].lat);
  const lon = parseFloat(arr[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** Resolve a typed ZIP/address/city to coordinates (Photon, then Nominatim). */
export async function geocodeAddress(query: string, bias?: LatLng): Promise<LatLng | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const photon = await geocodeViaPhoton(q, bias);
    if (photon) return photon;
  } catch {
    /* fall through to Nominatim */
  }
  try {
    return await geocodeViaNominatim(q);
  } catch {
    return null;
  }
}

/** Friendly "City, ST" label for the current search center (Photon reverse). */
export async function reverseLabel(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`${PHOTON_REVERSE}?lat=${lat}&lon=${lon}&lang=en`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const p: PhotonProps = (await res.json())?.features?.[0]?.properties ?? {};
    if (p.countrycode && p.countrycode !== "US") return null;
    const place = p.city || p.district || p.locality || p.county || p.name;
    const region = toStateAbbr(p.state);
    if (place && region) return `${place}, ${region}`;
    return place || null;
  } catch {
    return null;
  }
}
