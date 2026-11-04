import {expect, it, vi, afterEach} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JsonLd} from '@/components/json-ld';
import {loadStateCentroids} from '@/lib/gazetteer';
import {POST} from '@/app/api/enrich/route';
import {readFileSync} from 'node:fs';

afterEach(() => vi.restoreAllMocks());
it('JSON-LD cannot escape its script element', () => {
  const html = renderToStaticMarkup(createElement(JsonLd, {data:{name:'</script><script>alert(1)</script>'}}));
  expect(html.match(/<script/g)).toHaveLength(1);
  expect(html).not.toContain('<script>alert(1)');
  expect(html).toContain('\\u003c');
});
it('rejects path traversal from geocoder state metadata', () => {
  expect(loadStateCentroids('../../package')).toEqual([]);
});
it('deduplicates known store coordinates and calls only Photon', async () => {
  const point = JSON.parse(readFileSync('data/goodwill-us.json','utf8')).stores[0].location;
  const fetch = vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({features:[{properties:{city:'Test',countrycode:'US'}}]})));
  const response = await POST(new Request('http://localhost/api/enrich',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:[point,point]})}));
  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toMatch(/^https:\/\/photon\.komoot\.io\/reverse\?/);
  expect(Object.keys((await response.json()).enriched)).toHaveLength(1);
});
