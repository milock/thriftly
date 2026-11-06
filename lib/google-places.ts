import { haversineMiles } from "@/lib/distance";
import type { Store } from "@/lib/types";

interface AddressComponent {
  types?: string[];
  longText?: string;
  shortText?: string;
}

export interface GooglePlaceCandidate {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  addressComponents?: AddressComponent[];
  businessStatus?: string;
  types?: string[];
}

const MATCH_RADIUS_MILES = 0.12; // About 190 m, after verifying the street address.
const WORDS: Record<string, string> = {
  bl: "blvd", street: "st", avenue: "ave", boulevard: "blvd", road: "rd", drive: "dr",
  lane: "ln", court: "ct", circle: "cir", place: "pl", parkway: "pkwy",
  highway: "hwy", terrace: "ter", trail: "trl", way: "way", expressway: "expy", center: "ctr",
  square: "sq", junction: "jct", turnpike: "tpke", crossing: "xing",
  first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th",
  sixth: "6th", seventh: "7th", eighth: "8th", ninth: "9th", tenth: "10th",
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};

const BRAND_NAMES: Record<string, RegExp> = {
  goodwill: /\bgood\s?will\b/,
  "salvation-army": /\bsalvation army\b/,
  savers: /\bsavers\b/,
  "buffalo-exchange": /\bbuffalo exchange\b/,
  "out-of-the-closet": /\bout of the closet\b/,
};

