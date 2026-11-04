import {test,expect} from '@playwright/test';

test('city metadata, visible source date and methodology are aligned',async({page})=>{
  await page.route('**/api/enrich**',r=>r.fulfill({json:{enriched:{}}}));
  await page.goto('/goodwill/los-angeles-ca');
  await expect(page).toHaveTitle('Goodwill stores in Los Angeles, CA: map & scores | Thriftly');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://www.thriftly.xyz/goodwill/los-angeles-ca');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content',/Los Angeles/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content','https://www.thriftly.xyz/goodwill/los-angeles-ca');
  await expect(page.getByText('Store dataset:',{exact:false}).first()).toBeVisible();
  await expect(page.getByRole('link',{name:'How the score works'})).toHaveAttribute('href','/how-we-score');
});
test('new outlet guide has sourced addresses and links back to the city',async({page})=>{
  await page.goto('/goodwill/los-angeles-ca/outlets');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Goodwill outlets in Los Angeles');
  await expect(page.getByText('3150 N. San Fernando Rd., Los Angeles, CA 90065')).toBeVisible();
  await expect(page.getByRole('link',{name:'Goodwill Southern California’s outlet page'})).toHaveAttribute('href','https://www.goodwillsocal.org/outlet-store/');
  await expect(page.getByRole('link',{name:'Compare Los Angeles Goodwill stores'})).toHaveAttribute('href','/goodwill/los-angeles-ca');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content',/outlets in Los Angeles/);
});
test('methodology exposes scoring weights and limits',async({page})=>{
  await page.goto('/how-we-score');
  await expect(page.getByRole('heading',{level:1})).toHaveText('How Thriftly scores Goodwill stores');
  await expect(page.getByRole('cell',{name:'40%',exact:true})).toBeVisible();
  await expect(page.getByText(/2022 American Community Survey/)).toBeVisible();
});
test('sitemap has no deploy-time dates and unknown cities are real 404s',async({request})=>{
  const r=await request.get('/sitemap.xml');const xml=await r.text();
  expect(r.status()).toBe(200);expect(xml).not.toContain('<lastmod>');
  expect(xml).toContain('https://www.thriftly.xyz/how-we-score');
  expect((await request.get('/goodwill/unknown-city-zz')).status()).toBe(404);
});
