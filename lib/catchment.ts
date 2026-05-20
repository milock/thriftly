import type {
  CatchmentDemographics, LatLng, TractCentroid, TractDemographics,
} from "@/lib/types";
import { haversineMiles } from "@/lib/distance";

export interface TractInRadius {
  centroid: TractCentroid;
  distanceMiles: number;
}

export function tractsWithinRadius(
  store: LatLng, centroids: TractCentroid[], radiusMiles: number,
): TractInRadius[] {
  const out: TractInRadius[] = [];
  for (const centroid of centroids) {
    const distanceMiles = haversineMiles(store, { lat: centroid.lat, lon: centroid.lon });
    if (distanceMiles <= radiusMiles) out.push({ centroid, distanceMiles });
  }
  return out;
}

interface WeightedTract {
  demo: TractDemographics;
  distanceMiles: number;
}

const METRICS = [
  "medianHomeValue", "medianHouseholdIncome", "medianGrossRent", "pctBachelorsPlus",
] as const;

export function aggregateCatchment(tracts: WeightedTract[]): CatchmentDemographics {
  const result: CatchmentDemographics = {
    medianHomeValue: null, medianHouseholdIncome: null, medianGrossRent: null,
    pctBachelorsPlus: null, tractCount: tracts.length, population: 0,
  };
  if (tracts.length === 0) return result;

  for (const t of tracts) result.population += t.demo.population ?? 0;

  for (const metric of METRICS) {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const { demo, distanceMiles } of tracts) {
      const value = demo[metric];
      if (value == null) continue;
      const pop = demo.population ?? 1;
      const weight = pop * (1 / (distanceMiles + 0.5));
      weightedSum += value * weight;
      weightTotal += weight;
    }
    result[metric] = weightTotal > 0 ? weightedSum / weightTotal : null;
  }

  return result;
}
