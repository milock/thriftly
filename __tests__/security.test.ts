import { afterEach, expect, it, vi } from 'vitest';
import { safeWebsiteUrl } from '@/lib/format';
import { POST } from '@/app/api/enrich/route';
import { GET } from '@/app/api/stores/route';
import { assertRefreshQuality } from '@/lib/refresh-quality';

afterEach(() => vi.restoreAllMocks());
it.each(['javascript:alert(1)', 'data:text/html,test', '//evil.example', 'https://user:pass@example.com', 'https://example.com\n.bad'])('rejects unsafe website %s', (url) => {
  expect(safeWebsiteUrl(url)).toBeNull();
});
it('normalizes safe websites', () => {
  expect(safeWebsiteUrl('goodwill.org')).toBe('https://goodwill.org/');
  expect(safeWebsiteUrl('https://goodwill.org/a')).toBe('https://goodwill.org/a');
});
it('rejects oversized bodies without upstream calls', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const r = await POST(new Request('http://localhost/api/enrich', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({padding: 'x'.repeat(20000)}) }));
  expect(r.status).toBe(413);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects arbitrary coordinates without upstream calls', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const r = await POST(new Request('http://localhost/api/enrich', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({points:[{lat:0.12345,lon:0.12345}]}) }));
  expect(r.status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it('rejects cross-origin enrichment', async () => {
  const r = await POST(new Request('http://localhost/api/enrich', {method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{"points":[]}'}));
  expect(r.status).toBe(403);
});
it('rejects partially numeric coordinates', async () => {
  expect((await GET(new Request('http://localhost/api/stores?lat=32junk&lon=-117'))).status).toBe(400);
});
it('rejects incomplete refreshes', () => {
  expect(() => assertRefreshQuality({previousCount:3000,count:2500,emptyStates:['CA'],failedCounties:[],scoredCount:2400,previousScoredCount:2900})).toThrow();
  expect(() => assertRefreshQuality({previousCount:3000,count:500,emptyStates:[],failedCounties:[],scoredCount:500,previousScoredCount:2900})).toThrow();
  expect(() => assertRefreshQuality({previousCount:3000,count:3000,emptyStates:[],failedCounties:['06073'],scoredCount:2900,previousScoredCount:2900})).toThrow();
  expect(() => assertRefreshQuality({previousCount:3000,count:3000,emptyStates:[],failedCounties:[],scoredCount:500,previousScoredCount:2900})).toThrow();
});
it('accepts a complete refresh', () => {
  expect(() => assertRefreshQuality({previousCount:3000,count:3010,emptyStates:[],failedCounties:[],scoredCount:2900,previousScoredCount:2900})).not.toThrow();
});
it('rejects too many enrichment points', async () => {
  const r = await POST(new Request('http://localhost/api/enrich', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:Array(61).fill({lat:0,lon:0})})}));
  expect(r.status).toBe(400);
});
it('requires JSON and valid syntax', async () => {
  expect((await POST(new Request('http://localhost/api/enrich', {method:'POST',body:'{}'}))).status).toBe(415);
  expect((await POST(new Request('http://localhost/api/enrich', {method:'POST',headers:{'Content-Type':'application/json'},body:'{' }))).status).toBe(400);
});
it('bounds expensive live radius', async () => {
  expect((await GET(new Request('http://localhost/api/stores?lat=32&lon=-117&radius=100&live=1'))).status).toBe(400);
});
it('serves ordinary searches from the dataset without upstream calls', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const r = await GET(new Request('http://localhost/api/stores?lat=32.7157&lon=-117.1611'));
  const data = await r.json();
  expect(r.status).toBe(200);
  expect(data.stores.length).toBeGreaterThan(0);
  expect(data.generatedAt).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
it('accepts the target Host behind a reverse proxy', async () => {
  const response = await POST(new Request('https://localhost/api/enrich', {method:'POST',headers:{'Content-Type':'application/json',Host:'www.thriftly.xyz',Origin:'https://www.thriftly.xyz'},body:'{"points":[]}'}));
  expect(response.status).toBe(200);
});
