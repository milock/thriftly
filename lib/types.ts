import type { VisitScore } from "@/lib/visit-score";

export interface LatLng {
  lat: number;
  lon: number;
}

/** Live Google content, held in memory only for the current page view. */
export interface LiveGoogleHours {
  openNow: boolean | null;
  weekdayDescriptions: string[];
}

export interface LiveGoogleDetails {
  placeId: string;
  name: string;
  address: string;
  location: LatLng;
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | null;
  currentOpeningHours: LiveGoogleHours | null;
  regularOpeningHours: LiveGoogleHours | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  ratingCount: number | null;
  mapsUrl: string | null;
  attributions: { provider: string; providerUri: string | null }[];
}

export interface Store {
  id: string; // e.g. "node/123456"
  name: string;
  /** Persisted, conservatively confirmed identity; never matched during rendering. */
  googlePlaceId?: string;
  google?: LiveGoogleDetails;
  /** Independent identity retained for source disclosure during live rendering. */
  registryIdentity?: {name: string; address?: string};
  brandId?: string;
  brand?: string;
  operator?: string;
  /** Local independent operators may have multiple shops within their region. */
  operatorType?: 'independent' | 'chain';
  /** Deliberate evidence review, separate from a source import or refresh. */
  verification?: {
    method: 'official-website-review';
    checkedAt: string;
    sourceUrls: string[];
  };
  sourcingModel?: 'donation' | 'buy-sell-trade' | 'mixed' | 'unknown';
  merchandiseScope?: 'general' | 'fashion' | 'home-improvement' | 'books' | 'unknown';
  location: LatLng;
  address?: string;
  street?: string; // "7631 Girard Avenue"
  neighborhood?: string; // "North Park" (reverse-geocoded; finer than city)
  locality?: string; // city, "San Diego"
  region?: string; // "CA"
  openingHours?: string;
  /** IANA time zone at the store, independent of the shopper's browser zone. */
  timezone?: string;
  facilityType?: 'retail' | 'outlet' | 'donation' | 'warehouse' | 'office' | 'services' | 'unknown';
  sourceTags?: Record<string, string>;
  sourceAliases?: string[];
  provenance?: {
    source: string;
    sourceId: string;
    sourceUrl?: string;
    sourceUpdatedAt?: string;
    fetchedAt?: string;
    classificationBasis?: string;
  };
  website?: string;
  phone?: string;
}

export interface TractCentroid {
  geoid: string; // 11-digit: SS CCC TTTTTT
  lat: number;
  lon: number;
}

export interface TractDemographics {
  geoid: string;
  medianHomeValue: number | null;
  medianHouseholdIncome: number | null;
  medianGrossRent: number | null;
  population: number | null;
  pctBachelorsPlus: number | null;
}

/** Catchment-blended demographics for a single store. */
export interface CatchmentDemographics {
  medianHomeValue: number | null;
  medianHouseholdIncome: number | null;
  medianGrossRent: number | null;
  pctBachelorsPlus: number | null;
  tractCount: number;
  population: number;
}

export type FactorKey =
  | "medianHomeValue"
  | "medianHouseholdIncome"
  | "pctBachelorsPlus"
  | "medianGrossRent";

export interface FactorScore {
  value: number | null; // raw blended value
  normalized: number; // 0..100
  weight: number; // 0..1
  contribution: number; // points toward total (normalized * weight)
}

export interface GoodsScore {
  visit?: VisitScore;
  baselineTotal?: number;
  total: number; // 0..100
  factors: Record<FactorKey, FactorScore>;
  catchment: { tractCount: number; population: number };
}

export interface ScoredStore extends Store {
  distanceMiles: number;
  score: GoodsScore;
  // True once reverse-geocode enrichment has run for this store (server-side or
  // via /api/enrich). Lets the card show a title placeholder until the
  // neighborhood resolves, instead of flashing a provisional value.
  enriched?: boolean;
}

export interface StoreQuery {
  lat: number;
  lon: number;
  radiusMiles: number;
}

/**
 * The single closest Goodwill to a search center, returned when nothing falls
 * within the requested radius. Lets the UI point a user in a coverage gap (rural
 * counties, remote areas) at the nearest real store instead of a dead end.
 */
export interface NearestHint {
  name: string;
  locality?: string;
  region?: string;
  distanceMiles: number;
  location: LatLng;
}