function normalize(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeStreet(text: string): string {
  const separatedUnits = text.replace(/[\/,]\s*(?=(?:suite|ste\.?|unit|apt\.?|space|spc\.?)\b)/ig, ' ');
  const noUnit = separatedUnits.replace(/\s+(?:suite|ste\.?|unit|apt\.?|space|spc\.?)\s+#?\s*[\w-]+.*$|\s*#\s*[\w-]+.*$/i, "");
  return normalize(noUnit).split(" ").map(word => WORDS[word] ?? word).join(" ");
}

function brandMatches(store: Store, name: string): boolean {
  if (store.operatorType === "independent") {
    // Only the curated shop identity; all street/state/distance checks still apply.
    return [store.name, store.brand].filter((value): value is string => !!value).map(normalize).some(label => {
      if (label.split(' ').length < 2) return false;
      if (name === label || name.startsWith(`${label} `)) return true;
      const prefixed = store.operator ? `${normalize(store.operator)} ${label}` : null;
      return !!prefixed && (name === prefixed || name.startsWith(`${prefixed} `));
    });
  }
  const brand = store.brandId ?? "goodwill";
  // Independently verified operator alias, deliberately scoped to one listing.
  // https://goodwillcolorado.org/shop/locations/ lists the boutique at this address.
  if (store.id === 'way/664763708' && brand === 'goodwill' && name === 'deja blue boutique') return true;
  if (brand === "savers") {
    const label = normalize(store.brand ?? store.name);
    if (label === "value village") return /\bvalue village\b/.test(name);
    if (label === "unique") return /\bunique\b/.test(name);
    if (label === "2nd ave thrift") return /^(?:2nd|second) (?:ave|avenue)(?: thrift(?: store| superstore)?)?$/.test(name);
  }
  return BRAND_NAMES[brand]?.test(name) ?? false;
}

function findComponent(place: GooglePlaceCandidate, type: string): AddressComponent | undefined {
  return Array.isArray(place.addressComponents)
    ? place.addressComponents.find(component => Array.isArray(component?.types) && component.types.includes(type))
    : undefined;
}

export type MatchHoldReason = 'insufficient-source-address' | 'invalid-source-location' | 'no-candidates' | 'identity-mismatch' | 'facility-mismatch' | 'address-mismatch' | 'distance-mismatch' | 'unknown-status' | 'closed' | 'ambiguous';
export type GoogleMatchDecision = {placeId: string; reason: 'confirmed'} | {placeId: null; reason: MatchHoldReason};

/** Reject uncertainty instead of choosing Google's first result or closest pin. */
export function assessGooglePlaceMatch(store: Store, candidates: readonly GooglePlaceCandidate[]): GoogleMatchDecision {
  const street = store.street || store.address?.split(",")[0];
  if (!street || !store.region || !/^\d/.test(street.trim())) return {placeId: null, reason: 'insufficient-source-address'};
  if (!Number.isFinite(store.location?.lat) || !Number.isFinite(store.location?.lon) || Math.abs(store.location.lat) > 90 || Math.abs(store.location.lon) > 180) return {placeId: null, reason: 'invalid-source-location'};
  if (!candidates.length) return {placeId: null, reason: 'no-candidates'};
  const expectedStreet = normalizeStreet(street);
  const matches = new Set<string>();
  let furthest = 0;
  const reasons: MatchHoldReason[] = ['identity-mismatch', 'facility-mismatch', 'address-mismatch', 'distance-mismatch', 'unknown-status', 'closed'];
  for (const place of candidates) {
    if (typeof place?.id !== "string" || !/^[\w-]{6,512}$/.test(place.id) || typeof place.displayName?.text !== "string") continue;
    const name = normalize(place.displayName.text);
    if (!brandMatches(store, name)) continue;
    furthest = Math.max(furthest, 1);
    const outlet = /\b(outlet|bins|clearance)\b|\bby the pound\b/.test(name);
    if ((store.facilityType === "outlet") !== outlet) continue;
    const retailNamed = /\b(store|shop|retail|thrift|resale|outlet|bins|clearance)\b/.test(name);
    if ((!retailNamed && /\b(donation|drop off|career|training|warehouse|recycling|administration|headquarters|office|rehabilitation|community center|church)\b/.test(name)) ||
        place.types?.includes("corporate_office") || place.types?.includes("place_of_worship")) continue;
    furthest = Math.max(furthest, 2);
    const region = findComponent(place, "administrative_area_level_1")?.shortText;
    const country = findComponent(place, "country")?.shortText;
    const number = findComponent(place, "street_number")?.longText;
    const route = findComponent(place, "route")?.longText;
    if (country !== "US" || region !== store.region.toUpperCase() || !number || !route ||
        normalizeStreet(`${number} ${route}`) !== expectedStreet) continue;
    furthest = Math.max(furthest, 3);
    const { latitude, longitude } = place.location ?? {};
    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || haversineMiles(store.location, { lat: latitude, lon: longitude }) > MATCH_RADIUS_MILES) continue;
    furthest = Math.max(furthest, 4);
    if (place.businessStatus === 'CLOSED_PERMANENTLY') { furthest = Math.max(furthest, 5); continue; }
    // An absent business status is insufficient evidence of a currently operating storefront.
    if (!['OPERATIONAL', 'CLOSED_TEMPORARILY'].includes(place.businessStatus ?? '')) continue;
    matches.add(place.id);
  }
  return matches.size === 1 ? {placeId: matches.values().next().value!, reason: 'confirmed'}
    : {placeId: null, reason: matches.size > 1 ? 'ambiguous' : reasons[furthest]};
}

export function selectGooglePlaceId(store: Store, candidates: readonly GooglePlaceCandidate[]): string | null {
  return assessGooglePlaceMatch(store, candidates).placeId;
}

/** Search is an offline curation operation; public rendering uses saved IDs only. */
export async function findGooglePlaceMatch(store: Store, apiKey: string, fetcher: typeof fetch = fetch): Promise<GoogleMatchDecision> {
  const street = store.street || store.address?.split(",")[0];
  if (!street || !/^\d/.test(street.trim()) || !store.region) return {placeId: null, reason: 'insufficient-source-address'};
  const address = store.address || [street, store.locality, store.region].filter(Boolean).join(", ");
  const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json", "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.addressComponents,places.location,places.businessStatus,places.types",
    },
    body: JSON.stringify({
      textQuery: `${store.name} ${address}`, languageCode: "en", regionCode: "US", pageSize: 5,
      locationBias: { circle: { center: { latitude: store.location.lat, longitude: store.location.lon }, radius: 200 } },
    }),
  });
  if (!response.ok) throw new Error(`lookup_http_${response.status}`);
  const { places } = await response.json() as { places?: GooglePlaceCandidate[] };
  return assessGooglePlaceMatch(store, Array.isArray(places) ? places : []);
}

export async function findGooglePlaceId(store: Store, apiKey: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  return (await findGooglePlaceMatch(store, apiKey, fetcher)).placeId;
}
