/**
 * A transparent heuristic, not an inventory prediction or calibrated model.
 * Only moderated, first-party Thriftly reviews may enter this score. Google
 * Places ratings are intentionally excluded from the input contract.
 */
export interface OwnedShopperReviews {
  source: "thriftly";
  shopperRating: number | null;
  shopperReviewCount: number | null;
}

export interface VisitScoreInput {
  /** Pass null when the underlying Census baseline is unavailable. */
  neighborhood: number | null;
  shopperReviews: OwnedShopperReviews | null;
  /** EPA National Walkability Index, 1–20, 2021 release. */
  walkability: number | null;
}

export const VISIT_SCORE_MODEL = {
  version: "visit-v1-owned-reviews",
  maxReviewWeight: 0.30,
  maxWalkabilityWeight: 0.05,
  /** Heuristic attenuation constant, not a statistical confidence threshold. */
  reviewHalfWeightCount: 50,
} as const;

export interface VisitScoreComponent {
  value: number | null;
  normalized: number | null;
  effectiveWeight: number;
  /** Null when unavailable or when no composite can be calculated. */
  contribution: number | null;
}

export type VisitScoreCoverage =
  | "no-neighborhood"
  | "neighborhood-only"
  | "neighborhood-and-access"
  | "neighborhood-and-reviews"
  | "all-signals";

export interface VisitScore {
  model: typeof VISIT_SCORE_MODEL.version;
  total: number | null;
  components: Record<"neighborhood" | "shopperReviews" | "walkability", VisitScoreComponent>;
  coverage: {
    kind: VisitScoreCoverage;
    availableSignals: number;
    shopperReviewCount: number | null;
    /** Evidence attenuation only, not confidence or probability of correctness. */
    reviewEvidenceWeight: number;
  };
}

function inRange(value: number | null, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function computeVisitScore(input: VisitScoreInput): VisitScore {
  const neighborhood = inRange(input.neighborhood, 0, 100) ? input.neighborhood : null;
  const access = inRange(input.walkability, 1, 20) ? input.walkability : null;
  const owned = input.shopperReviews;
  // Runtime validation also rejects non-owned payloads from untyped callers.
  const validReview = owned?.source === "thriftly"
    && inRange(owned.shopperRating, 1, 5)
    && typeof owned.shopperReviewCount === "number"
    && Number.isSafeInteger(owned.shopperReviewCount)
    && owned.shopperReviewCount > 0;
  const rating = validReview ? owned!.shopperRating : null;
  const count = validReview ? owned!.shopperReviewCount : null;
  const evidenceWeight = count === null ? 0 : count / (count + VISIT_SCORE_MODEL.reviewHalfWeightCount);
  const reviewWeight = neighborhood === null ? 0 : VISIT_SCORE_MODEL.maxReviewWeight * evidenceWeight;
  const accessWeight = neighborhood !== null && access !== null ? VISIT_SCORE_MODEL.maxWalkabilityWeight : 0;
  const neighborhoodWeight = neighborhood === null ? 0 : 1 - reviewWeight - accessWeight;

  function component(value: number | null, normalized: number | null, effectiveWeight: number): VisitScoreComponent {
    return {
      value, normalized, effectiveWeight,
      contribution: neighborhood !== null && normalized !== null ? normalized * effectiveWeight : null,
    };
  }

  const components = {
    neighborhood: component(neighborhood, neighborhood, neighborhoodWeight),
    shopperReviews: component(rating, rating === null ? null : 25 * (rating - 1), reviewWeight),
    walkability: component(access, access === null ? null : (access - 1) / 19 * 100, accessWeight),
  };
  // Keep precision here so the total reconciles with displayed contributions;
  // round only at presentation, consistently across the UI.
  const total = neighborhood === null ? null : Object.values(components).reduce((sum, part) => sum + (part.contribution ?? 0), 0);
  const kind: VisitScoreCoverage = neighborhood === null ? "no-neighborhood"
    : rating !== null && access !== null ? "all-signals"
    : rating !== null ? "neighborhood-and-reviews"
    : access !== null ? "neighborhood-and-access"
    : "neighborhood-only";

  return {
    model: VISIT_SCORE_MODEL.version,
    total,
    components,
    coverage: {
      kind,
      availableSignals: [neighborhood, rating, access].filter(value => value !== null).length,
      shopperReviewCount: count,
      reviewEvidenceWeight: evidenceWeight,
    },
  };
}
