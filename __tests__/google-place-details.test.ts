import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/locate', () => ({ allBundledStores: () => [{id: 'known', googlePlaceId: 'ChIJconfirmed'}, {id: 'unconfirmed'}] }));
import { createDetailsRateLimiter, createGoogleDetailsLoader, detailsIdentity, normalizeGoogleDetails, DETAILS_FIELD_MASK } from '@/lib/google-place-details';

const payload = (patch: Record<string, unknown> = {}) => ({
  id: 'ChIJconfirmed', displayName: {text: 'Example Thrift'}, formattedAddress: '100 Main Street',
  location: {latitude: 32.7, longitude: -117.1}, businessStatus: 'OPERATIONAL',
  rating: 4.5, userRatingCount: 200, websiteUri: 'https://example.com',
  googleMapsUri: 'https://maps.google.com/?cid=123',
  currentOpeningHours: {openNow: true, weekdayDescriptions: ['Monday: 9 am–5 pm']},
  attributions: [{provider: 'Example provider', providerUri: 'https://example.com/source'}], ...patch,
});
const request = (body: unknown = {storeId: 'known'}, headers: Record<string, string> = {}, suffix = '') => new Request(`https://thriftly.xyz/api/store-details${suffix}`, {
  method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://thriftly.xyz', 'x-vercel-forwarded-for': '192.0.2.1', ...headers}, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'server-secret');
  vi.stubEnv('REPORTS_RATE_LIMIT_SECRET', 's'.repeat(48));
  vi.stubEnv('VERCEL', '1');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('live Google details normalization', () => {
  it('distinguishes a successful unrated store from a failed request or closure', () => {
    const unrated = normalizeGoogleDetails(payload({rating: undefined, userRatingCount: undefined}), 'ChIJconfirmed');
    expect(unrated.rating).toBeNull(); expect(unrated.ratingCount).toBeNull();
    expect(unrated.businessStatus).toBe('OPERATIONAL');
    expect(normalizeGoogleDetails(payload({businessStatus: 'CLOSED_PERMANENTLY'}), 'ChIJconfirmed').businessStatus).toBe('CLOSED_PERMANENTLY');
  });
  it('allows no review content, photos, secrets, or unsafe links into the DTO', () => {
    const result = normalizeGoogleDetails(payload({reviews: [{text: 'private'}], photos: ['photo'], secret: 'secret', websiteUri: 'javascript:alert(1)', googleMapsUri: 'https://evil.example/', attributions: [{provider: 'Safe text', providerUri: 'data:text/html,no'}]}), 'ChIJconfirmed');
    expect(result.website).toBeNull(); expect(result.mapsUrl).toBeNull();
    expect(result.attributions).toEqual([{provider: 'Safe text', providerUri: null}]);
    expect(JSON.stringify(result)).not.toMatch(/private|secret|photos|reviews/);
    expect(DETAILS_FIELD_MASK.split(',')).not.toContain('reviews');
    expect(DETAILS_FIELD_MASK.split(',')).not.toContain('photos');
  });
  it('rejects mismatched identities and invalid essential fields', () => {
    for (const patch of [{id: 'different'}, {location: {latitude: NaN, longitude: 10}}, {displayName: {}}, {formattedAddress: ''}]) expect(() => normalizeGoogleDetails(payload(patch), 'ChIJconfirmed')).toThrow('details_unavailable');
  });
});

describe('direct lookup lifecycle', () => {
  it('performs one direct no-store fetch for concurrent callers and discards the settled payload', async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => {resolve = done;})).mockImplementation(async () => Response.json(payload()));
    const load = createGoogleDetailsLoader(fetcher);
    const first = load('ChIJconfirmed', 'server-secret');
    const second = load('ChIJconfirmed', 'server-secret');
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(Response.json(payload()));
    expect(await first).toEqual(await second);
    await load('ChIJconfirmed', 'server-secret');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe('https://places.googleapis.com/v1/places/ChIJconfirmed');
    expect(fetcher.mock.calls[0][1]).toMatchObject({method: 'GET', cache: 'no-store', redirect: 'error', headers: {'X-Goog-Api-Key': 'server-secret', 'X-Goog-FieldMask': DETAILS_FIELD_MASK}});
  });
  it('ends a stalled upstream request within five seconds and permits a fresh retry', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockImplementation(async () => Response.json(payload()));
    const load = createGoogleDetailsLoader(fetcher);
    const failure = expect(load('ChIJconfirmed', 'key')).rejects.toMatchObject({status: 504, code: 'details_timeout'});
    await vi.advanceTimersByTimeAsync(5000);
    await failure;
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    await expect(load('ChIJconfirmed', 'key')).resolves.toMatchObject({placeId: 'ChIJconfirmed'});
  });
  it('sanitizes upstream failure details and does not cache failures', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('server-secret private Google error'));
    const load = createGoogleDetailsLoader(fetcher);
    for (let i = 0; i < 2; i++) await expect(load('ChIJconfirmed', 'key')).rejects.toMatchObject({status: 503, message: 'details_unavailable'});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('request privacy and abuse bounds', () => {
  it('limits requests per rotating hashed identity and restores allowance after expiry', () => {
    const limit = createDetailsRateLimiter();
    for (let i = 0; i < 240; i++) limit('one', 0);
    expect(() => limit('one', 0)).toThrow('rate_limited');
    expect(() => limit('two', 0)).not.toThrow();
    expect(() => limit('one', 300000)).not.toThrow();
    const key = detailsIdentity(request(), 0);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(detailsIdentity(request(), 300000)).not.toBe(key);
    vi.stubEnv('VERCEL', '');
    expect(detailsIdentity(request(), 0)).toBe(detailsIdentity(request(undefined, {'x-vercel-forwarded-for': '198.51.100.1'}), 0));
  });
  it('only accepts a known confirmed store ID from same-origin JSON', async () => {
    const fetcher = vi.fn(async () => Response.json(payload()));
    vi.stubGlobal('fetch', fetcher);
    vi.resetModules();
    const {POST} = await import('@/app/api/store-details/route');
    for (const body of [{storeId: 'unknown'}, {storeId: 'unconfirmed'}, {storeId: 'known', placeId: 'arbitrary'}, {placeId: 'ChIJconfirmed'}, {storeId: 'known', query: 'free search'}]) expect((await POST(request(body))).status).toBe(400);
    expect((await POST(request(undefined, {}, '?storeId=known'))).status).toBe(400);
    expect((await POST(request(undefined, {Origin: 'https://evil.example'}))).status).toBe(403);
    expect((await POST(request(undefined, {'Content-Type': 'text/plain'}))).status).toBe(415);
    expect((await POST(request({storeId: 'x'.repeat(9000)})))).toHaveProperty('status', 413);
    expect(fetcher).not.toHaveBeenCalled();
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    const body = await result.json();
    expect(body.storeId).toBe('known');
    expect(body.google.rating).toBe(4.5);
    expect(JSON.stringify(body)).not.toContain('server-secret');
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    expect((await POST(request())).status).toBe(503);
  });
});
