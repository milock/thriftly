import type { FactorKey } from "@/lib/types";

export interface RefRange {
  min: number;
  max: number;
  log?: boolean;
}

/** National normalization ranges. Tunable single source of truth. */
export const REFERENCE_RANGES: Record<FactorKey, RefRange> = {
  medianHomeValue: { min: 100_000, max: 1_500_000, log: true },
  medianHouseholdIncome: { min: 25_000, max: 200_000 },
  pctBachelorsPlus: { min: 0, max: 70 },
  medianGrossRent: { min: 700, max: 3_000 },
};

/** Composite weights (sum to 1.0). */
export const WEIGHTS: Record<FactorKey, number> = {
  medianHomeValue: 0.4,
  medianHouseholdIncome: 0.35,
  pctBachelorsPlus: 0.15,
  medianGrossRent: 0.1,
};

/** Catchment radius (miles) around a store whose tracts feed its score. */
export const CATCHMENT_RADIUS_MILES = 3;
