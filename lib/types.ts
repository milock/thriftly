export interface LatLng {
  lat: number;
  lon: number;
}

export interface Store {
  id: string; // e.g. "node/123456"
  name: string;
  location: LatLng;
  address?: string;
  street?: string; // "7631 Girard Avenue"
  locality?: string; // "La Jolla"
  region?: string; // "CA"
  openingHours?: string;
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
  total: number; // 0..100
  factors: Record<FactorKey, FactorScore>;
  catchment: { tractCount: number; population: number };
}

export interface ScoredStore extends Store {
  distanceMiles: number;
  score: GoodsScore;
}

export interface StoreQuery {
  lat: number;
  lon: number;
  radiusMiles: number;
}
