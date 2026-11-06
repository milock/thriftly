import {describe, expect, it, vi, afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {publishedShopperReviews, type PublishedShopperReview} from '@/lib/shopper-reviews';
import {fetchApproved, toPublishedReviews} from '../scripts/export-reviewed-shopper-reviews';

const publicReview = (patch: Partial<PublishedShopperReview> = {}): PublishedShopperReview => ({reportId: 'one', storeId: 'store/one', rating: 4, visitedOn: '2026-11-01', reviewedAt: '2026-11-02T00:00:00Z', status: 'approved', source: 'thriftly', ...patch});
const queueId = '54ad09b2-4079-41d7-94a3-fad1fb7eb515';
const queueReview = (patch: Record<string, unknown> = {}) => ({id: queueId, storeId: 'store/one', reason: 'shopper-review', status: 'approved', confirmedVisit: true, rating: 4, visitedOn: '2026-11-01', review: {at: '2026-11-02T00:00:00Z', actor: 'private', note: 'private'}, details: 'private', ip: 'private', ...patch});

describe('published shopper ratings', () => {
  it('aggregates only approved first-party valid unique records for the requested store', () => {
    const rows = [publicReview(), publicReview({reportId: 'two', rating: 2}), publicReview({rating: 5}), publicReview({reportId: 'three', status: 'pending' as 'approved'}), publicReview({reportId: 'four', source: 'external' as 'thriftly'}), publicReview({reportId: 'five', rating: 0}), publicReview({reportId: 'six', visitedOn: 'bad'}), publicReview({reportId: 'seven', reviewedAt: 'bad'}), publicReview({reportId: 'eight', storeId: 'other'}), publicReview({reportId: 'impossible', visitedOn: '2026-02-30'}), publicReview({reportId: 'future', visitedOn: '2099-01-01'}), publicReview({reportId: 'before', reviewedAt: '2026-10-31T00:00:00Z'})];
    expect(publishedShopperReviews('store/one', rows, new Date('2026-11-05T00:00:00Z'))).toEqual({source: 'thriftly', shopperRating: 3, shopperReviewCount: 2});
    expect(publishedShopperReviews('missing', rows)).toBeNull();
  });
  it('exports only vetted visits and strips all private fields', () => {
    const rows = [queueReview(), queueReview(), queueReview({id: 'pending', status: 'pending'}), queueReview({id: 'external', source: 'external'}), queueReview({id: 'bad', rating: 6}), queueReview({id: 'date', visitedOn: '2026-02-30'}), queueReview({id: 'unconfirmed', confirmedVisit: false}), queueReview({id: 'other', reason: 'other'}), queueReview({id: 'undated', review: {}}), queueReview({id: 'future', visitedOn: '2099-01-01'}), queueReview({id: 'before', review: {at: '2026-10-31T00:00:00Z'}})];
    const exported = toPublishedReviews(rows);
    const opaqueId = createHash('sha256').update(`thriftly-public-review-v1:${queueId}`).digest('hex');
    expect(exported).toEqual([publicReview({reportId: opaqueId})]);
    expect(JSON.stringify(exported)).not.toContain('private');
    expect(JSON.stringify(exported)).not.toContain(queueId);
    expect(toPublishedReviews([queueReview()])[0].reportId).toBe(opaqueId);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('paginates approved records and rejects repeated cursors', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({reports: [queueReview()], nextCursor: 'same'})));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchApproved('https://example.com', 'token')).rejects.toThrow('repeated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('status=approved');
  });
  it('rejects insecure remote endpoints before fetching', async () => {
    await expect(fetchApproved('http://example.com', 'token')).rejects.toThrow('HTTPS');
  });
});
