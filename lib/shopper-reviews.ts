import published from '@/data/shopper-reviews.json';
import type {OwnedShopperReviews} from '@/lib/visit-score';

export interface PublishedShopperReview {
  reportId: string;
  storeId: string;
  rating: number;
  visitedOn: string;
  reviewedAt: string;
  status: 'approved';
  source: 'thriftly';
}

/** Public evidence is an explicitly reviewed release artifact, never the live inbox. */
export function publishedShopperReviews(storeId: string, records: PublishedShopperReview[] = published.reviews, now = new Date()): OwnedShopperReviews | null {
  const seen = new Set<string>();
  const valid = records.filter(r => {
    if (r.storeId !== storeId || r.status !== 'approved' || r.source !== 'thriftly' || !r.reportId || seen.has(r.reportId) || !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5 || !/^\d{4}-\d{2}-\d{2}$/.test(r.visitedOn) || !Number.isFinite(Date.parse(r.visitedOn)) || new Date(r.visitedOn).toISOString().slice(0, 10) !== r.visitedOn || r.visitedOn > now.toISOString().slice(0, 10) || !Number.isFinite(Date.parse(r.reviewedAt)) || Date.parse(r.reviewedAt) < Date.parse(r.visitedOn)) return false;
    seen.add(r.reportId);
    return true;
  });
  return valid.length ? {source: 'thriftly', shopperRating: valid.reduce((sum, r) => sum + r.rating, 0) / valid.length, shopperReviewCount: valid.length} : null;
}
