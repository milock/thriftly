import {test,expect} from '@playwright/test';
import {mockStoreDetails,googleDetailsFor,firstStore} from './fixtures';

test.beforeEach(async ({page}) => { await mockStoreDetails(page, {unavailable: true}); });

test('city metadata, disclosed source date and methodology are aligned',async({page})=>{
  await page.route('**/api/enrich**',r=>r.fulfill({json:{enriched:{}}}));
  await page.goto('/goodwill/los-angeles-ca');
  await expect(page).toHaveTitle('Goodwill stores in Los Angeles, CA: map & scores | Thriftly');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://www.thriftly.xyz/goodwill/los-angeles-ca');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content',/Los Angeles/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content','https://www.thriftly.xyz/goodwill/los-angeles-ca');
  await page.getByRole('button', {name: 'Store dataset', exact: true}).click();
  const date = page.getByRole('dialog', {name: 'Store dataset', exact: true}).locator('time');
  await expect(date).toBeVisible();
  await expect(date).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
  await expect(page.getByRole('link',{name:'How the Visit score works'})).toHaveAttribute('href','/how-we-score');
});
test('new outlet guide has sourced addresses and links back to the city',async({page})=>{
  const outlets = [
    {id:'goodwill/49572e5e-32cf-e411-b4ab-0050568924e6',placeId:'ChIJh064HinBwoAR3XKXW8Lopp0',address:'3150 N San Fernando Rd, Los Angeles, CA 90065',location:{lat:34.1156,lon:-118.24848}},
    {id:'node/12431931814',placeId:'ChIJYz_EsNKQwoAReBTG2PgvGJg',address:'14565 Lanark St, Panorama City, CA 91402',location:{lat:34.21843,lon:-118.45147}},
  ];
  await page.route('**/api/store-details',route=>{
    const {storeId}=route.request().postDataJSON();
    const outlet=outlets.find(store=>store.id===storeId);
    return outlet ? route.fulfill({json:{storeId,google:{...googleDetailsFor(firstStore),name:'Goodwill Outlet',placeId:outlet.placeId,address:outlet.address,location:outlet.location,mapsUrl:`https://www.google.com/maps/search/?api=1&query=Goodwill&query_place_id=${outlet.placeId}`}}}) : route.fulfill({status:503,json:{error:'details_unavailable'}});
  });
  await page.goto('/goodwill/los-angeles-ca/outlets');
  await expect(page.getByRole('heading',{level:1})).toHaveText('Goodwill outlets in Los Angeles');
  await expect(page.locator('li[data-store-id]')).toHaveCount(2);
  for(const outlet of outlets){
    const row=page.locator(`li[data-store-id="${outlet.id}"]`);
    await row.scrollIntoViewIfNeeded();
    await expect(row.getByText(outlet.address,{exact:true})).toBeVisible();
    await expect(row.getByRole('link',{name:/directions/i})).toHaveAttribute('href',new RegExp(`destination_place_id=${outlet.placeId}`));
    await expect(row.getByText(/4\.6/)).toBeVisible();
    await expect(row.locator('[data-google-rating] > a')).toHaveAttribute('href',new RegExp(`query_place_id=${outlet.placeId}`));
  }
  await page.getByRole('button',{name:'Data sources',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Data sources'})).toContainText('Source checked November 4, 2026');
  await expect(page.getByRole('link',{name:'Goodwill Southern California’s outlet page'})).toHaveAttribute('href','https://www.goodwillsocal.org/outlet-store/');
  await expect(page.getByRole('link',{name:'Compare Los Angeles Goodwill stores'})).toHaveAttribute('href','/goodwill/los-angeles-ca');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content',/outlets in Los Angeles/);
});
test('methodology exposes scoring weights and limits',async({page})=>{
  await page.goto('/how-we-score');
  await expect(page.getByRole('heading',{level:1})).toHaveText('How the Thriftly Visit score works');
  await expect(page.getByRole('cell',{name:'40%',exact:true})).toBeVisible();
  await expect(page.getByText(/2022 American Community Survey/)).toBeVisible();
});
test('sitemap has no deploy-time dates and unknown cities are real 404s',async({request})=>{
  const r=await request.get('/sitemap.xml');const xml=await r.text();
  expect(r.status()).toBe(200);expect(xml).not.toContain('<lastmod>');
  expect(xml).toContain('https://www.thriftly.xyz/how-we-score');
  expect((await request.get('/goodwill/unknown-city-zz')).status()).toBe(404);
});
