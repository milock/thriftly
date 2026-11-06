import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/locate', () => ({allBundledStores: () => [{id: 'known', googlePlaceId: 'ChIJconfirmed'}]}));
const payload = {id: 'ChIJconfirmed', displayName: {text: 'Test'}, formattedAddress: '100 Main St', location: {latitude: 32, longitude: -117}, businessStatus: 'OPERATIONAL'};
const headers = () => new Headers({'x-vercel-forwarded-for': '192.0.2.10'});
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'private-server-key');
  vi.stubEnv('REPORTS_RATE_LIMIT_SECRET', 's'.repeat(48));
  vi.stubEnv('VERCEL', '1');
});
afterEach(() => {vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();});

describe('shared SSR and endpoint lookup boundary', () => {
  it('allows a public navigation without Origin, but keeps the POST origin gate and shared rate bound', async () => {
    const fetcher = vi.fn(async () => Response.json(payload));
    vi.stubGlobal('fetch', fetcher);
    const {loadStoreGoogleDetails} = await import('@/lib/store-details-service');
    const {POST} = await import('@/app/api/store-details/route');
    expect((await loadStoreGoogleDetails('known', {headers: headers()})).placeId).toBe('ChIJconfirmed');
    const post = (origin: string) => new Request('https://thriftly.xyz/api/store-details', {method: 'POST', headers: {...Object.fromEntries(headers()), Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({storeId: 'known'})});
    expect((await POST(post('https://attacker.example'))).status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
    for (let i = 1; i < 240; i++) await loadStoreGoogleDetails('known', {headers: headers()});
    expect((await POST(post('https://thriftly.xyz'))).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(240);
  });
  it('rejects arbitrary IDs before billing and ignores spoofed forwarding headers outside Vercel', async () => {
    vi.stubEnv('VERCEL', '');
    const fetcher = vi.fn(async () => Response.json(payload));
    vi.stubGlobal('fetch', fetcher);
    const {loadStoreGoogleDetails} = await import('@/lib/store-details-service');
    await expect(loadStoreGoogleDetails('arbitrary', {headers: headers()})).rejects.toMatchObject({status: 400});
    expect(fetcher).not.toHaveBeenCalled();
    for (let i = 0; i < 240; i++) await loadStoreGoogleDetails('known', {headers: new Headers({'x-forwarded-for': `192.0.2.${i}`, 'x-vercel-forwarded-for': `198.51.100.${i}`})});
    await expect(loadStoreGoogleDetails('known', {headers: new Headers({'x-forwarded-for': '203.0.113.1'})})).rejects.toMatchObject({status: 429});
    expect(fetcher).toHaveBeenCalledTimes(240);
  });
});
