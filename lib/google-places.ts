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
  street: "st", avenue: "ave", boulevard: "blvd", road: "rd", drive: "dr",
  lane: "ln", court: "ct", circle: "cir", place: "pl", parkway: "pkwy",
  highway: "hwy", terrace: "ter", trail: "trl", way: "way",
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
  const noUnit = text.replace(/\s+(?:suite|ste\.?|unit|apt\.?|space|spc\.?)\s*#?\s+[\w-]+.*$|\s*#\s*[\w-]+.*$/i, "");
  return normalize(noUnit).split(" ").map(word => WORDS[word] ?? word).join(" ");
}

function brandMatches(store: Store, name: string): boolean {
  const brand = store.brandId ?? "goodwill";
  if (brand === "savers") {
    const label = normalize(store.brand ?? store.name);
    if (label === "value village") return /\bvalue village\b/.test(name);
    if (label === "unique") return /\bunique\b/.test(name);
    if (label === "2nd ave thrift") return /\b(?:2nd|second) (?:ave|avenue) thrift\b/.test(name);
  }
  return BRAND_NAMES[brand]?.test(name) ?? false;
}

function findComponent(place: GooglePlaceCandidate, type: string): AddressComponent | undefined {
  return Array.isArray(place.addressComponents)
    ? place.addressComponents.find(component => Array.isArray(component?.types) && component.types.includes(type))
    : undefined;
}

/** Reject uncertainty instead of choosing Google's first result or closest pin. */
export function selectGooglePlaceId(store: Store, candidates: readonly GooglePlaceCandidate[]): string | null {
  const street = store.street || store.address?.split(",")[0];
  if (!street || !store.region || !/^\d/.test(street.trim())) return null;
  const expectedStreet = normalizeStreet(street);
  const matches = new Set<string>();
  for (const place of candidates) {
    if (typeof place?.id !== "string" || !/^[\w-]{6,512}$/.test(place.id) ||
        typeof place.displayName?.text !== "string" || place.businessStatus === "CLOSED_PERMANENTLY") continue;
    const name = normalize(place.displayName.text);
    if (!brandMatches(store, name)) continue;
    const outlet = /\b(outlet|bins|clearance)\b|\bby the pound\b/.test(name);
    if ((store.facilityType === "outlet") !== outlet) continue;
    const retailNamed = /\b(store|shop|retail|thrift|resale|outlet|bins|clearance)\b/.test(name);
    if ((!retailNamed && /\b(donation|drop off|career|training|warehouse|recycling|administration|headquarters|office|rehabilitation|community center|church)\b/.test(name)) ||
        place.types?.includes("corporate_office") || place.types?.includes("place_of_worship")) continue;

    const region = findComponent(place, "administrative_area_level_1")?.shortText;
    const country = findComponent(place, "country")?.shortText;
    const number = findComponent(place, "street_number")?.longText;
    const route = findComponent(place, "route")?.longText;
    if (country !== "US" || region !== store.region.toUpperCase() || !number || !route ||
        normalizeStreet(`${number} ${route}`) !== expectedStreet) continue;

    const { latitude, longitude } = place.location ?? {};
    if (typeof latitude !== "number" || typeof longitude !== "number" ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
        haversineMiles(store.location, { lat: latitude, lon: longitude }) > MATCH_RADIUS_MILES) continue;

    matches.add(place.id);
  }
  return matches.size === 1 ? (matches.values().next().value ?? null) : null;
}

export async function findGooglePlaceId(store: Store, apiKey: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  const street = store.street || store.address?.split(",")[0];
  if (!street || !/^\d/.test(street.trim()) || !store.region) return null;
  const address = store.address || [street, store.locality, store.region].filter(Boolean).join(", ");
  const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(3500),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.addressComponents,places.location,places.businessStatus,places.types",
    },
    body: JSON.stringify({
      textQuery: `${store.name} ${address}`,
      languageCode: "en",
      regionCode: "US",
      pageSize: 5,
      locationBias: {
        circle: { center: { latitude: store.location.lat, longitude: store.location.lon }, radius: 200 },
      },
    }),
  });
  if (!response.ok) throw new Error("Google listing lookup failed");
  const { places } = await response.json() as { places?: GooglePlaceCandidate[] };
  return selectGooglePlaceId(store, Array.isArray(places) ? places : []);
}
