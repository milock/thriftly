import {expect,test} from '@playwright/test';

const path='/independent-thrift-stores/san-diego-ca';
const search='/search?lat=32.7157&lon=-117.1611&radius=15&label=San+Diego&brands=independent';
test.beforeEach(async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort('failed'));
 await page.route('**/api/enrich**',route=>route.fulfill({json:{enriched:{}}}));
 await page.route('**/api/place-match**',route=>route.fulfill({json:{placeId:null}}));
});
test('pilot shows four source-verified shops with correction and visit links',async({page})=>{
 await page.setViewportSize({width:320,height:740});
 await page.goto(path);
 await expect(page.getByRole('heading',{level:1})).toHaveText('Independent thrift stores in San Diego, CA');
 await expect(page.getByText(/^Verified online:/)).toHaveCount(4);
 await expect(page.getByText('Verified online: 11/05/2026')).toHaveCount(4);
 const firstTitle=await page.getByRole('heading',{level:3}).first().boundingBox();
 expect(firstTitle!.y+firstTitle!.height).toBeLessThanOrEqual(740);
 await expect(page.getByRole('link',{name:'Operator website',exact:true})).toHaveCount(4);
 await expect(page.getByRole('button',{name:/report a problem/i})).toHaveCount(4);
 await expect(page.getByRole('link',{name:'Directions',exact:true})).toHaveCount(4);
 await expect(page.getByText(/Oldest source update/)).toHaveCount(0);
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await expect(page.getByText(/^Verified online:/)).toHaveCount(4);
 await expect(page.getByText(/Oldest source update/)).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('independent and chain choices combine and survive reload',async({page,isMobile})=>{
 await page.goto(search);
 await expect(page.locator('[data-store-card]')).toHaveCount(4);
 await page.getByRole('button',{name:/^filters/i}).click();
 await expect(page.getByRole('checkbox',{name:'Independent stores',exact:true})).toBeChecked();
 await page.getByRole('checkbox',{name:'Goodwill',exact:true}).check();
 if(isMobile)await page.getByRole('button',{name:/show .* stores/i}).click();
 await expect.poll(()=>page.locator('[data-store-card]').count()).toBeGreaterThan(4);
 await page.reload();
 await expect.poll(()=>page.locator('[data-store-card]').count()).toBeGreaterThan(4);
 await page.getByRole('button',{name:/^filters/i}).click();
 await page.getByRole('button',{name:'Goodwill only',exact:true}).click();
 if(isMobile)await page.getByRole('button',{name:/show .* stores/i}).click();
 await expect(page.locator('[data-store-card]').filter({hasText:'Humble Heart'})).toHaveCount(0);
 await expect(page).toHaveURL(/brands=goodwill/);
});
test('independent search retains departments and directions when the map fails',async({page,isMobile})=>{
 await page.goto(search+'&departments=furniture');
 await expect(page.locator('[data-store-card]')).toHaveCount(3);
 if(isMobile)await page.getByRole('tab',{name:'Map',exact:true}).click();
 await expect(page.getByText('The map is temporarily unavailable. Store listings and directions are still available.')).toBeVisible();
 if(isMobile)await page.getByRole('tab',{name:'List',exact:true}).click();
 const card=page.locator('[data-store-card]').first();
 await expect(card.locator('[data-store-address]')).not.toBeEmpty();
 await card.locator('[data-store-toggle]').click();
 await expect(card.getByRole('link',{name:'Directions',exact:true})).toHaveAttribute('href',/^https:\/\/www\.google\.com\/maps\/dir\//);
});
test('city navigation exposes the pilot and other cities do not create empty directories',async({page})=>{
 await page.goto('/thrift-stores/san-diego-ca');
 await page.getByRole('navigation',{name:'Browse store brands in San Diego'}).getByRole('link',{name:/Independent stores/}).click();
 await expect(page).toHaveURL(new RegExp(path));
 const response=await page.goto('/independent-thrift-stores/new-york-ny');
 expect(response?.status()).toBe(404);
});
