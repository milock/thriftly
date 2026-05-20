import type {
  CatchmentDemographics, FactorKey, FactorScore, GoodsScore,
} from "@/lib/types";
import { REFERENCE_RANGES, WEIGHTS, type RefRange } from "@/lib/reference-ranges";

export function normalize(value: number | null, range: RefRange): number {
  if (value == null || Number.isNaN(value)) return 0;
  let v = value;
  let min = range.min;
  let max = range.max;
  if (range.log) {
    v = Math.log(Math.max(value, 1));
    min = Math.log(range.min);
    max = Math.log(range.max);
  }
  const t = (v - min) / (max - min);
  return Math.max(0, Math.min(100, t * 100));
}

const FACTOR_KEYS: FactorKey[] = [
  "medianHomeValue", "medianHouseholdIncome", "pctBachelorsPlus", "medianGrossRent",
];

export function computeGoodsScore(demo: CatchmentDemographics): GoodsScore {
  const factors = {} as Record<FactorKey, FactorScore>;
  let total = 0;

  for (const key of FACTOR_KEYS) {
    const value = demo[key];
    const normalized = normalize(value, REFERENCE_RANGES[key]);
    const weight = WEIGHTS[key];
    const contribution = value == null ? 0 : normalized * weight;
    factors[key] = { value, normalized, weight, contribution };
    total += contribution;
  }

  return {
    total: Math.round(total * 10) / 10,
    factors,
    catchment: { tractCount: demo.tractCount, population: demo.population },
  };
}
