/**
 * A transparent heuristic, not an inventory prediction or calibrated model.
 * Live Google aggregate ratings are an attenuated signal,
 * never a prediction of inventory or a first-party shopper rating.
 */
export interface GoogleRatings {
  source: "google";
  rating: number | null;
  ratingCount: number | null;
}

export interface VisitScoreInput {
  /** Pass null when the underlying Census baseline is unavailable. */
  neighborhood: number | null;
  googleRatings: GoogleRatings | null;
  /** EPA National Walkability Index, 1–20, 2021 release. */
  walkability: number | null;
}

export const VISIT_SCORE_MODEL = {
  version: "visit-v2-google-live",
  maxReviewWeight: 0.50,
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
  | "neighborhood-and-ratings"
  | "all-signals";

export interface VisitScore {
  model: typeof VISIT_SCORE_MODEL.version;
  total: number | null;
  components: Record<"neighborhood" | "googleRatings" | "walkability", VisitScoreComponent>;
  coverage: {
    kind: VisitScoreCoverage;
    availableSignals: number;
    googleRatingCount: number | null;
    /** Evidence attenuation only, not confidence or probability of correctness. */
    ratingEvidenceWeight: number;
  };
}

function inRange(value: number | null, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function computeVisitScore(input: VisitScoreInput): VisitScore {
  const neighborhood = inRange(input.neighborhood, 0, 100) ? input.neighborhood : null;
  const access = inRange(input.walkability, 1, 20) ? input.walkability : null;
  const google = input.googleRatings;
  // Runtime validation also rejects other-provider payloads from untyped callers.
  const validReview = google?.source === "google"
    && inRange(google.rating, 1, 5)
    && typeof google.ratingCount === "number"
    && Number.isSafeInteger(google.ratingCount)
    && google.ratingCount > 0;
  const rating = validReview ? google!.rating : null;
  const count = validReview ? google!.ratingCount : null;
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
    googleRatings: component(rating, rating === null ? null : 25 * (rating - 1), reviewWeight),
    walkability: component(access, access === null ? null : (access - 1) / 19 * 100, accessWeight),
  };
  // Keep precision here so the total reconciles with displayed contributions;
  // round only at presentation, consistently across the UI.
  const total = neighborhood === null ? null : Object.values(components).reduce((sum, part) => sum + (part.contribution ?? 0), 0);
  const kind: VisitScoreCoverage = neighborhood === null ? "no-neighborhood"
    : rating !== null && access !== null ? "all-signals"
    : rating !== null ? "neighborhood-and-ratings"
    : access !== null ? "neighborhood-and-access"
    : "neighborhood-only";

  return {
    model: VISIT_SCORE_MODEL.version,
    total,
    components,
    coverage: {
      kind,
      availableSignals: [neighborhood, rating, access].filter(value => value !== null).length,
      googleRatingCount: count,
      ratingEvidenceWeight: evidenceWeight,
    },
  };
}
