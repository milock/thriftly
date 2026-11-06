import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({ data: new Map<string, string>(), put: vi.fn(), get: vi.fn(), list: vi.fn() }));
vi.mock('@vercel/blob', () => ({ put: mocks.put, get: mocks.get, list: mocks.list }));
vi.mock('@/lib/locate', () => ({ allBundledStores: () => [{ id: 'store/known' }] }));

import {
  blobReportStorage, createReportQueue, readReportJson, reporterKey, requireAdmin,
  validateReport, validateReview, type ReportInput,
} from '@/lib/listing-reports';
import { POST } from '@/app/api/reports/route';
import { GET, PATCH } from '@/app/api/admin/reports/route';

const known = new Set(['store/known']);
const now = new Date('2026-11-05T12:30:00Z');
const valid = (): ReportInput => ({ storeId: 'store/known', reason: 'wrong-location', details: 'The entrance is on the next block.', requestId: randomUUID(), visitedOn: null, rating: null, confirmedVisit: false });
const admin = 'a'.repeat(48);
function publicRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://thriftly.xyz/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://thriftly.xyz', 'x-vercel-forwarded-for': '192.0.2.10', ...headers }, body: JSON.stringify(body) });
}
function adminRequest(method: 'GET' | 'PATCH' = 'GET', body?: unknown, query = '') {
  return new Request(`https://thriftly.xyz/api/admin/reports${query}`, { method, headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

beforeEach(() => {
  mocks.data.clear();
  mocks.put.mockReset(); mocks.get.mockReset(); mocks.list.mockReset();
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'private-test-token');
  vi.stubEnv('REPORTS_ADMIN_TOKEN', admin);
  vi.stubEnv('REPORTS_RATE_LIMIT_SECRET', 's'.repeat(48));
  vi.stubEnv('VERCEL', '1');
  mocks.put.mockImplementation(async (path: string, body: string) => {
    if (mocks.data.has(path)) throw new Error('already exists');
    mocks.data.set(path, body);
    return { pathname: path };
  });
  mocks.get.mockImplementation(async (path: string) => {
    const body = mocks.data.get(path);
    return body ? { statusCode: 200, stream: new Response(body).body, blob: { size: Buffer.byteLength(body) } } : null;
  });
  mocks.list.mockImplementation(async ({ prefix, cursor, limit }: { prefix: string; cursor?: string; limit: number }) => {
    const all = [...mocks.data.keys()].filter(path => path.startsWith(prefix)).sort();
    const start = Number(cursor ?? 0);
    return { blobs: all.slice(start, start + limit).map(pathname => ({ pathname })), hasMore: start + limit < all.length, cursor: String(start + limit) };
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('report validation', () => {
  it('accepts only published store IDs and known reasons', () => {
    expect(validateReport(valid(), known, now).storeId).toBe('store/known');
    expect(() => validateReport({ ...valid(), storeId: '../arbitrary' }, known, now)).toThrow('unknown_store');
    expect(() => validateReport({ ...valid(), reason: 'rewrite-listing' }, known, now)).toThrow('invalid_report');
  });
  it('rejects unknown fields, client status, and invalid request IDs', () => {
    for (const patch of [{ status: 'approved' }, { email: 'person@example.com' }, { requestId: '../../secret' }]) {
      expect(() => validateReport({ ...valid(), ...patch }, known, now)).toThrow('invalid_report');
    }
  });
  it('bounds text and rejects control characters', () => {
    expect(() => validateReport({ ...valid(), details: 'a'.repeat(1501) }, known, now)).toThrow();
    expect(() => validateReport({ ...valid(), details: '\u0000secret' }, known, now)).toThrow();
    expect(validateReport({ ...valid(), details: '  line one\nline two  ' }, known, now).details).toBe('line one\nline two');
  });
  it('requires observations and a real past visit date for departments', () => {
    const report = { ...valid(), reason: 'departments', visitedOn: '2026-11-01' };
    expect(validateReport(report, known, now).visitedOn).toBe('2026-11-01');
    for (const visitedOn of [null, '2026-02-30', '2026-11-06', '1900-01-01', 'tomorrow']) {
      expect(() => validateReport({ ...report, visitedOn }, known, now)).toThrow();
    }
    expect(() => validateReport({ ...report, details: ' ' }, known, now)).toThrow('details_required');
  });
  it('accepts shopper ratings only with date and first-hand confirmation', () => {
    const review = { ...valid(), reason: 'shopper-review', visitedOn: '2026-11-01', rating: 4, confirmedVisit: true };
    expect(validateReport(review, known, now).rating).toBe(4);
    for (const rating of [null, 0, 6, 4.5, '4']) expect(() => validateReport({ ...review, rating }, known, now)).toThrow('invalid_rating');
    expect(() => validateReport({ ...review, confirmedVisit: false }, known, now)).toThrow('invalid_rating');
    expect(() => validateReport({ ...review, visitedOn: null }, known, now)).toThrow('visit_date_required');
    expect(() => validateReport({ ...valid(), rating: 5 }, known, now)).toThrow('invalid_rating');
  });
  it('requires an explicit bounded moderation note', () => {
    expect(validateReview({ id: randomUUID(), status: 'approved', note: 'Confirmed with the operator.' }).status).toBe('approved');
    for (const patch of [{ note: '' }, { status: 'published' }, { note: 'x'.repeat(1001) }, { overwrite: true }]) {
      expect(() => validateReview({ id: randomUUID(), status: 'rejected', note: 'Not enough supporting evidence.', ...patch })).toThrow();
    }
  });
});

describe('private storage and concurrency', () => {
  it('always uses private conditional writes and uncached reads', async () => {
    const queue = createReportQueue();
    await queue.submit(valid(), 'hashed-identity', now);
    for (const call of mocks.put.mock.calls) expect(call[2]).toMatchObject({ access: 'private', addRandomSuffix: false, allowOverwrite: false });
    for (const call of mocks.get.mock.calls) expect(call[1]).toMatchObject({ access: 'private', useCache: false });
    expect(mocks.put.mock.calls.some(call => call[0].includes('rate/2026-11-05-12/'))).toBe(true);
  });
  it('persists at most five concurrent reports from one identity per hour', async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => createReportQueue().submit(valid(), 'same-identity', now)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(5);
    expect([...mocks.data.keys()].filter(path => path.includes('/items/'))).toHaveLength(5);
    expect(results.filter(result => result.status === 'rejected').every(result => result.status === 'rejected' && result.reason.status === 429)).toBe(true);
  });
  it('retries are idempotent even when simultaneous and do not consume extra slots', async () => {
    const input = valid();
    const ids = await Promise.all(Array.from({ length: 10 }, () => createReportQueue().submit(input, 'same-identity', now)));
    expect(new Set(ids).size).toBe(1);
    expect([...mocks.data.keys()].filter(path => path.includes('/items/'))).toHaveLength(1);
    expect([...mocks.data.keys()].filter(path => path.includes('/rate/'))).toHaveLength(1);
    await expect(createReportQueue().submit({ ...input, details: 'Changed report contents.' }, 'same-identity', now)).rejects.toMatchObject({ status: 409 });
  });
  it('fails honestly after a storage write failure and allows the same retry', async () => {
    const input = valid();
    const ordinaryPut = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementation(async (path, ...args) => { if (path.includes('/items/')) throw new Error('storage unavailable'); return ordinaryPut(path, ...args); });
    await expect(createReportQueue().submit(input, 'same-identity', now)).rejects.toMatchObject({ status: 503 });
    expect([...mocks.data.keys()].filter(path => path.includes('/items/'))).toHaveLength(0);
    mocks.put.mockImplementation(ordinaryPut);
    await expect(createReportQueue().submit(input, 'same-identity', now)).resolves.toBe(input.requestId);
    expect([...mocks.data.keys()].filter(path => path.includes('/rate/'))).toHaveLength(1);
  });
  it('allows one immutable moderation decision and leaves the original report unchanged', async () => {
    const queue = createReportQueue();
    const id = await queue.submit(valid(), 'same-identity', now);
    const original = mocks.data.get(`reports/v1/items/${id}.json`);
    const results = await Promise.allSettled([
      queue.review(id, 'approved', 'Verified with the published source.', 'admin:first', now),
      queue.review(id, 'rejected', 'Insufficient supporting evidence.', 'admin:second', now),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(mocks.data.get(`reports/v1/items/${id}.json`)).toBe(original);
    expect(JSON.parse(mocks.data.get(`reports/v1/reviews/${id}.json`) ?? '{}')).toMatchObject({ reportId: id, actor: 'admin:first', at: now.toISOString() });
    expect((await queue.list('pending')).reports).toHaveLength(0);
    expect((await queue.list('approved')).reports).toHaveLength(1);
  });
  it('does not mistake a partially failed review page for a complete page', async () => {
    await createReportQueue().submit(valid(), 'same-identity', now);
    mocks.get.mockRejectedValue(new Error('read unavailable'));
    await expect(createReportQueue().list('pending')).rejects.toMatchObject({ status: 503 });
  });
  it('keeps pagination when filtering yields an empty page', async () => {
    const queue = createReportQueue();
    const ids = await Promise.all(Array.from({ length: 30 }, (_, index) => queue.submit(valid(), `identity-${index}`, now)));
    const last = ids.sort().at(-1)!;
    await queue.review(last, 'approved', 'Verified against the source.', 'admin:test', now);
    const first = await queue.list('approved');
    expect(first.reports).toEqual([]);
    expect(first.nextCursor).toBe('25');
    const second = await queue.list('approved', first.nextCursor!);
    expect(second.reports.map(report => report.id)).toEqual([last]);
    expect(second.nextCursor).toBeNull();
  });
  it('requires configured private storage', () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    expect(() => blobReportStorage()).toThrow('reports_unavailable');
  });
});

describe('HTTP and privacy boundaries', () => {
  it('only returns success once a report is persisted, with no public payload', async () => {
    const input = valid();
    const response = await POST(publicRequest(input));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: input.requestId, status: 'pending' });
    expect(mocks.data.has(`reports/v1/items/${input.requestId}.json`)).toBe(true);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects oversized streams and unknown stores before any storage calls', async () => {
    expect((await POST(publicRequest({ ...valid(), details: 'x'.repeat(9000) }))).status).toBe(413);
    expect((await POST(publicRequest({ ...valid(), storeId: 'unknown' }))).status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
  });
  it('requires JSON, valid syntax, and same-origin browser submission', async () => {
    expect((await POST(publicRequest(valid(), { Origin: 'https://attacker.example' }))).status).toBe(403);
    expect((await POST(publicRequest(valid(), { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await POST(publicRequest(valid(), { 'Content-Type': 'text/plain' }))).status).toBe(415);
    await expect(readReportJson(new Request('https://thriftly.xyz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).rejects.toMatchObject({ status: 400 });
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('requires admin auth before reading or reviewing any private records', async () => {
    const response = await GET(new Request('https://thriftly.xyz/api/admin/reports'));
    expect(response.status).toBe(401);
    expect((await PATCH(new Request('https://thriftly.xyz/api/admin/reports', { method: 'PATCH', body: '{}' }))).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.put).not.toHaveBeenCalled();
    expect(() => requireAdmin(new Request('https://thriftly.xyz', { headers: { Authorization: `Bearer ${'x'.repeat(48)}` } }))).toThrow('unauthorized');
  });
  it('bounds admin queries and missing configuration fails closed', async () => {
    expect((await GET(adminRequest('GET', undefined, '?status=all'))).status).toBe(400);
    expect((await GET(adminRequest('GET', undefined, `?cursor=${'x'.repeat(2050)}`))).status).toBe(400);
    vi.stubEnv('REPORTS_ADMIN_TOKEN', '');
    expect((await GET(adminRequest())).status).toBe(503);
    vi.stubEnv('REPORTS_RATE_LIMIT_SECRET', '');
    expect((await POST(publicRequest(valid()))).status).toBe(503);
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('approval persists an audit record and reports publicDataChanged false', async () => {
    const input = valid();
    await POST(publicRequest(input));
    const response = await PATCH(adminRequest('PATCH', { id: input.requestId, status: 'approved', note: 'Confirmed with the store operator.' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ publicDataChanged: false, report: { status: 'approved' } });
    expect((await GET(adminRequest('GET', undefined, '?status=approved'))).headers.get('cache-control')).toContain('no-store');
  });
  it('hashes the Vercel address by hour and ignores untrusted headers off Vercel', () => {
    const request = publicRequest(valid());
    const key = reporterKey(request, now);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain('192.0.2.10');
    expect(reporterKey(request, new Date(now.getTime() + 3600_000))).not.toBe(key);
    vi.stubEnv('VERCEL', '');
    expect(reporterKey(request, now)).toBe(reporterKey(publicRequest(valid(), { 'x-vercel-forwarded-for': '198.51.100.1' }), now));
  });
  it('does not log report contents or storage errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.put.mockRejectedValue(new Error('sensitive storage error'));
    expect((await POST(publicRequest(valid()))).status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });
  it('has no public read handler', async () => {
    const route = await import('@/app/api/reports/route');
    expect('GET' in route).toBe(false);
  });
  it('includes matching report message keys for every supported locale', () => {
    const en = JSON.parse(readFileSync('messages/reports/en.json', 'utf8'));
    for (const locale of ['es', 'zh-Hans', 'zh-Hant', 'vi', 'tl', 'ar']) {
      const translated = JSON.parse(readFileSync(`messages/reports/${locale}.json`, 'utf8'));
      expect(Object.keys(translated).sort()).toEqual(Object.keys(en).sort());
      expect(Object.keys(translated.reasons).sort()).toEqual(Object.keys(en.reasons).sort());
    }
  });
});
