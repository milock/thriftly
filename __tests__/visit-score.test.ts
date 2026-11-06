import { describe, expect, it } from "vitest";
import { computeVisitScore, type VisitScoreInput } from "@/lib/visit-score";

const reviews = (shopperRating: number | null, shopperReviewCount: number | null) => ({ source: "thriftly" as const, shopperRating, shopperReviewCount });
const base: VisitScoreInput = { neighborhood: 60, shopperReviews: null, walkability: null };

describe("owned-review visit score", () => {
  it("does not penalize missing signals or confuse a real zero with missing", () => {
    expect(computeVisitScore(base).total).toBe(60);
    expect(computeVisitScore({ ...base, neighborhood: 0 }).total).toBe(0);
    expect(computeVisitScore(base).coverage.kind).toBe("neighborhood-only");
    expect(computeVisitScore(base).components.shopperReviews.contribution).toBeNull();
  });

  it("does not turn access or reviews alone into a full comparable composite", () => {
    const score = computeVisitScore({ neighborhood: null, shopperReviews: reviews(5, 500), walkability: 20 });
    expect(score.total).toBeNull();
    expect(score.coverage.availableSignals).toBe(2);
    expect(score.components.walkability.normalized).toBe(100);
    for (const part of Object.values(score.components)) {
      expect(part.effectiveWeight).toBe(0);
      expect(part.contribution).toBeNull();
    }
  });

  it("limits the full walkability range to a five-point difference", () => {
    for (const shopperReviews of [null, reviews(4.5, 1), reviews(4.5, 500)]) {
      const low = computeVisitScore({ ...base, shopperReviews, walkability: 1 });
      const high = computeVisitScore({ ...base, shopperReviews, walkability: 20 });
      expect(high.total! - low.total!).toBeCloseTo(5);
      expect(high.components.walkability.effectiveWeight).toBe(0.05);
    }
  });

  it("gives an isolated perfect review less influence than sustained strong feedback", () => {
    const isolated = computeVisitScore({ ...base, shopperReviews: reviews(5, 1) });
    const sustained = computeVisitScore({ ...base, shopperReviews: reviews(4.5, 500) });
    expect(isolated.total! - 60).toBeLessThan(1);
    expect(sustained.total).toBeGreaterThan(isolated.total!);
    expect(sustained.components.shopperReviews.effectiveWeight).toBeLessThan(0.30);
  });

  it("lets sustained poor reviews reduce the score, not merely add a bonus", () => {
    const poor = computeVisitScore({ ...base, shopperReviews: reviews(1, 500) });
    expect(poor.total).toBeLessThan(50);
    expect(poor.components.shopperReviews.contribution).toBe(0);
    expect(poor.coverage.kind).toBe("neighborhood-and-reviews");
  });

  it.each([
    reviews(0, 10), reviews(5.1, 10), reviews(NaN, 10), reviews(Infinity, 10),
    reviews(5, 0), reviews(5, -1), reviews(5, 1.5), reviews(5, Infinity),
    reviews(5, Number.MAX_SAFE_INTEGER + 1), reviews(5, null), reviews(null, 50),
  ])("does not manufacture a review signal from invalid data: %j", shopperReviews => {
    const score = computeVisitScore({ ...base, shopperReviews });
    expect(score.total).toBe(60);
    expect(score.coverage.shopperReviewCount).toBeNull();
  });

  it("rejects Google or other provider data even from an untyped caller", () => {
    const input = { ...base, shopperReviews: { source: "google", shopperRating: 5, shopperReviewCount: 500 } };
    const score = computeVisitScore(input as unknown as VisitScoreInput);
    expect(score.total).toBe(60);
    expect(score.coverage.kind).toBe("neighborhood-only");
  });

  it.each([NaN, Infinity, -1, 101])("rejects an invalid neighborhood baseline %s", neighborhood => {
    expect(computeVisitScore({ ...base, neighborhood, walkability: 20 }).total).toBeNull();
  });

  it.each([NaN, Infinity, 0, 20.1])("treats invalid access %s as unavailable without penalty", walkability => {
    expect(computeVisitScore({ ...base, walkability }).total).toBe(60);
  });

  it("keeps valid combinations bounded and component contributions reconcilable", () => {
    for (const neighborhood of [0, 60, 100]) for (const walkability of [null, 1, 10.5, 20]) for (const shopperReviews of [null, reviews(1, 1), reviews(5, 50), reviews(4.1, 500)]) {
      const score = computeVisitScore({ neighborhood, shopperReviews, walkability });
      const parts = Object.values(score.components);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(parts.reduce((sum, part) => sum + part.effectiveWeight, 0)).toBeCloseTo(1);
      expect(parts.reduce((sum, part) => sum + (part.contribution ?? 0), 0)).toBe(score.total);
    }
  });
});
