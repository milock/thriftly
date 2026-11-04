import {test, expect} from '@playwright/test';
test('production server sends security headers', async ({request}) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(res.headers()['content-security-policy']).not.toContain('unsafe-eval');
});
test('real API rejects invalid and oversized requests', async ({request}) => {
  expect((await request.get('/api/stores?lat=32evil&lon=-117')).status()).toBe(400);
  expect((await request.post('/api/enrich', {data:{points:[{lat:0,lon:0}]}})).status()).toBe(400);
  expect((await request.post('/api/enrich', {data:{padding:'x'.repeat(20000)}})).status()).toBe(413);
});
test('real search API returns scored bundled data', async ({request}) => {
  const res = await request.get('/api/stores?lat=32.7157&lon=-117.1611&radius=25');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.stores.length).toBeGreaterThan(0);
  expect(body.stores[0].score.total).toBeGreaterThan(0);
  expect(body.generatedAt).toBeTruthy();
});
